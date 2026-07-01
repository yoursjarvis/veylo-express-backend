import { rbacRepository } from "@/app/repositories/rbac.repository";
import { BadRequestException } from "@/utils/app-error";

export const rbacService = {
  async getPermissions() {
    return rbacRepository.getPermissions();
  },

  async getOrganizationRoles(organizationId: string) {
    return rbacRepository.getRolesByOrganization(organizationId);
  },

  async createRole(data: {
    name: string;
    organizationId: string;
    permissionIds: string[];
    bypassPermissions?: boolean;
  }, userId: string) {
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
      const isOwner = await rbacRepository.isOrganizationOwner(userId, data.organizationId);
      if (!isOwner) {
        throw new BadRequestException("Only the organization owner can grant bypass permissions.");
      }
    }

    const role = await rbacRepository.createRole({
      name: data.name,
      organizationId: data.organizationId,
      bypassPermissions: data.bypassPermissions,
    });

    if (data.permissionIds.length > 0) {
      return rbacRepository.updateRole(role.id, { permissionIds: data.permissionIds });
    }

    return role;
  },

  async updateRole(roleId: string, name?: string, permissionIds?: string[], bypassPermissions?: boolean, userId?: string) {
    if (bypassPermissions !== undefined) {
      if (!userId) {
        throw new BadRequestException("User ID is required to update bypass permissions.");
      }
      const role = await rbacRepository.getRoleById(roleId);
      if (role && role.organizationId) {
        const isOwner = await rbacRepository.isOrganizationOwner(userId, role.organizationId);
        if (!isOwner) {
          throw new BadRequestException("Only the organization owner can modify bypass permissions.");
        }
      }
    }
    
    if (name) {
      const existingRole = await rbacRepository.getRoleById(roleId);
      if (existingRole && existingRole.name.toLowerCase() === "owner") {
        throw new BadRequestException("The owner role cannot be renamed.");
      }
    }

    return rbacRepository.updateRole(roleId, { name, permissionIds, bypassPermissions });
  },

  async deleteRole(roleId: string) {
    const role = await rbacRepository.getRoleById(roleId);
    if (!role) {
      throw new BadRequestException("Role not found.");
    }
    if (role.isSystemDefault) {
      throw new BadRequestException("System default roles cannot be deleted.");
    }
    return rbacRepository.deleteRole(roleId);
  },

  async assignRole(data: {
    userId: string;
    roleIds: string[];
    scopeType: "ORGANIZATION" | "PROJECT";
    scopeId: string;
  }) {
    return rbacRepository.assignRolesToUser(data);
  },

  async removeRole(data: {
    userId: string;
    roleIds: string[];
    scopeType: "ORGANIZATION" | "PROJECT";
    scopeId: string;
  }) {
    return rbacRepository.removeRolesFromUser(data);
  },

  async getUserAssignments(userId: string, scopeType: string, scopeId: string) {
    return rbacRepository.getUserAssignments(userId, scopeType, scopeId);
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
    }
  ): Promise<boolean> {
    // 1. Relationship-based override for Tasks
    if (context.taskId && requiredPermission.startsWith("task:")) {
      const taskRepository = (await import("@/app/repositories/task.repository")).taskRepository;
      const task = await taskRepository.findTaskDetails(context.taskId);
      if (task) {
        if (task.creatorId === userId || task.assigneeId === userId || task.reporterId === userId) {
          // If related to task, grant basic task permissions
          const allowedTaskActions = ["read", "update", "comment"];
          const action = requiredPermission.split(":")[1];
          if (allowedTaskActions.includes(action)) {
            return true;
          }
        }
      }
    }

    // 2. Scoped Role Resolution (Union of all applicable scopes)
    const scopes = [];
    if (context.organizationId) scopes.push({ type: "ORGANIZATION", id: context.organizationId });
    if (context.workspaceId) scopes.push({ type: "WORKSPACE", id: context.workspaceId });
    if (context.projectId) scopes.push({ type: "PROJECT", id: context.projectId });

    if (scopes.length === 0) {
      return false; // No scope context provided
    }
    
    // 3. Bypass Role Check
    const hasBypass = await rbacRepository.hasBypassRole(userId, scopes);
    if (hasBypass) {
      return true;
    }

    const allPermissions = new Set<string>();
    for (const scope of scopes) {
      const perms = await rbacRepository.getUserPermissionsInScope(userId, scope.type, scope.id);
      perms.forEach(p => allPermissions.add(p));
    }

    return allPermissions.has(requiredPermission);
  },

  async getPermissionsForContext(
    userId: string,
    context: {
      organizationId?: string;
      workspaceId?: string;
      projectId?: string;
      taskId?: string;
    }
  ): Promise<string[]> {
    const allPermissions = new Set<string>();

    const scopes = [];
    if (context.organizationId) scopes.push({ type: "ORGANIZATION", id: context.organizationId });
    if (context.workspaceId) scopes.push({ type: "WORKSPACE", id: context.workspaceId });
    if (context.projectId) scopes.push({ type: "PROJECT", id: context.projectId });

    // 1. Bypass Role Check
    const hasBypass = await rbacRepository.hasBypassRole(userId, scopes);
    let isOwner = false;
    if (context.organizationId) {
      isOwner = await rbacRepository.isOrganizationOwner(userId, context.organizationId);
    }
    
    if (hasBypass) {
      return isOwner ? ["*", "*owner"] : ["*"];
    }

    if (isOwner) {
      allPermissions.add("*owner");
    }

    for (const scope of scopes) {
      const perms = await rbacRepository.getUserPermissionsInScope(userId, scope.type, scope.id);
      perms.forEach(p => allPermissions.add(p));
    }

    if (context.taskId) {
      const taskRepository = (await import("@/app/repositories/task.repository")).taskRepository;
      const task = await taskRepository.findTaskDetails(context.taskId);
      if (task) {
        if (task.creatorId === userId || task.assigneeId === userId || task.reporterId === userId) {
          allPermissions.add("task:read");
          allPermissions.add("task:update");
          allPermissions.add("task:comment");
        }
      }
    }

    return Array.from(allPermissions);
  }
};
