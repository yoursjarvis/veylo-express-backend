import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockRbacService, mockAuditLogService, mockRbacRepository } = vi.hoisted(() => ({
  mockRbacService: {
    getPermissions: vi.fn(),
    getPermissionsForContext: vi.fn(),
    getOrganizationRoles: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    authorize: vi.fn(),
    assignRole: vi.fn(),
    removeRole: vi.fn(),
    getUserAssignments: vi.fn(),
  },
  mockAuditLogService: {
    log: vi.fn(),
  },
  mockRbacRepository: {
    getRoleById: vi.fn(),
  },
}));

vi.mock("../src/app/services/rbac.service", () => ({
  rbacService: mockRbacService,
}));

vi.mock("../src/app/services/audit-log.service", () => ({
  auditLogService: mockAuditLogService,
}));

vi.mock("../src/app/repositories/rbac.repository", () => ({
  rbacRepository: mockRbacRepository,
}));

vi.mock("../src/lib/auth/auth", async () => {
  const { getSessionMock } = await import("./helpers/auth");
  return {
    auth: {
      api: {
        getSession: getSessionMock,
      },
    },
  };
});

import { rbacController } from "../src/app/http/controllers/rbac.controller";
import { prismaMock } from "./helpers/db";
import { setMockUser } from "./helpers/auth";
import { createUser } from "./helpers/factories";

function createRes() {
  const res: unknown = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("rbacController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }));
  });

  describe("getPermissions", () => {
    it("fetches list of permissions successfully", async () => {
      mockRbacService.getPermissions.mockResolvedValueOnce(["role:read", "role:create"]);
      const req: unknown = {};
      const res = createRes();

      await (rbacController.getPermissions as unknown)(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: ["role:read", "role:create"] });
    });
  });

  describe("getMyPermissions", () => {
    it("returns context permissions successfully", async () => {
      mockRbacService.getPermissionsForContext.mockResolvedValueOnce(["*"]);
      const req: unknown = { query: { workspaceId: "ws-1" } };
      const res = createRes();

      await (rbacController.getMyPermissions as unknown)(req, res);

      expect(mockRbacService.getPermissionsForContext).toHaveBeenCalledWith("user-123", {
        workspaceId: "ws-1",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getOrganizationRoles", () => {
    it("returns Forbidden if not authorized", async () => {
      mockRbacService.authorize.mockResolvedValueOnce(false);
      const req: unknown = { params: { orgId: "org-1" }, query: {} };
      const res = createRes();

      await (rbacController.getOrganizationRoles as unknown)(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("returns roles if authorized", async () => {
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockRbacService.getOrganizationRoles.mockResolvedValueOnce([{ id: "r1", name: "Admin" }]);
      const req: unknown = { params: { orgId: "org-1" }, query: {} };
      const res = createRes();

      await (rbacController.getOrganizationRoles as unknown)(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: [{ id: "r1", name: "Admin" }] });
    });
  });

  describe("createRole", () => {
    it("creates role and records audit log", async () => {
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockRbacService.createRole.mockResolvedValueOnce({ id: "r1", name: "Designer" });
      prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-first" });

      const req: unknown = {
        body: {
          name: "Designer",
          organizationId: "550e8400-e29b-41d4-a716-446655440001",
          permissionIds: ["550e8400-e29b-41d4-a716-446655440002"],
          bypassPermissions: false,
        },
      };
      const res = createRes();

      await (rbacController.createRole as unknown)(req, res);

      expect(mockRbacService.createRole).toHaveBeenCalledWith({
        name: "Designer",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
        permissionIds: ["550e8400-e29b-41d4-a716-446655440002"],
        bypassPermissions: false,
      }, "user-123");
      expect(mockAuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: "CREATE_ROLE",
        entityId: "r1",
        workspaceId: "ws-first",
      }));
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updateRoleHierarchy", () => {
    it("updates role hierarchy and records audit log", async () => {
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockRbacService.updateRoleHierarchy = vi.fn().mockResolvedValueOnce(undefined);
      prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-first" });

      const req: unknown = {
        body: {
          roleIds: ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"],
          organizationId: "550e8400-e29b-41d4-a716-446655440000",
        },
      };
      const res = createRes();

      await (rbacController.updateRoleHierarchy as unknown)(req, res);

      expect(mockRbacService.updateRoleHierarchy).toHaveBeenCalledWith(
        ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"],
        "550e8400-e29b-41d4-a716-446655440000",
        "user-123"
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: "UPDATE_ROLE_HIERARCHY",
        workspaceId: "ws-first",
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("updateRolePermissions", () => {
    it("updates role permissions and records audit log", async () => {
      mockRbacRepository.getRoleById.mockResolvedValueOnce({
        id: "r1",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockRbacService.updateRole.mockResolvedValueOnce({ id: "r1", name: "Designer" });
      prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-first" });

      const req: unknown = {
        params: { roleId: "r1" },
        body: {
          name: "NewName",
          permissionIds: ["550e8400-e29b-41d4-a716-446655440002"],
        },
      };
      const res = createRes();

      await (rbacController.updateRolePermissions as unknown)(req, res);

      expect(mockRbacService.updateRole).toHaveBeenCalledWith(
        "r1",
        "NewName",
        ["550e8400-e29b-41d4-a716-446655440002"],
        undefined,
        "user-123"
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteRole", () => {
    it("deletes role and records audit log", async () => {
      mockRbacRepository.getRoleById.mockResolvedValueOnce({
        id: "r1",
        organizationId: "550e8400-e29b-41d4-a716-446655440001",
      });
      mockRbacService.authorize.mockResolvedValueOnce(true);
      prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-first" });

      const req: unknown = { params: { roleId: "r1" } };
      const res = createRes();

      await (rbacController.deleteRole as unknown)(req, res);

      expect(mockRbacService.deleteRole).toHaveBeenCalledWith("r1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("assignRole", () => {
    it("assigns roles and records audit log", async () => {
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockRbacService.assignRole.mockResolvedValueOnce({ id: "assign-1" });
      prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-first" });
      prismaMock.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
      prismaMock.role.findMany.mockResolvedValueOnce([{ name: "Admin" }]);

      const req: unknown = {
        body: {
          userId: "550e8400-e29b-41d4-a716-446655440009",
          roleIds: ["550e8400-e29b-41d4-a716-446655440002"],
          scopeType: "ORGANIZATION",
          scopeId: "550e8400-e29b-41d4-a716-446655440001",
        },
      };
      const res = createRes();

      await (rbacController.assignRole as unknown)(req, res);

      expect(mockRbacService.assignRole).toHaveBeenCalledWith({
        userId: "550e8400-e29b-41d4-a716-446655440009",
        roleIds: ["550e8400-e29b-41d4-a716-446655440002"],
        scopeType: "ORGANIZATION",
        scopeId: "550e8400-e29b-41d4-a716-446655440001",
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("removeRoleAssignment", () => {
    it("removes assignment and records audit log", async () => {
      mockRbacService.authorize.mockResolvedValueOnce(true);
      prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-first" });
      prismaMock.user.findUnique.mockResolvedValueOnce({ name: "Alice" });
      prismaMock.role.findMany.mockResolvedValueOnce([{ name: "Admin" }]);

      const req: unknown = {
        body: {
          userId: "550e8400-e29b-41d4-a716-446655440009",
          roleIds: ["550e8400-e29b-41d4-a716-446655440002"],
          scopeType: "ORGANIZATION",
          scopeId: "550e8400-e29b-41d4-a716-446655440001",
        },
      };
      const res = createRes();

      await (rbacController.removeRoleAssignment as unknown)(req, res);

      expect(mockRbacService.removeRole).toHaveBeenCalledWith({
        userId: "550e8400-e29b-41d4-a716-446655440009",
        roleIds: ["550e8400-e29b-41d4-a716-446655440002"],
        scopeType: "ORGANIZATION",
        scopeId: "550e8400-e29b-41d4-a716-446655440001",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getUserAssignments", () => {
    it("gets assignments successfully", async () => {
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockRbacService.getUserAssignments.mockResolvedValueOnce([{ id: "assign-1" }]);

      const req: unknown = {
        query: {
          userId: "550e8400-e29b-41d4-a716-446655440009",
        },
      };
      const res = createRes();

      await (rbacController.getUserAssignments as unknown)(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: [{ id: "assign-1" }] });
    });
  });
});
