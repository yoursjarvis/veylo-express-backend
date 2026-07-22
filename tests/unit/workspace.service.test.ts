import { describe, expect, it, vi, beforeEach } from "vitest";
import { workspaceService } from "../../src/app/services/workspace.service";

const { workspaceRepositoryMock } = vi.hoisted(() => ({
  workspaceRepositoryMock: {
    getWorkspacesForUser: vi.fn(),
    syncOrgAdminsToWorkspaces: vi.fn(),
    findWorkspaceBySlug: vi.fn(),
    findWorkspaceBySlugExcludeId: vi.fn(),
    createWorkspace: vi.fn(),
    findWorkspaceByIdAndOrg: vi.fn(),
    updateWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    getWorkspaceMembers: vi.fn(),
    getOrgMembersByIds: vi.fn(),
    upsertWorkspaceMember: vi.fn(),
    deleteWorkspaceMember: vi.fn(),
    restoreWorkspace: vi.fn(),
    forceDeleteWorkspace: vi.fn(),
  },
}));

const { rbacServiceMock } = vi.hoisted(() => ({
  rbacServiceMock: {
    authorize: vi.fn(),
  },
}));

vi.mock("@/app/repositories/workspace.repository", () => ({
  workspaceRepository: workspaceRepositoryMock,
}));

vi.mock("@/app/services/rbac.service", () => ({
  rbacService: rbacServiceMock,
}));

const ORG_ID = "org-1";
const USER_ID = "user-1";
const WS_ID = "ws-1";

describe("WorkspaceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWorkspaces", () => {
    it("throws BadRequestException if no active org", async () => {
      await expect(
        workspaceService.getWorkspaces(null, USER_ID),
      ).rejects.toThrow("No active organization found");
    });

    it("returns workspaces and handles sync error gracefully", async () => {
      workspaceRepositoryMock.syncOrgAdminsToWorkspaces.mockRejectedValueOnce(
        new Error("sync error"),
      );
      workspaceRepositoryMock.getWorkspacesForUser.mockResolvedValueOnce([
        { id: "ws-1" },
      ]);

      const result = await workspaceService.getWorkspaces(ORG_ID, USER_ID);
      expect(result).toHaveLength(1);
    });

    it("returns workspaces when sync succeeds", async () => {
      workspaceRepositoryMock.syncOrgAdminsToWorkspaces.mockResolvedValueOnce(
        undefined,
      );
      workspaceRepositoryMock.getWorkspacesForUser.mockResolvedValueOnce([
        { id: "ws-1" },
      ]);

      const result = await workspaceService.getWorkspaces(ORG_ID, USER_ID);
      expect(
        workspaceRepositoryMock.syncOrgAdminsToWorkspaces,
      ).toHaveBeenCalledWith(ORG_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe("createWorkspace", () => {
    it("throws BadRequestException if no active org", async () => {
      await expect(
        workspaceService.createWorkspace(null, USER_ID, {
          name: "WS",
          slug: "ws",
        }),
      ).rejects.toThrow("No active organization found");
    });

    it("throws ForbiddenException if user lacks permission", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(false);
      await expect(
        workspaceService.createWorkspace(ORG_ID, USER_ID, {
          name: "WS",
          slug: "ws",
        }),
      ).rejects.toThrow("Forbidden: You must be an organization admin");
    });

    it("throws BadRequestException if slug already exists", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.findWorkspaceBySlug.mockResolvedValueOnce({
        id: "ws-existing",
      });

      await expect(
        workspaceService.createWorkspace(ORG_ID, USER_ID, {
          name: "WS",
          slug: "existing-slug",
        }),
      ).rejects.toThrow("Workspace slug already exists");
    });

    it("creates workspace and handles sync error gracefully", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.findWorkspaceBySlug.mockResolvedValueOnce(null);
      workspaceRepositoryMock.createWorkspace.mockResolvedValueOnce({
        id: "ws-1",
      });
      workspaceRepositoryMock.syncOrgAdminsToWorkspaces.mockRejectedValueOnce(
        new Error("sync error"),
      );

      const result = await workspaceService.createWorkspace(ORG_ID, USER_ID, {
        name: "WS",
        slug: "ws-slug",
      });
      expect(result).toEqual({ id: "ws-1" });
    });

    it("creates workspace successfully with sync", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.findWorkspaceBySlug.mockResolvedValueOnce(null);
      workspaceRepositoryMock.createWorkspace.mockResolvedValueOnce({
        id: "ws-1",
      });
      workspaceRepositoryMock.syncOrgAdminsToWorkspaces.mockResolvedValueOnce(
        undefined,
      );

      const result = await workspaceService.createWorkspace(ORG_ID, USER_ID, {
        name: "WS",
        slug: "ws-slug",
      });
      expect(result).toEqual({ id: "ws-1" });
    });
  });

  describe("updateWorkspace", () => {
    it("throws ForbiddenException if user lacks permission", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(false);
      await expect(
        workspaceService.updateWorkspace(ORG_ID, USER_ID, WS_ID, {
          name: "New Name",
        }),
      ).rejects.toThrow("Forbidden");
    });

    it("throws NotFoundException if workspace not found", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.findWorkspaceByIdAndOrg.mockResolvedValueOnce(
        null,
      );

      await expect(
        workspaceService.updateWorkspace(ORG_ID, USER_ID, WS_ID, {
          name: "New Name",
        }),
      ).rejects.toThrow("Workspace not found");
    });

    it("throws BadRequestException if slug already exists on update", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.findWorkspaceByIdAndOrg.mockResolvedValueOnce({
        id: WS_ID,
      });
      workspaceRepositoryMock.findWorkspaceBySlugExcludeId.mockResolvedValueOnce(
        { id: "other-ws" },
      );

      await expect(
        workspaceService.updateWorkspace(ORG_ID, USER_ID, WS_ID, {
          slug: "taken-slug",
        }),
      ).rejects.toThrow("Workspace slug already exists");
    });

    it("updates workspace successfully without slug change", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.findWorkspaceByIdAndOrg.mockResolvedValueOnce({
        id: WS_ID,
      });
      workspaceRepositoryMock.updateWorkspace.mockResolvedValueOnce({
        id: WS_ID,
        name: "Updated",
      });

      const result = await workspaceService.updateWorkspace(
        ORG_ID,
        USER_ID,
        WS_ID,
        { name: "Updated" },
      );
      expect(result).toEqual({ id: WS_ID, name: "Updated" });
      expect(
        workspaceRepositoryMock.findWorkspaceBySlugExcludeId,
      ).not.toHaveBeenCalled();
    });

    it("updates workspace with unique slug", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.findWorkspaceByIdAndOrg.mockResolvedValueOnce({
        id: WS_ID,
      });
      workspaceRepositoryMock.findWorkspaceBySlugExcludeId.mockResolvedValueOnce(
        null,
      );
      workspaceRepositoryMock.updateWorkspace.mockResolvedValueOnce({
        id: WS_ID,
        slug: "new-slug",
      });

      const result = await workspaceService.updateWorkspace(
        ORG_ID,
        USER_ID,
        WS_ID,
        { slug: "new-slug" },
      );
      expect(result).toEqual({ id: WS_ID, slug: "new-slug" });
    });
  });

  describe("deleteWorkspace", () => {
    it("throws ForbiddenException if user lacks permission", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(false);
      await expect(
        workspaceService.deleteWorkspace(ORG_ID, USER_ID, WS_ID),
      ).rejects.toThrow("Forbidden");
    });

    it("throws NotFoundException if workspace not found", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.findWorkspaceByIdAndOrg.mockResolvedValueOnce(
        null,
      );

      await expect(
        workspaceService.deleteWorkspace(ORG_ID, USER_ID, WS_ID),
      ).rejects.toThrow("Workspace not found");
    });

    it("deletes workspace successfully", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.findWorkspaceByIdAndOrg.mockResolvedValueOnce({
        id: WS_ID,
      });
      workspaceRepositoryMock.deleteWorkspace.mockResolvedValueOnce({
        id: WS_ID,
      });

      const result = await workspaceService.deleteWorkspace(
        ORG_ID,
        USER_ID,
        WS_ID,
      );
      expect(result).toEqual({ id: WS_ID });
    });
  });

  describe("getWorkspaceMembers", () => {
    it("returns members and handles sync error gracefully", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.syncOrgAdminsToWorkspaces.mockRejectedValueOnce(
        new Error("sync"),
      );
      workspaceRepositoryMock.getWorkspaceMembers.mockResolvedValueOnce([
        { id: "m-1" },
      ]);

      const result = await workspaceService.getWorkspaceMembers(
        ORG_ID,
        USER_ID,
        WS_ID,
      );
      expect(result).toHaveLength(1);
    });

    it("returns members with successful sync", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.syncOrgAdminsToWorkspaces.mockResolvedValueOnce(
        undefined,
      );
      workspaceRepositoryMock.getWorkspaceMembers.mockResolvedValueOnce([
        { id: "m-1" },
      ]);

      const result = await workspaceService.getWorkspaceMembers(
        ORG_ID,
        USER_ID,
        WS_ID,
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("addWorkspaceMembers", () => {
    it("throws BadRequestException if userIds is empty", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      await expect(
        workspaceService.addWorkspaceMembers(ORG_ID, USER_ID, WS_ID, []),
      ).rejects.toThrow("User IDs are required");
    });

    it("throws BadRequestException if some users are not org members", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.getOrgMembersByIds.mockResolvedValueOnce([
        { id: "m-1" },
      ]); // 1 found, 2 requested

      await expect(
        workspaceService.addWorkspaceMembers(ORG_ID, USER_ID, WS_ID, [
          "user-1",
          "user-2",
        ]),
      ).rejects.toThrow(
        "One or more users are not members of this organization",
      );
    });

    it("adds all workspace members successfully", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.getOrgMembersByIds.mockResolvedValueOnce([
        { id: "m-1" },
        { id: "m-2" },
      ]);
      workspaceRepositoryMock.upsertWorkspaceMember.mockResolvedValue({
        id: "wm-1",
      });

      const result = await workspaceService.addWorkspaceMembers(
        ORG_ID,
        USER_ID,
        WS_ID,
        ["user-1", "user-2"],
      );
      expect(
        workspaceRepositoryMock.upsertWorkspaceMember,
      ).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });
  });

  describe("removeWorkspaceMember", () => {
    it("removes a workspace member", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.deleteWorkspaceMember.mockResolvedValueOnce({
        id: "wm-1",
      });

      await workspaceService.removeWorkspaceMember(
        ORG_ID,
        USER_ID,
        WS_ID,
        "user-target",
      );
      expect(
        workspaceRepositoryMock.deleteWorkspaceMember,
      ).toHaveBeenCalledWith(WS_ID, "user-target");
    });
  });

  describe("restoreWorkspace", () => {
    it("restores a workspace", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.restoreWorkspace.mockResolvedValueOnce({
        id: WS_ID,
      });

      const result = await workspaceService.restoreWorkspace(
        ORG_ID,
        USER_ID,
        WS_ID,
      );
      expect(result).toEqual({ id: WS_ID });
    });
  });

  describe("forceDeleteWorkspace", () => {
    it("force deletes a workspace", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      workspaceRepositoryMock.forceDeleteWorkspace.mockResolvedValueOnce({
        id: WS_ID,
      });

      const result = await workspaceService.forceDeleteWorkspace(
        ORG_ID,
        USER_ID,
        WS_ID,
      );
      expect(result).toEqual({ id: WS_ID });
    });
  });
});
