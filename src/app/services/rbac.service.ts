import { rbacRepository } from "@/app/repositories/rbac.repository";
import prisma from "@/lib/prisma";
import { BadRequestException } from "@/utils/app-error";
import {
  invalidateRolePermissionsCache,
  invalidateUserPermissionsCache,
} from "@/utils/permissions-cache";

export const rbacService = {
  async getPermissions() {
    return rbacRepository.getPermissions();
  },

  async getOrganizationRoles(organizationId: string, search?: string) {
    return rbacRepository.getRolesByOrganization(organizationId, search);
  },

  async createRole(
    data: {
      name: string;
      organizationId: string;
      permissionIds: string[];
      bypassPermissions?: boolean;
    },
    userId: string,
  ) {
    const existingRoles = await rbacRepository.getRolesByOrganization(
      data.organizationId,
    );
    if (
      existingRoles.some(
        (r) => r.name.toLowerCase() === data.name.toLowerCase(),
      )
    ) {
      throw new BadRequestException(
        "A role with this name already exists in the organization.",
      );
    }

    if (data.bypassPermissions) {
      const isOwner = await rbacRepository.isOrganizationOwner(
        userId,
        data.organizationId,
      );
      if (!isOwner) {
        throw new BadRequestException(
          "Only the organization owner can grant bypass permissions.",
        );
      }
    }

    const role = await rbacRepository.createRole({
      name: data.name,
      organizationId: data.organizationId,
      bypassPermissions: data.bypassPermissions,
    });

    if (data.permissionIds.length > 0) {
      return rbacRepository.updateRole(role.id, {
        permissionIds: data.permissionIds,
      });
    }

    return role;
  },

  async updateRole(
    roleId: string,
    name?: string,
    permissionIds?: string[],
    bypassPermissions?: boolean,
    userId?: string,
  ) {
    if (bypassPermissions !== undefined) {
      if (!userId) {
        throw new BadRequestException(
          "User ID is required to update bypass permissions.",
        );
      }
      const role = await rbacRepository.getRoleById(roleId);
      if (role && role.organizationId) {
        const isOwner = await rbacRepository.isOrganizationOwner(
          userId,
          role.organizationId,
        );
        if (!isOwner) {
          throw new BadRequestException(
            "Only the organization owner can modify bypass permissions.",
          );
        }
      }
    }

    const existingRole = await rbacRepository.getRoleById(roleId);
    if (!existingRole) throw new BadRequestException("Role not found.");

    if (name && existingRole.name.toLowerCase() === "owner") {
      throw new BadRequestException("The owner role cannot be renamed.");
    }

    if (permissionIds !== undefined && userId && existingRole.organizationId) {
      const isOwner = await rbacRepository.isOrganizationOwner(
        userId,
        existingRole.organizationId,
      );
      if (!isOwner) {
        const userMaxLevel = await rbacRepository.getUserMaxLevel(
          userId,
          existingRole.organizationId,
        );
        if (userMaxLevel <= existingRole.level) {
          throw new BadRequestException(
            "You cannot modify permissions of a role that is equal to or higher than your highest role level.",
          );
        }
      }
    }

    const updatedRole = await rbacRepository.updateRole(roleId, {
      name,
      permissionIds,
      bypassPermissions,
    });

    // Invalidate cache for users with this role since its permissions/properties changed
    await invalidateRolePermissionsCache(roleId);

    return updatedRole;
  },

  async deleteRole(roleId: string) {
    const role = await rbacRepository.getRoleById(roleId);
    if (!role) {
      throw new BadRequestException("Role not found.");
    }
    if (role.isSystemDefault) {
      throw new BadRequestException("System default roles cannot be deleted.");
    }

    // Find all users who have this role and invalidate their cache BEFORE deleting the role
    await invalidateRolePermissionsCache(roleId);

    return rbacRepository.deleteRole(roleId);
  },

  async updateRoleHierarchy(
    roleIds: string[],
    organizationId: string,
    userId: string,
  ) {
    const isOwner = await rbacRepository.isOrganizationOwner(
      userId,
      organizationId,
    );
    const userMaxLevel = isOwner
      ? Infinity
      : await rbacRepository.getUserMaxLevel(userId, organizationId);

    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds }, organizationId },
    });

    for (const role of roles) {
      if (role.level >= userMaxLevel) {
        throw new BadRequestException(
          "You cannot reorder roles that are equal to or higher than your highest role level.",
        );
      }
    }

    // Actually, in reordering, if they provide ALL roles, we might reject because they include higher roles.
    // Wait, the frontend will pass only the roles they can reorder? Or all roles?
    // If the frontend passes all roles, we should only update the ones below their level.
    // For now, if they try to touch ANY role >= userMaxLevel, we block. We'll ensure the UI only allows them to sort a sub-list.
    // Or we just skip the roles they can't touch.
    // Let's keep the throw for security.

    await rbacRepository.updateRoleHierarchy(roleIds, organizationId);

    // Invalidate cache for all affected users... Actually, level changes don't affect cached permissions (which are just strings).
    // So no cache invalidation is needed for hierarchy.
  },

  async assignRole(data: {
    userId: string;
    roleIds: string[];
    scopeType:
      "SYSTEM" | "ORGANIZATION" | "WORKSPACE" | "DEPARTMENT" | "PROJECT";
    scopeId: string;
  }) {
    const result = await rbacRepository.assignRolesToUser(data);
    await invalidateUserPermissionsCache(data.userId);
    return result;
  },

  async removeRole(data: {
    userId: string;
    roleIds: string[];
    scopeType:
      "SYSTEM" | "ORGANIZATION" | "WORKSPACE" | "DEPARTMENT" | "PROJECT";
    scopeId: string;
  }) {
    const result = await rbacRepository.removeRolesFromUser(data);
    await invalidateUserPermissionsCache(data.userId);
    return result;
  },

  async getUserAssignments(
    userId: string,
    scopeType?: string,
    scopeId?: string,
  ) {
    return rbacRepository.getUserAssignments(userId, scopeType, scopeId);
  },

  async getUserPermissionsInScopes(
    userId: string,
    scopes: { type: string; id: string }[],
  ): Promise<string[]> {
    if (scopes.length === 0) return [];

    const assignments =
      (await prisma.userRoleAssignment?.findMany({
        where: {
          userId,
          OR: scopes.map((s) => ({
            scopeType: s.type,
            scopeId: s.id,
          })),
          role: {
            deletedAt: null,
          },
        },
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      })) || [];

    const permissions = new Set<string>();
    assignments.forEach((assignment) => {
      assignment.role.permissions.forEach((rp) => {
        if (rp.permission && rp.permission.deletedAt === null) {
          permissions.add(`${rp.permission.resource}:${rp.permission.action}`);
        }
      });
    });

    return Array.from(permissions);
  },

  async checkPermission(
    userId: string,
    scopeType: string,
    scopeId: string,
    requiredPermission: string,
  ): Promise<boolean> {
    const permissions = await rbacRepository.getUserPermissionsInScope(
      userId,
      scopeType,
      scopeId,
    );
    return permissions.includes(requiredPermission);
  },

  async authorize(
    userId: string,
    requiredPermission: string,
    context: {
      organizationId?: string;
      workspaceId?: string;
      projectId?: string;
      taskId?: string;
    },
  ): Promise<boolean> {
    const { isCreator, scopes, resolvedTaskId } =
      await resolveContextAndCreator(userId, context);

    // 1. Organization Creator Override: bypass all checks
    if (isCreator) {
      return true;
    }

    // 2. Relationship-based override for Tasks
    if (resolvedTaskId && requiredPermission.startsWith("task:")) {
      const taskRepository = (
        await import("@/app/repositories/task.repository")
      ).taskRepository;
      const task = await taskRepository.findTaskDetails(resolvedTaskId);
      if (task) {
        if (
          task.creatorId === userId ||
          task.assigneeId === userId ||
          task.reporterId === userId
        ) {
          const allowedTaskActions = ["read", "update", "comment"];
          const action = requiredPermission.split(":")[1];
          if (allowedTaskActions.includes(action)) {
            return true;
          }
        }
      }
    }

    if (scopes.length === 0) {
      return false;
    }

    // 3. Bypass Role Check
    const hasBypass = await rbacRepository.hasBypassRole(userId, scopes);
    if (hasBypass) {
      return true;
    }

    // 4. Union of all permissions in active scopes
    const allPermissions = await this.getUserPermissionsInScopes(
      userId,
      scopes,
    );
    return allPermissions.includes(requiredPermission);
  },

  async getPermissionsForContext(
    userId: string,
    context: {
      organizationId?: string;
      workspaceId?: string;
      projectId?: string;
      taskId?: string;
    },
  ): Promise<string[]> {
    const { isCreator, scopes, resolvedTaskId, resolvedOrgId } =
      await resolveContextAndCreator(userId, context);

    if (isCreator) {
      return ["*", "*owner"];
    }

    // 1. Bypass Role Check
    const hasBypass = await rbacRepository.hasBypassRole(userId, scopes);
    let isOwner = false;
    if (resolvedOrgId) {
      isOwner = await rbacRepository.isOrganizationOwner(userId, resolvedOrgId);
    }

    if (hasBypass) {
      return isOwner ? ["*", "*owner"] : ["*"];
    }

    const allPermissions = new Set<string>();
    if (isOwner) {
      allPermissions.add("*owner");
    }

    const perms = await this.getUserPermissionsInScopes(userId, scopes);
    perms.forEach((p) => allPermissions.add(p));

    if (resolvedTaskId) {
      const taskRepository = (
        await import("@/app/repositories/task.repository")
      ).taskRepository;
      const task = await taskRepository.findTaskDetails(resolvedTaskId);
      if (task) {
        if (
          task.creatorId === userId ||
          task.assigneeId === userId ||
          task.reporterId === userId
        ) {
          allPermissions.add("task:read");
          allPermissions.add("task:update");
          allPermissions.add("task:comment");
        }
      }
    }

    return Array.from(allPermissions);
  },
};

async function resolveContextAndCreator(
  userId: string,
  context: {
    organizationId?: string;
    workspaceId?: string;
    projectId?: string;
    taskId?: string;
  },
) {
  let resolvedOrgId = context.organizationId;
  let resolvedWorkspaceId = context.workspaceId;
  let resolvedProjectId = context.projectId;
  let resolvedTaskId = context.taskId;

  // 1. Resolve hierarchy upwards from taskId
  if (resolvedTaskId) {
    const task = await prisma.task?.findUnique({
      where: { id: resolvedTaskId },
      select: { projectId: true, organizationId: true },
    });
    if (task) {
      resolvedProjectId = task.projectId;
      resolvedOrgId = task.organizationId;
    }
  }

  // 2. Resolve hierarchy upwards from projectId
  if (resolvedProjectId) {
    const project = await prisma.project?.findUnique({
      where: { id: resolvedProjectId },
      select: { workspaceId: true, organizationId: true },
    });
    if (project) {
      resolvedWorkspaceId = project.workspaceId;
      resolvedOrgId = project.organizationId;
    }
  }

  // 3. Resolve hierarchy upwards from workspaceId
  if (resolvedWorkspaceId && !resolvedOrgId) {
    const workspace = await prisma.workspace?.findUnique({
      where: { id: resolvedWorkspaceId },
      select: { organizationId: true },
    });
    if (workspace) {
      resolvedOrgId = workspace.organizationId;
    }
  }

  // 4. Check if the user is the creator (ownerId) of the resolved organization
  let isCreator = false;
  if (resolvedOrgId) {
    const org = await prisma.organization?.findUnique({
      where: { id: resolvedOrgId },
      select: { ownerId: true },
    });
    if (org && org.ownerId === userId) {
      isCreator = true;
    }
  }

  // 5. Gather all active scopes
  const scopes: Array<{ type: string; id: string }> = [];
  if (resolvedOrgId) scopes.push({ type: "ORGANIZATION", id: resolvedOrgId });
  if (resolvedWorkspaceId)
    scopes.push({ type: "WORKSPACE", id: resolvedWorkspaceId });
  if (resolvedProjectId)
    scopes.push({ type: "PROJECT", id: resolvedProjectId });

  // Add SYSTEM scope check
  scopes.push({
    type: "SYSTEM",
    id: "00000000-0000-0000-0000-000000000000",
  });

  return {
    isCreator,
    scopes,
    resolvedOrgId,
    resolvedWorkspaceId,
    resolvedProjectId,
    resolvedTaskId,
  };
}
