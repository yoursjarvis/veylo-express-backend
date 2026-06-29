import prisma from "@/lib/prisma";

export const rbacRepository = {
  async getPermissions() {
    return prisma.permission.findMany();
  },

  async createRole(data: {
    name: string;
    organizationId: string | null;
    isSystemDefault?: boolean;
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

  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // Delete existing
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Insert new
      const uniquePermissionIds = Array.from(new Set(permissionIds));
      if (uniquePermissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: uniquePermissionIds.map((id) => ({
            roleId,
            permissionId: id,
          })),
          skipDuplicates: true,
        });
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

  async assignRoleToUser(data: {
    userId: string;
    roleId: string;
    scopeType: string;
    scopeId: string;
  }) {
    return prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId_scopeType_scopeId: {
          userId: data.userId,
          roleId: data.roleId,
          scopeType: data.scopeType,
          scopeId: data.scopeId,
        },
      },
      update: {},
      create: data,
    });
  },

  async removeRoleFromUser(data: {
    userId: string;
    roleId: string;
    scopeType: string;
    scopeId: string;
  }) {
    return prisma.userRoleAssignment.delete({
      where: {
        userId_roleId_scopeType_scopeId: {
          userId: data.userId,
          roleId: data.roleId,
          scopeType: data.scopeType,
          scopeId: data.scopeId,
        },
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
};
