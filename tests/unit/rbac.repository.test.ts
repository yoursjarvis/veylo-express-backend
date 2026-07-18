import { describe, it, expect, vi } from "vitest";
import { rbacRepository } from "@/app/repositories/rbac.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("RbacRepository", () => {
  it("should seed organization default roles via transaction", async () => {
    const mockTx = {
      role: {
        upsert: vi.fn().mockResolvedValue({ id: "role-1" }),
      },
      permission: {
        findMany: vi.fn().mockResolvedValue([{ id: "perm-1", resource: "workspace", action: "read" }]),
      },
      rolePermission: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    await rbacRepository.seedOrgDefaultRoles(mockTx as any, "org-1");
    expect(mockTx.role.upsert).toHaveBeenCalled();
    expect(mockTx.permission.findMany).toHaveBeenCalled();
    expect(mockTx.rolePermission.upsert).toHaveBeenCalled();
  });

  it("should get permissions", async () => {
    prismaMock.permission.findMany.mockResolvedValueOnce([{ id: "perm-1" }]);
    const result = await rbacRepository.getPermissions();
    expect(result).toHaveLength(1);
  });

  it("should create role", async () => {
    const data = { name: "custom-role", organizationId: "org-1" };
    prismaMock.role.create.mockResolvedValueOnce({ id: "role-1", ...data });
    const result = await rbacRepository.createRole(data);
    expect(result.id).toBe("role-1");
  });

  it("should get roles by organization", async () => {
    prismaMock.role.findMany.mockResolvedValueOnce([{ id: "role-1" }]);
    const result = await rbacRepository.getRolesByOrganization("org-1");
    expect(result).toHaveLength(1);
  });

  it("should update role (bypassPermissions, name, permissions)", async () => {
    prismaMock.role.update.mockResolvedValue({ id: "role-1" });
    prismaMock.rolePermission.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.rolePermission.createMany.mockResolvedValue({ count: 2 });
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-1" });

    // Call updateRole which uses $transaction internally
    const result = await rbacRepository.updateRole("role-1", {
      name: "updated-role",
      bypassPermissions: true,
      permissionIds: ["perm-1", "perm-2"],
    });

    expect(prismaMock.role.update).toHaveBeenCalled();
    expect(prismaMock.rolePermission.deleteMany).toHaveBeenCalled();
    expect(prismaMock.rolePermission.createMany).toHaveBeenCalled();
    expect(result?.id).toBe("role-1");
  });

  it("should delete role", async () => {
    prismaMock.userRoleAssignment.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.rolePermission.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.role.delete.mockResolvedValue({ id: "role-1" });

    const result = await rbacRepository.deleteRole("role-1");
    expect(result?.id).toBe("role-1");
  });

  it("should assign roles to user (ORGANIZATION)", async () => {
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([{ roleId: "role-existing" }]);
    prismaMock.userRoleAssignment.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.userRoleAssignment.createMany.mockResolvedValue({ count: 1 });
    prismaMock.member.updateMany.mockResolvedValue({ count: 1 });
    // For syncMemberRolesToBetterAuth
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([{ roleId: "role-1", role: { name: "admin" } }]);
    // For return value
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([{ roleId: "role-1" }]);

    const result = await rbacRepository.assignRolesToUser({
      userId: "user-1",
      roleIds: ["role-1"],
      scopeType: "ORGANIZATION",
      scopeId: "org-1",
    });

    expect(prismaMock.userRoleAssignment.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should assign roles to user (PROJECT)", async () => {
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([]);
    prismaMock.project.findUnique.mockResolvedValueOnce({ organizationId: "org-1" });
    prismaMock.userRoleAssignment.createMany.mockResolvedValue({ count: 1 });
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([{ roleId: "role-1" }]);

    const result = await rbacRepository.assignRolesToUser({
      userId: "user-1",
      roleIds: ["role-1"],
      scopeType: "PROJECT",
      scopeId: "proj-1",
    });

    expect(prismaMock.project.findUnique).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should throw error if project not found during assign", async () => {
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([]);
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    await expect(
      rbacRepository.assignRolesToUser({
        userId: "user-1",
        roleIds: ["role-1"],
        scopeType: "PROJECT",
        scopeId: "proj-non-existent",
      })
    ).rejects.toThrow("Project not found");
  });

  it("should remove roles from user (ORGANIZATION)", async () => {
    prismaMock.userRoleAssignment.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([{ role: { name: "member" } }]);
    prismaMock.member.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await rbacRepository.removeRolesFromUser({
      userId: "user-1",
      roleIds: ["role-1"],
      scopeType: "ORGANIZATION",
      scopeId: "org-1",
    });

    expect(result.count).toBe(1);
    expect(prismaMock.member.updateMany).toHaveBeenCalled();
  });

  it("should remove roles from user (PROJECT)", async () => {
    prismaMock.userRoleAssignment.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await rbacRepository.removeRolesFromUser({
      userId: "user-1",
      roleIds: ["role-1"],
      scopeType: "PROJECT",
      scopeId: "proj-1",
    });

    expect(result.count).toBe(1);
  });

  it("should get user assignments", async () => {
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([{ id: "assign-1" }]);
    const result = await rbacRepository.getUserAssignments("user-1", "ORGANIZATION", "org-1");
    expect(result).toHaveLength(1);
  });

  it("should get user permissions in scope", async () => {
    const assignments = [
      {
        role: {
          permissions: [
            {
              permission: {
                resource: "workspace",
                action: "read",
                deletedAt: null,
              },
            },
          ],
        },
      },
    ];
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce(assignments);

    const result = await rbacRepository.getUserPermissionsInScope("user-1", "ORGANIZATION", "org-1");
    expect(result).toContain("workspace:read");
  });

  it("should check if user has bypass role", async () => {
    prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([{ id: "assign-1" }]);
    
    // Case empty scopes
    expect(await rbacRepository.hasBypassRole("user-1", [])).toBe(false);

    // Case scopes given
    expect(await rbacRepository.hasBypassRole("user-1", [{ type: "ORGANIZATION", id: "org-1" }])).toBe(true);
  });

  it("should check if user is organization owner", async () => {
    prismaMock.userRoleAssignment.findFirst.mockResolvedValueOnce({ id: "assign-1" });
    const result = await rbacRepository.isOrganizationOwner("user-1", "org-1");
    expect(result).toBe(true);
  });
});
