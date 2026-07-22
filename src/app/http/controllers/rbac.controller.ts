import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import {
  createRoleSchema,
  updateRoleSchema,
  assignRoleSchema,
  updateRoleHierarchySchema,
} from "@/app/http/validators/rbac.validator";
import { rbacRepository } from "@/app/repositories/rbac.repository";
import { auditLogService } from "@/app/services/audit-log.service";
import { rbacService } from "@/app/services/rbac.service";
import prisma from "@/lib/prisma";

async function resolveScopeContext(
  scopeType: string,
  scopeId: string,
): Promise<{ workspaceId: string; organizationId: string }> {
  if (scopeType === "WORKSPACE") {
    const ws = await prisma.workspace.findUnique({
      where: { id: scopeId },
      select: { organizationId: true },
    });
    return { workspaceId: scopeId, organizationId: ws?.organizationId || "" };
  } else if (scopeType === "PROJECT") {
    const proj = await prisma.project.findUnique({
      where: { id: scopeId },
      select: { workspaceId: true, organizationId: true },
    });
    return {
      workspaceId: proj?.workspaceId || "",
      organizationId: proj?.organizationId || "",
    };
  } else {
    // scopeType === "ORGANIZATION"
    const firstWorkspace = await prisma.workspace.findFirst({
      where: { organizationId: scopeId },
      select: { id: true },
    });
    return { workspaceId: firstWorkspace?.id || "", organizationId: scopeId };
  }
}

export const rbacController = {
  getPermissions: asyncHandler(async (req: Request, res: Response) => {
    const permissions = await rbacService.getPermissions();
    return res.status(200).json({ data: permissions });
  }),

  getMyPermissions: asyncHandler(async (req: Request, res: Response) => {
    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { organizationId, workspaceId, projectId, taskId } = req.query;

    const context: Record<string, string> = {};
    if (organizationId) context.organizationId = organizationId as string;
    if (workspaceId) context.workspaceId = workspaceId as string;
    if (projectId) context.projectId = projectId as string;
    if (taskId) context.taskId = taskId as string;

    const permissions = await rbacService.getPermissionsForContext(
      session.user.id,
      context,
    );
    return res.status(200).json({ data: permissions });
  }),

  getOrganizationRoles: asyncHandler(async (req: Request, res: Response) => {
    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { orgId } = req.params;
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "role:read",
      {
        organizationId: orgId as string,
      },
    );

    if (!isAllowed) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You do not have permission to view roles.",
        });
    }

    const search = req.query.search as string | undefined;
    const roles = await rbacService.getOrganizationRoles(orgId as string, search);
    return res.status(200).json({ data: roles });
  }),

  createRole: asyncHandler(async (req: Request, res: Response) => {
    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });
    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validatedData = createRoleSchema.parse(req.body);
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "role:create",
      {
        organizationId: validatedData.organizationId,
      },
    );

    if (!isAllowed) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You do not have permission to create roles.",
        });
    }

    const role = await rbacService.createRole(validatedData, session.user.id);

    // Organization-level action: find first workspace to satisfy required workspaceId in AuditLog
    const { workspaceId, organizationId } = await resolveScopeContext(
      "ORGANIZATION",
      validatedData.organizationId,
    );

    if (role && workspaceId) {
      await auditLogService.log({
        workspaceId,
        organizationId,
        userId: session.user.id,
        action: "CREATE_ROLE",
        entityType: "ROLE",
        entityId: role.id,
        entityName: role.name,
        description: `User "${session.user.name}" created role "${role.name}".`,
        metadata: validatedData,
        req,
      });
    }

    return res
      .status(201)
      .json({ message: "Role created successfully", data: role });
  }),

  updateRoleHierarchy: asyncHandler(async (req: Request, res: Response) => {
    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });
    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validatedData = updateRoleHierarchySchema.parse(req.body);
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "role:update-hierarchy",
      {
        organizationId: validatedData.organizationId,
      },
    );

    if (!isAllowed) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to update role hierarchy.",
      });
    }

    await rbacService.updateRoleHierarchy(
      validatedData.roleIds,
      validatedData.organizationId,
      session.user.id
    );

    // Organization-level action: find first workspace to satisfy required workspaceId in AuditLog
    const { workspaceId } = await resolveScopeContext(
      "ORGANIZATION",
      validatedData.organizationId,
    );

    if (workspaceId) {
      await auditLogService.log({
        workspaceId,
        organizationId: validatedData.organizationId,
        userId: session.user.id,
        action: "UPDATE_ROLE_HIERARCHY",
        entityType: "ROLE_HIERARCHY",
        description: `User "${session.user.name}" updated the role hierarchy.`,
        req,
      });
    }

    return res.status(200).json({ message: "Role hierarchy updated successfully" });
  }),

  updateRolePermissions: asyncHandler(async (req: Request, res: Response) => {
    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });
    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { roleId } = req.params;
    const roleRecord = await rbacRepository.getRoleById(roleId as string);
    if (!roleRecord) {
      return res.status(404).json({ message: "Role not found" });
    }

    const isAllowed = await rbacService.authorize(
      session.user.id,
      "role:update",
      {
        organizationId: roleRecord.organizationId || undefined,
      },
    );

    if (!isAllowed) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You do not have permission to update roles.",
        });
    }

    const validatedData = updateRoleSchema.parse(req.body);
    const role = await rbacService.updateRole(
      roleId as string,
      validatedData.name,
      validatedData.permissionIds,
      validatedData.bypassPermissions,
      session.user.id,
    );

    if (roleRecord.organizationId) {
      const { workspaceId, organizationId } = await resolveScopeContext(
        "ORGANIZATION",
        roleRecord.organizationId,
      );

      if (role && workspaceId) {
        await auditLogService.log({
          workspaceId,
          organizationId,
          userId: session.user.id,
          action: "UPDATE_ROLE",
          entityType: "ROLE",
          entityId: role.id,
          entityName: role.name,
          description: `User "${session.user.name}" updated settings/permissions for role "${role.name}".`,
          metadata: validatedData,
          req,
        });
      }
    }

    return res
      .status(200)
      .json({ message: "Role updated successfully", data: role });
  }),

  deleteRole: asyncHandler(async (req: Request, res: Response) => {
    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });
    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { roleId } = req.params;
    const roleRecord = await rbacRepository.getRoleById(roleId as string);
    if (!roleRecord) {
      return res.status(404).json({ message: "Role not found" });
    }

    const isAllowed = await rbacService.authorize(
      session.user.id,
      "role:delete",
      {
        organizationId: roleRecord.organizationId || undefined,
      },
    );

    if (!isAllowed) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You do not have permission to delete roles.",
        });
    }

    await rbacService.deleteRole(roleId as string);

    if (roleRecord.organizationId) {
      const { workspaceId, organizationId } = await resolveScopeContext(
        "ORGANIZATION",
        roleRecord.organizationId,
      );

      if (workspaceId) {
        await auditLogService.log({
          workspaceId,
          organizationId,
          userId: session.user.id,
          action: "DELETE_ROLE",
          entityType: "ROLE",
          entityId: roleRecord.id,
          entityName: roleRecord.name,
          description: `User "${session.user.name}" deleted role "${roleRecord.name}".`,
          req,
        });
      }
    }

    return res.status(200).json({ message: "Role deleted successfully" });
  }),

  assignRole: asyncHandler(async (req: Request, res: Response) => {
    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });
    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validatedData = assignRoleSchema.parse(req.body);
    const context: Record<string, string> = {};
    if (validatedData.scopeType === "ORGANIZATION") {
      context.organizationId = validatedData.scopeId;
    } else if (validatedData.scopeType === "WORKSPACE") {
      context.workspaceId = validatedData.scopeId;
    } else if (validatedData.scopeType === "PROJECT") {
      context.projectId = validatedData.scopeId;
    }

    const isAllowed = await rbacService.authorize(
      session.user.id,
      "role:assign",
      context,
    );
    if (!isAllowed) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You do not have permission to assign roles.",
        });
    }

    const assignment = await rbacService.assignRole(validatedData);

    const { workspaceId, organizationId } = await resolveScopeContext(
      validatedData.scopeType,
      validatedData.scopeId,
    );

    const targetUser = await prisma.user.findUnique({
      where: { id: validatedData.userId },
      select: { name: true },
    });

    const roles = await prisma.role.findMany({
      where: { id: { in: validatedData.roleIds } },
      select: { name: true },
    });
    const roleNames = roles.map((r) => r.name).join(", ");

    if (workspaceId && targetUser) {
      await auditLogService.log({
        workspaceId,
        organizationId,
        userId: session.user.id,
        action: "ASSIGN_ROLE",
        entityType: "USER_ROLE_ASSIGNMENT",
        entityId: validatedData.userId,
        entityName: targetUser.name,
        description: `User "${session.user.name}" updated permissions for member "${targetUser.name}" to roles [${roleNames}] in ${validatedData.scopeType.toLowerCase()} context.`,
        metadata: validatedData,
        req,
      });
    }

    return res
      .status(201)
      .json({ message: "Role assigned successfully", data: assignment });
  }),

  removeRoleAssignment: asyncHandler(async (req: Request, res: Response) => {
    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });
    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validatedData = assignRoleSchema.parse(req.body); // Same schema for removal
    const context: Record<string, string> = {};
    if (validatedData.scopeType === "ORGANIZATION") {
      context.organizationId = validatedData.scopeId;
    } else if (validatedData.scopeType === "WORKSPACE") {
      context.workspaceId = validatedData.scopeId;
    } else if (validatedData.scopeType === "PROJECT") {
      context.projectId = validatedData.scopeId;
    }

    const isAllowed = await rbacService.authorize(
      session.user.id,
      "role:assign",
      context,
    );
    if (!isAllowed) {
      return res
        .status(403)
        .json({
          message:
            "Forbidden: You do not have permission to remove role assignments.",
        });
    }

    await rbacService.removeRole(validatedData);

    const { workspaceId, organizationId } = await resolveScopeContext(
      validatedData.scopeType,
      validatedData.scopeId,
    );

    const targetUser = await prisma.user.findUnique({
      where: { id: validatedData.userId },
      select: { name: true },
    });

    const roles = await prisma.role.findMany({
      where: { id: { in: validatedData.roleIds } },
      select: { name: true },
    });
    const roleNames = roles.map((r) => r.name).join(", ");

    if (workspaceId && targetUser) {
      await auditLogService.log({
        workspaceId,
        organizationId,
        userId: session.user.id,
        action: "REMOVE_ROLE",
        entityType: "USER_ROLE_ASSIGNMENT",
        entityId: validatedData.userId,
        entityName: targetUser.name,
        description: `User "${session.user.name}" removed roles [${roleNames}] from member "${targetUser.name}" in ${validatedData.scopeType.toLowerCase()} context.`,
        metadata: validatedData,
        req,
      });
    }

    return res
      .status(200)
      .json({ message: "Role assignment removed successfully" });
  }),

  getUserAssignments: asyncHandler(async (req: Request, res: Response) => {
    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });
    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId, scopeType, scopeId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const activeOrgId = session.session.activeOrganizationId;
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "role:read",
      {
        organizationId: activeOrgId || undefined,
      },
    );

    if (!isAllowed) {
      return res
        .status(403)
        .json({
          message:
            "Forbidden: You do not have permission to view role assignments.",
        });
    }

    const assignments = await rbacService.getUserAssignments(
      userId as string,
      scopeType as string | undefined,
      scopeId as string | undefined,
    );
    return res.status(200).json({ data: assignments });
  }),
};
