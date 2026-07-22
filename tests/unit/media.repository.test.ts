import { describe, it, expect } from "vitest";
import { mediaRepository } from "@/app/repositories/media.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("MediaRepository", () => {
  it("should update user avatar", async () => {
    prismaMock.user.update.mockResolvedValueOnce({
      id: "user-1",
      image: "avatar-url",
    });
    const result = await mediaRepository.updateUserAvatar(
      "user-1",
      "avatar-url",
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { image: "avatar-url" },
    });
    expect(result.image).toBe("avatar-url");
  });

  it("should find org member", async () => {
    prismaMock.member.findFirst.mockResolvedValueOnce({
      id: "member-1",
      userId: "user-1",
      organizationId: "org-1",
    });
    const result = await mediaRepository.findOrgMember("org-1", "user-1");
    expect(prismaMock.member.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-1", userId: "user-1" },
    });
    expect(result?.id).toBe("member-1");
  });

  it("should find workspace member", async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({
      id: "ws-member-1",
    });
    const result = await mediaRepository.findWorkspaceMember(
      "ws-1",
      "user-1",
      "org-1",
    );
    expect(prismaMock.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        userId: "user-1",
        workspace: { organizationId: "org-1" },
      },
    });
    expect(result?.id).toBe("ws-member-1");
  });

  it("should find project by id", async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: "proj-1" });
    const result = await mediaRepository.findProjectById("proj-1");
    expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
      where: { id: "proj-1" },
    });
    expect(result?.id).toBe("proj-1");
  });

  it("should update workspace icon", async () => {
    prismaMock.workspace.update.mockResolvedValueOnce({
      id: "ws-1",
      icon: "icon-url",
    });
    const result = await mediaRepository.updateWorkspaceIcon(
      "ws-1",
      "icon-url",
    );
    expect(prismaMock.workspace.update).toHaveBeenCalledWith({
      where: { id: "ws-1" },
      data: { icon: "icon-url" },
    });
    expect(result.icon).toBe("icon-url");
  });

  it("should update project icon", async () => {
    prismaMock.project.update.mockResolvedValueOnce({
      id: "proj-1",
      icon: "icon-url",
    });
    const result = await mediaRepository.updateProjectIcon(
      "proj-1",
      "icon-url",
    );
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: "proj-1" },
      data: { icon: "icon-url" },
    });
    expect(result.icon).toBe("icon-url");
  });
});
