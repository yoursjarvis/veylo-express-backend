import { describe, it, expect, vi } from "vitest";
import { workspaceRepository } from "@/app/repositories/workspace.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("WorkspaceRepository", () => {
  it("should find workspace by id and org, by slug, and by slug exclude id", async () => {
    prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-1" });
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      id: "ws-1",
      slug: "ws-slug",
    });
    prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-2" });

    expect(
      await workspaceRepository.findWorkspaceByIdAndOrg("ws-1", "org-1"),
    ).toEqual({ id: "ws-1" });
    expect(await workspaceRepository.findWorkspaceBySlug("ws-slug")).toEqual({
      id: "ws-1",
      slug: "ws-slug",
    });
    expect(
      await workspaceRepository.findWorkspaceBySlugExcludeId("ws-slug", "ws-1"),
    ).toEqual({ id: "ws-2" });
  });

  it("should find org member, workspace member, and workspace member with org", async () => {
    prismaMock.member.findFirst.mockResolvedValueOnce({ id: "m-1" });
    prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({ id: "wm-1" });
    prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({ id: "wm-2" });

    expect(await workspaceRepository.findOrgMember("org-1", "user-1")).toEqual({
      id: "m-1",
    });
    expect(
      await workspaceRepository.findWorkspaceMember("ws-1", "user-1"),
    ).toEqual({ id: "wm-1" });
    expect(
      await workspaceRepository.findWorkspaceMemberWithOrg(
        "ws-1",
        "user-1",
        "org-1",
      ),
    ).toEqual({ id: "wm-2" });
  });

  it("should get workspaces for user", async () => {
    prismaMock.workspace.findMany.mockResolvedValueOnce([{ id: "ws-1" }]);
    const result = await workspaceRepository.getWorkspacesForUser(
      "org-1",
      "user-1",
    );
    expect(prismaMock.workspace.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should create, update, and delete workspace", async () => {
    const data = {
      name: "WS 1",
      slug: "ws-1",
      organizationId: "org-1",
      creatorUserId: "user-1",
    };
    prismaMock.workspace.create.mockResolvedValueOnce({ id: "ws-1" });
    prismaMock.workspace.update.mockResolvedValueOnce({
      id: "ws-1",
      name: "New Name",
    });
    prismaMock.workspace.delete.mockResolvedValueOnce({ id: "ws-1" });

    expect(await workspaceRepository.createWorkspace(data)).toEqual({
      id: "ws-1",
    });
    expect(
      await workspaceRepository.updateWorkspace("ws-1", { name: "New Name" }),
    ).toEqual({ id: "ws-1", name: "New Name" });
    expect(await workspaceRepository.deleteWorkspace("ws-1")).toEqual({
      id: "ws-1",
    });
  });

  it("should find by id with trashed, restore, and forceDelete workspace", async () => {
    prismaMock.workspace.findUniqueWithTrashed.mockResolvedValueOnce({
      id: "ws-1",
    });
    prismaMock.workspace.restore.mockResolvedValueOnce({ id: "ws-1" });
    prismaMock.workspace.forceDelete.mockResolvedValueOnce({ id: "ws-1" });

    expect(
      await workspaceRepository.findWorkspaceByIdWithTrashed("ws-1"),
    ).toEqual({ id: "ws-1" });
    expect(await workspaceRepository.restoreWorkspace("ws-1")).toEqual({
      id: "ws-1",
    });
    expect(await workspaceRepository.forceDeleteWorkspace("ws-1")).toEqual({
      id: "ws-1",
    });
  });

  it("should sync org admins to workspaces", async () => {
    // Case 1: No admins
    prismaMock.member.findMany.mockResolvedValueOnce([]);
    await workspaceRepository.syncOrgAdminsToWorkspaces("org-1");

    // Case 2: Admins but no workspaces
    prismaMock.member.findMany.mockResolvedValueOnce([{ userId: "user-1" }]);
    prismaMock.workspace.findMany.mockResolvedValueOnce([]);
    await workspaceRepository.syncOrgAdminsToWorkspaces("org-1");

    // Case 3: Admins and workspaces
    prismaMock.member.findMany.mockResolvedValueOnce([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    prismaMock.workspace.findMany.mockResolvedValueOnce([
      { id: "ws-1" },
      { id: "ws-2" },
    ]);
    prismaMock.workspaceMember.createMany.mockResolvedValueOnce({ count: 4 });
    await workspaceRepository.syncOrgAdminsToWorkspaces("org-1");
    expect(prismaMock.workspaceMember.createMany).toHaveBeenCalledWith({
      data: [
        { workspaceId: "ws-1", userId: "user-1", organizationId: "org-1" },
        { workspaceId: "ws-2", userId: "user-1", organizationId: "org-1" },
        { workspaceId: "ws-1", userId: "user-2", organizationId: "org-1" },
        { workspaceId: "ws-2", userId: "user-2", organizationId: "org-1" },
      ],
      skipDuplicates: true,
    });
  });

  it("should get workspace members and org members by ids", async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValueOnce([{ id: "wm-1" }]);
    prismaMock.member.findMany.mockResolvedValueOnce([{ id: "m-1" }]);

    expect(
      await workspaceRepository.getWorkspaceMembers("ws-1", "org-1"),
    ).toEqual([{ id: "wm-1" }]);
    expect(
      await workspaceRepository.getOrgMembersByIds("org-1", ["user-1"]),
    ).toEqual([{ id: "m-1" }]);
  });

  it("should upsert workspace member", async () => {
    // Case 1: Workspace not found
    prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
    await expect(
      workspaceRepository.upsertWorkspaceMember("ws-non-existent", "user-1"),
    ).rejects.toThrow("Workspace not found");

    // Case 2: Workspace exists
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    prismaMock.workspaceMember.upsert.mockResolvedValueOnce({ id: "wm-1" });

    const result = await workspaceRepository.upsertWorkspaceMember(
      "ws-1",
      "user-1",
    );
    expect(result).toEqual({ id: "wm-1" });
  });

  it("should delete workspace member", async () => {
    // Case 1: Workspace not found
    prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
    await expect(
      workspaceRepository.deleteWorkspaceMember("ws-non-existent", "user-1"),
    ).rejects.toThrow("Workspace not found");

    // Case 2: Workspace exists
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    prismaMock.workspaceMember.delete.mockResolvedValueOnce({ id: "wm-1" });

    const result = await workspaceRepository.deleteWorkspaceMember(
      "ws-1",
      "user-1",
    );
    expect(result).toEqual({ id: "wm-1" });
  });
});
