import prisma from "@/lib/prisma";

export const DEFAULT_ROLES = [
  {
    name: "owner",
    permissions: [
      "organization:update", "organization:delete",
      "member:create", "member:read", "member:update", "member:delete", "member:invite", "member:ban",
      "invitation:create", "invitation:cancel",
      "workspace:create", "workspace:read", "workspace:update", "workspace:delete",
      "project:create", "project:read", "project:update", "project:delete",
      "task:read", "task:create", "task:update", "task:delete", "task:comment"
    ]
  },
  {
    name: "admin",
    permissions: [
      "organization:update",
      "member:create", "member:read", "member:update", "member:delete", "member:invite", "member:ban",
      "invitation:create", "invitation:cancel",
      "workspace:create", "workspace:read", "workspace:update",
      "project:create", "project:read", "project:update", "project:delete",
      "task:read", "task:create", "task:update", "task:delete", "task:comment"
    ]
  },
  {
    name: "workspace_admin",
    permissions: [
      "member:read",
      "workspace:update",
      "project:create", "project:read", "project:update", "project:delete",
      "task:read", "task:create", "task:update", "task:delete", "task:comment"
    ]
  },
  {
    name: "project_admin",
    permissions: [
      "member:read",
      "project:update", "project:delete",
      "task:read", "task:create", "task:update", "task:delete", "task:comment"
    ]
  },
  {
    name: "member",
    permissions: [
      "member:read",
      "workspace:read",
      "project:read",
      "task:read", "task:create", "task:update", "task:comment"
    ]
  },
  {
    name: "guest",
    permissions: [
      "member:read",
      "task:read", "task:comment"
    ]
  }
];

export const rbacRepository = {
  async seedOrgDefaultRoles(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], orgId: string) {
    for (const roleDef of DEFAULT_ROLES) {
      const role = await tx.role.upsert({
        where: {
          organizationId_name: {
            organizationId: orgId,
            name: roleDef.name
          }
        },
        update: {},
        create: {
          organizationId: orgId,
          name: roleDef.name,
          isSystemDefault: true
        }
      });

      const perms = await tx.permission.findMany({
        where: {
          OR: roleDef.permissions.map((p: string) => {
            const [resource, action] = p.split(":");
            return { resource, action };
          })
        }
      });

      for (const p of perms) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: p.id
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: p.id
          }
        });
      }
    }
  },

  async getPermissions() {
    return prisma.permission.findMany();
  },

  async createRole(data: {
    name: string;
    organizationId: string | null;
    isSystemDefault?: boolean;
    bypassPermissions?: boolean;
  }) {
    return prisma.role.create({
      data,
    });
  },

  async getRolesByOrganization(organizationId: string) {
    return prisma.role.findMany({
      where: {
        OR: [
          { organizationId },
          { organizationId: null }, // System default roles
        ],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  },

  async updateRole(roleId: string, data: { name?: string, permissionIds?: string[], bypassPermissions?: boolean }) {
    return prisma.$transaction(async (tx) => {
      const updateData: Record<string, boolean | string> = {};
      if (data.bypassPermissions !== undefined) {
        updateData.bypassPermissions = data.bypassPermissions;
      }
      if (data.name !== undefined) {
        updateData.name = data.name;
      }
      
      if (Object.keys(updateData).length > 0) {
        await tx.role.update({
          where: { id: roleId },
          data: updateData,
        });
      }

      if (data.permissionIds) {
        // Delete existing
        await tx.rolePermission.deleteMany({
          where: { roleId },
        });

      // Insert new
      const uniquePermissionIds = Array.from(new Set(data.permissionIds));
      if (uniquePermissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: uniquePermissionIds.map((id) => ({
            roleId,
            permissionId: id,
          })),
          skipDuplicates: true,
        });
      }
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });
    });
  },

  async getRoleById(roleId: string) {
    return prisma.role.findUnique({
      where: { id: roleId },
    });
  },

  async deleteRole(roleId: string) {
    return prisma.$transaction(async (tx) => {
      // Remove role from all users
      await tx.userRoleAssignment.deleteMany({
        where: { roleId },
      });

      // Remove all permissions from the role
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Delete the role
      return tx.role.delete({
        where: { id: roleId },
      });
    });
  },

  async assignRolesToUser(data: {
    userId: string;
    roleIds: string[];
    scopeType: string;
    scopeId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // First, find existing roles for this user in this scope
      const existingAssignments = await tx.userRoleAssignment.findMany({
        where: {
          userId: data.userId,
          scopeType: data.scopeType,
          scopeId: data.scopeId,
        },
      });

      const existingRoleIds = existingAssignments.map((a) => a.roleId);
      
      // Calculate roles to add and roles to remove
      const rolesToAdd = data.roleIds.filter(id => !existingRoleIds.includes(id));
      const rolesToRemove = existingRoleIds.filter(id => !data.roleIds.includes(id));

      if (rolesToRemove.length > 0) {
        await tx.userRoleAssignment.deleteMany({
          where: {
            userId: data.userId,
            scopeType: data.scopeType,
            scopeId: data.scopeId,
            roleId: { in: rolesToRemove },
          },
        });
      }

      if (rolesToAdd.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: rolesToAdd.map((roleId) => ({
            userId: data.userId,
            roleId,
            scopeType: data.scopeType,
            scopeId: data.scopeId,
          })),
        });
      }

      return tx.userRoleAssignment.findMany({
        where: {
          userId: data.userId,
          scopeType: data.scopeType,
          scopeId: data.scopeId,
        },
      });
    });
  },

  async removeRolesFromUser(data: {
    userId: string;
    roleIds: string[];
    scopeType: string;
    scopeId: string;
  }) {
    return prisma.userRoleAssignment.deleteMany({
      where: {
        userId: data.userId,
        scopeType: data.scopeType,
        scopeId: data.scopeId,
        roleId: { in: data.roleIds },
      },
    });
  },

  async getUserAssignments(userId: string, scopeType?: string, scopeId?: string) {
    return prisma.userRoleAssignment.findMany({
      where: {
        userId,
        ...(scopeType && { scopeType }),
        ...(scopeId && { scopeId }),
      },
      include: {
        role: true,
      },
    });
  },

  async getUserPermissionsInScope(
    userId: string,
    scopeType: string,
    scopeId: string,
  ) {
    const assignments = await prisma.userRoleAssignment.findMany({
      where: {
        userId,
        scopeType,
        scopeId,
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
    });

    // Flatten permissions
    const permissions = new Set<string>();
    assignments.forEach((assignment) => {
      assignment.role.permissions.forEach((rp) => {
        permissions.add(`${rp.permission.resource}:${rp.permission.action}`);
      });
    });

    return Array.from(permissions);
  },

  async hasBypassRole(
    userId: string,
    scopes: { type: string; id: string }[],
  ): Promise<boolean> {
    if (scopes.length === 0) return false;
    
    // Check if the user has an owner role or bypassPermissions role in any of the given scopes
    const assignments = await prisma.userRoleAssignment.findMany({
      where: {
        userId,
        OR: scopes.map((s) => ({ scopeType: s.type, scopeId: s.id })),
        role: {
          OR: [{ name: "owner" }, { bypassPermissions: true }],
        },
      },
    });
    
    return assignments.length > 0;
  },

  async isOrganizationOwner(userId: string, organizationId: string): Promise<boolean> {
    const ownerAssignment = await prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        scopeType: "ORGANIZATION",
        scopeId: organizationId,
        role: {
          name: "owner",
        },
      },
    });
    return !!ownerAssignment;
  }
};
