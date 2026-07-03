import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import {
  createRoleSchema,
  updateRoleSchema,
  assignRoleSchema,
} from "@/app/http/validators/rbac.validator";
import { rbacService } from "@/app/services/rbac.service";

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
    
    const context: any = {};
    if (organizationId) context.organizationId = organizationId;
    if (workspaceId) context.workspaceId = workspaceId;
    if (projectId) context.projectId = projectId;
    if (taskId) context.taskId = taskId;

    const permissions = await rbacService.getPermissionsForContext(session.user.id, context);
    return res.status(200).json({ data: permissions });
  }),

  getOrganizationRoles: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = req.params;
    const roles = await rbacService.getOrganizationRoles(orgId as string);
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
    const role = await rbacService.createRole(validatedData, session.user.id);
    return res
      .status(201)
      .json({ message: "Role created successfully", data: role });
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
    const validatedData = updateRoleSchema.parse(req.body);
    const role = await rbacService.updateRole(
      roleId as string,
      validatedData.name,
      validatedData.permissionIds,
      validatedData.bypassPermissions,
      session.user.id
    );
    return res
      .status(200)
      .json({ message: "Role updated successfully", data: role });
  }),

  deleteRole: asyncHandler(async (req: Request, res: Response) => {
    const { roleId } = req.params;
    await rbacService.deleteRole(roleId as string);
    return res.status(200).json({ message: "Role deleted successfully" });
  }),

  assignRole: asyncHandler(async (req: Request, res: Response) => {
    const validatedData = assignRoleSchema.parse(req.body);
    const assignment = await rbacService.assignRole(validatedData);
    return res
      .status(201)
      .json({ message: "Role assigned successfully", data: assignment });
  }),

  removeRoleAssignment: asyncHandler(async (req: Request, res: Response) => {
    const validatedData = assignRoleSchema.parse(req.body); // Same schema for removal
    await rbacService.removeRole(validatedData);
    return res
      .status(200)
      .json({ message: "Role assignment removed successfully" });
  }),

  getUserAssignments: asyncHandler(async (req: Request, res: Response) => {
    const { userId, scopeType, scopeId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const assignments = await rbacService.getUserAssignments(
      userId as string,
      scopeType as string | undefined,
      scopeId as string | undefined
    );
    return res.status(200).json({ data: assignments });
  }),
};
