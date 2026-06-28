import { rbacRepository } from "@/app/repositories/rbac.repository";
import { BadRequestException } from "@/utils/app-error";

export const rbacService = {
  async getPermissions() {
    return rbacRepository.getPermissions();
  },

  async getOrganizationRoles(organizationId: string) {
    return rbacRepository.getRolesByOrganization(organizationId);
  },

  async createRole(data: { name: string; organizationId: string; permissionIds: string[] }) {
    const existingRoles = await rbacRepository.getRolesByOrganization(data.organizationId);
    if (existingRoles.some(r => r.name.toLowerCase() === data.name.toLowerCase())) {
      throw new BadRequestException("A role with this name already exists in the organization.");
    }

    const role = await rbacRepository.createRole({
      name: data.name,
      organizationId: data.organizationId,
    });

    if (data.permissionIds.length > 0) {
      return rbacRepository.updateRolePermissions(role.id, data.permissionIds);
    }

    return role;
  },

  async updateRole(roleId: string, permissionIds: string[]) {
    // In a real app we should verify the role belongs to the org
    return rbacRepository.updateRolePermissions(roleId, permissionIds);
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

  async assignRole(data: { userId: string; roleId: string; scopeType: "ORGANIZATION" | "PROJECT"; scopeId: string }) {
    return rbacRepository.assignRoleToUser(data);
  },

  async removeRole(data: { userId: string; roleId: string; scopeType: "ORGANIZATION" | "PROJECT"; scopeId: string }) {
    return rbacRepository.removeRoleFromUser(data);
  },

  async checkPermission(userId: string, scopeType: string, scopeId: string, requiredPermission: string): Promise<boolean> {
    const permissions = await rbacRepository.getUserPermissionsInScope(userId, scopeType, scopeId);
    return permissions.includes(requiredPermission);
  }
};
