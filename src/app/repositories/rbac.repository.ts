import prisma from "@/lib/prisma";

export const DEFAULT_ROLES = [
  {
    name: "owner",
    permissions: [
      "workspace:read",
      "workspace:create",
      "workspace:update",
      "workspace:delete",
      "workspace:restore",
      "workspace:force-delete",
      "workspace:invite-members",
      "workspace:remove-members",
      "project:read",
      "project:create",
      "project:update",
      "project:delete",
      "project:restore",
      "project:force-delete",
      "project-member:read",
      "project-member:invite-member",
      "project-member:remove-member",
      "project-vault:read",
      "project-vault:create",
      "project-vault:update",
      "project-vault:delete",
      "project-vault:restore",
      "project-vault:force-delete",
      "project-custom-field:read",
      "project-custom-field:create",
      "project-custom-field:update",
      "project-custom-field:delete",
      "project-custom-field:restore",
      "project-custom-field:force-delete",
      "project-status:read",
      "project-status:create",
      "project-status:update",
      "project-status:delete",
      "project-status:restore",
      "project-status:force-delete",
      "project-label:read",
      "project-label:update",
      "project-label:create",
      "project-label:delete",
      "project-label:restore",
      "project-label:force-delete",
      "project-webhook:read",
      "project-webhook:create",
      "project-webhook:update",
      "project-webhook:delete",
      "project-webhook:restore",
      "project-webhook:force-delete",
      "project-automation:read",
      "project-automation:create",
      "project-automation:update",
      "project-automation:delete",
      "project-automation:restore",
      "project-automation:force-delete",
      "project-epic:read",
      "project-epic:create",
      "project-epic:update",
      "project-epic:delete",
      "project-epic:restore",
      "project-epic:force-delete",
      "project-milestone:read",
      "project-milestone:create",
      "project-milestone:update",
      "project-milestone:delete",
      "project-milestone:restore",
      "project-milestone:force-delete",
      "task:read",
      "task:create",
      "task:update",
      "task:delete",
      "task:restore",
      "task:force-delete",
      "task:comment",
      "task:delete-own-comment",
      "task:delete-any-comment",
      "member:read",
      "member:invite",
      "member:update",
      "member:ban",
      "member:unban",
      "member:change-password",
      "goal-okrs:read",
      "goal-okrs:create",
      "goal-okrs:update",
      "goal-okrs:delete",
      "goal-okrs:restore",
      "goal-okrs:force-delete",
      "organization:read",
      "organization:update",
      "organization:delete",
      "invitation:read",
      "invitation:create",
      "invitation:cancel",
      "checklist-template:read",
      "checklist-template:create",
      "checklist-template:update",
      "checklist-template:delete",
      "role:read",
      "role:create",
      "role:update",
      "role:delete",
      "role:assign",
    ],
  },
  {
    name: "admin",
    permissions: [
      "workspace:read",
      "workspace:create",
      "workspace:update",
      "workspace:delete",
      "workspace:restore",
      "workspace:force-delete",
      "workspace:invite-members",
      "workspace:remove-members",
      "project:read",
      "project:create",
      "project:update",
      "project:delete",
      "project:restore",
      "project:force-delete",
      "project-member:read",
      "project-member:invite-member",
      "project-member:remove-member",
      "project-vault:read",
      "project-vault:create",
      "project-vault:update",
      "project-vault:delete",
      "project-vault:restore",
      "project-vault:force-delete",
      "project-custom-field:read",
      "project-custom-field:create",
      "project-custom-field:update",
      "project-custom-field:delete",
      "project-custom-field:restore",
      "project-custom-field:force-delete",
      "project-status:read",
      "project-status:create",
      "project-status:update",
      "project-status:delete",
      "project-status:restore",
      "project-status:force-delete",
      "project-label:read",
      "project-label:update",
      "project-label:create",
      "project-label:delete",
      "project-label:restore",
      "project-label:force-delete",
      "project-webhook:read",
      "project-webhook:create",
      "project-webhook:update",
      "project-webhook:delete",
      "project-webhook:restore",
      "project-webhook:force-delete",
      "project-automation:read",
      "project-automation:create",
      "project-automation:update",
      "project-automation:delete",
      "project-automation:restore",
      "project-automation:force-delete",
      "project-epic:read",
      "project-epic:create",
      "project-epic:update",
      "project-epic:delete",
      "project-epic:restore",
      "project-epic:force-delete",
      "project-milestone:read",
      "project-milestone:create",
      "project-milestone:update",
      "project-milestone:delete",
      "project-milestone:restore",
      "project-milestone:force-delete",
      "task:read",
      "task:create",
      "task:update",
      "task:delete",
      "task:restore",
      "task:force-delete",
      "task:comment",
      "task:delete-own-comment",
      "task:delete-any-comment",
      "member:read",
      "member:invite",
      "member:update",
      "member:ban",
      "member:unban",
      "member:change-password",
      "goal-okrs:read",
      "goal-okrs:create",
      "goal-okrs:update",
      "goal-okrs:delete",
      "goal-okrs:restore",
      "goal-okrs:force-delete",
      "organization:read",
      "organization:update",
      "invitation:read",
      "invitation:create",
      "invitation:cancel",
      "checklist-template:read",
      "checklist-template:create",
      "checklist-template:update",
      "checklist-template:delete",
      "role:read",
      "role:create",
      "role:update",
      "role:delete",
      "role:assign",
    ],
  },
  {
    name: "workspace_admin",
    permissions: [
      "workspace:read",
      "workspace:update",
      "workspace:invite-members",
      "workspace:remove-members",
      "project:read",
      "project:create",
      "project:update",
      "project:delete",
      "project:restore",
      "project:force-delete",
      "project-member:read",
      "project-member:invite-member",
      "project-member:remove-member",
      "project-vault:read",
      "project-vault:create",
      "project-vault:update",
      "project-vault:delete",
      "project-vault:restore",
      "project-vault:force-delete",
      "project-custom-field:read",
      "project-custom-field:create",
      "project-custom-field:update",
      "project-custom-field:delete",
      "project-custom-field:restore",
      "project-custom-field:force-delete",
      "project-status:read",
      "project-status:create",
      "project-status:update",
      "project-status:delete",
      "project-status:restore",
      "project-status:force-delete",
      "project-label:read",
      "project-label:update",
      "project-label:create",
      "project-label:delete",
      "project-label:restore",
      "project-label:force-delete",
      "project-webhook:read",
      "project-webhook:create",
      "project-webhook:update",
      "project-webhook:delete",
      "project-webhook:restore",
      "project-webhook:force-delete",
      "project-automation:read",
      "project-automation:create",
      "project-automation:update",
      "project-automation:delete",
      "project-automation:restore",
      "project-automation:force-delete",
      "project-epic:read",
      "project-epic:create",
      "project-epic:update",
      "project-epic:delete",
      "project-epic:restore",
      "project-epic:force-delete",
      "project-milestone:read",
      "project-milestone:create",
      "project-milestone:update",
      "project-milestone:delete",
      "project-milestone:restore",
      "project-milestone:force-delete",
      "task:read",
      "task:create",
      "task:update",
      "task:delete",
      "task:restore",
      "task:force-delete",
      "task:comment",
      "task:delete-own-comment",
      "task:delete-any-comment",
      "member:read",
      "goal-okrs:read",
      "goal-okrs:create",
      "goal-okrs:update",
      "goal-okrs:delete",
      "goal-okrs:restore",
      "goal-okrs:force-delete",
      "checklist-template:read",
      "checklist-template:create",
      "checklist-template:update",
      "checklist-template:delete",
    ],
  },
  {
    name: "project_admin",
    permissions: [
      "workspace:read",
      "project:read",
      "project:update",
      "project-member:read",
      "project-member:invite-member",
      "project-member:remove-member",
      "project-vault:read",
      "project-vault:create",
      "project-vault:update",
      "project-vault:delete",
      "project-vault:restore",
      "project-vault:force-delete",
      "project-custom-field:read",
      "project-custom-field:create",
      "project-custom-field:update",
      "project-custom-field:delete",
      "project-custom-field:restore",
      "project-custom-field:force-delete",
      "project-status:read",
      "project-status:create",
      "project-status:update",
      "project-status:delete",
      "project-status:restore",
      "project-status:force-delete",
      "project-label:read",
      "project-label:update",
      "project-label:create",
      "project-label:delete",
      "project-label:restore",
      "project-label:force-delete",
      "project-webhook:read",
      "project-webhook:create",
      "project-webhook:update",
      "project-webhook:delete",
      "project-webhook:restore",
      "project-webhook:force-delete",
      "project-automation:read",
      "project-automation:create",
      "project-automation:update",
      "project-automation:delete",
      "project-automation:restore",
      "project-automation:force-delete",
      "project-epic:read",
      "project-epic:create",
      "project-epic:update",
      "project-epic:delete",
      "project-epic:restore",
      "project-epic:force-delete",
      "project-milestone:read",
      "project-milestone:create",
      "project-milestone:update",
      "project-milestone:delete",
      "project-milestone:restore",
      "project-milestone:force-delete",
      "task:read",
      "task:create",
      "task:update",
      "task:delete",
      "task:restore",
      "task:force-delete",
      "task:comment",
      "task:delete-own-comment",
      "task:delete-any-comment",
      "member:read",
      "goal-okrs:read",
      "goal-okrs:create",
      "goal-okrs:update",
      "goal-okrs:delete",
      "goal-okrs:restore",
      "goal-okrs:force-delete",
      "checklist-template:read",
      "checklist-template:create",
      "checklist-template:update",
      "checklist-template:delete",
    ],
  },
  {
    name: "member",
    permissions: [
      "workspace:read",
      "project:read",
      "project-member:read",
      "project-vault:read",
      "project-custom-field:read",
      "project-status:read",
      "project-label:read",
      "project-webhook:read",
      "project-automation:read",
      "project-epic:read",
      "project-milestone:read",
      "task:read",
      "task:create",
      "task:update",
      "task:comment",
      "task:delete-own-comment",
      "member:read",
      "goal-okrs:read",
      "checklist-template:read",
    ],
  },
  {
    name: "guest",
    permissions: [
      "workspace:read",
      "project:read",
      "task:read",
      "task:comment",
      "member:read",
    ],
  },
];

export const rbacRepository = {
  async seedOrgDefaultRoles(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    orgId: string,
  ) {
    for (const roleDef of DEFAULT_ROLES) {
      const role = await tx.role.upsert({
        where: {
          organizationId_name: {
            organizationId: orgId,
            name: roleDef.name,
          },
        },
        update: {},
        create: {
          organizationId: orgId,
          name: roleDef.name,
          isSystemDefault: true,
        },
      });

      const perms = await tx.permission.findMany({
        where: {
          OR: roleDef.permissions.map((p: string) => {
            const [resource, action] = p.split(":");
            return { resource, action };
          }),
        },
      });

      for (const p of perms) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: p.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: p.id,
          },
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

  async updateRole(
    roleId: string,
    data: {
      name?: string;
      permissionIds?: string[];
      bypassPermissions?: boolean;
    },
  ) {
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
      const rolesToAdd = data.roleIds.filter(
        (id) => !existingRoleIds.includes(id),
      );
      const rolesToRemove = existingRoleIds.filter(
        (id) => !data.roleIds.includes(id),
      );

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

      if (data.scopeType === "ORGANIZATION") {
        await syncMemberRolesToBetterAuth(data.userId, data.scopeId, tx);
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
    const res = await prisma.userRoleAssignment.deleteMany({
      where: {
        userId: data.userId,
        scopeType: data.scopeType,
        scopeId: data.scopeId,
        roleId: { in: data.roleIds },
      },
    });

    if (data.scopeType === "ORGANIZATION") {
      await syncMemberRolesToBetterAuth(data.userId, data.scopeId);
    }

    return res;
  },

  async getUserAssignments(
    userId: string,
    scopeType?: string,
    scopeId?: string,
  ) {
    return (
      prisma.userRoleAssignment?.findMany({
        where: {
          userId,
          ...(scopeType && { scopeType }),
          ...(scopeId && { scopeId }),
          role: {
            deletedAt: null,
          },
        },
        include: {
          role: true,
        },
      }) || []
    );
  },

  async getUserPermissionsInScope(
    userId: string,
    scopeType: string,
    scopeId: string,
  ) {
    const assignments =
      (await prisma.userRoleAssignment?.findMany({
        where: {
          userId,
          scopeType,
          scopeId,
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

    // Flatten permissions
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

  async hasBypassRole(
    userId: string,
    scopes: { type: string; id: string }[],
  ): Promise<boolean> {
    if (scopes.length === 0) return false;

    // Check if the user has an owner role or bypassPermissions role in any of the given scopes
    const assignments =
      (await prisma.userRoleAssignment?.findMany({
        where: {
          userId,
          OR: scopes.map((s) => ({ scopeType: s.type, scopeId: s.id })),
          role: {
            deletedAt: null,
            OR: [{ name: "owner" }, { bypassPermissions: true }],
          },
        },
      })) || [];

    return assignments.length > 0;
  },

  async isOrganizationOwner(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const ownerAssignment = await prisma.userRoleAssignment?.findFirst({
      where: {
        userId,
        scopeType: "ORGANIZATION",
        scopeId: organizationId,
        role: {
          name: "owner",
          deletedAt: null,
        },
      },
    });
    return !!ownerAssignment;
  },
};

async function syncMemberRolesToBetterAuth(
  userId: string,
  orgId: string,
  tx?: any,
) {
  const db = tx || prisma;

  // Find all active ORGANIZATION scope role assignments for this user and org
  const assignments = await db.userRoleAssignment.findMany({
    where: {
      userId,
      scopeType: "ORGANIZATION",
      scopeId: orgId,
      role: {
        deletedAt: null,
      },
    },
    include: {
      role: true,
    },
  });

  const roleNames = assignments
    .map((a: any) => a.role.name.toLowerCase())
    .join(",");

  // Update the Better Auth member record
  await db.member.updateMany({
    where: {
      userId,
      organizationId: orgId,
    },
    data: {
      role: roleNames || "member",
    },
  });
}
