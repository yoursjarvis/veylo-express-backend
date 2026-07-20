import { describe, it, expect, vi, beforeEach } from "vitest";
import { mediaService } from "@/app/services/media.service";
import { mediaService as coreMediaService } from "@/core/media";
import { mediaRepository } from "@/app/repositories/media.repository";
import { rbacService } from "@/app/services/rbac.service";
import { prismaMock } from "../../tests/helpers/db";

// Mock coreMediaService functions
vi.mock("@/core/media", () => ({
  mediaService: {
    addMedia: vi.fn(),
    getUrl: vi.fn(),
  },
}));

// Mock mediaRepository functions
vi.mock("@/app/repositories/media.repository", () => ({
  mediaRepository: {
    updateUserAvatar: vi.fn(),
    findOrgMember: vi.fn(),
    findWorkspaceMember: vi.fn(),
    findProjectById: vi.fn(),
    updateWorkspaceIcon: vi.fn(),
    updateProjectIcon: vi.fn(),
  },
}));

describe("App MediaService", () => {
  const mockFile = {
    buffer: Buffer.from("data"),
    originalname: "test.png",
    mimetype: "image/png",
    size: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default authorized responses
    vi.mocked(rbacService.authorize).mockResolvedValue(true);
  });

  it("should upload avatar successfully", async () => {
    vi.mocked(coreMediaService.addMedia).mockResolvedValueOnce({ id: "media-1" } as unknown);
    vi.mocked(coreMediaService.getUrl).mockResolvedValueOnce("https://cdn.com/avatar.png");
    vi.mocked(mediaRepository.updateUserAvatar).mockResolvedValueOnce({} as unknown);

    const result = await mediaService.uploadAvatar("user-1", mockFile);

    expect(coreMediaService.addMedia).toHaveBeenCalledWith("User", "user-1", mockFile, "avatars", true);
    expect(mediaRepository.updateUserAvatar).toHaveBeenCalledWith("user-1", "https://cdn.com/avatar.png");
    expect(result).toEqual({ media_id: "media-1", url: "https://cdn.com/avatar.png" });
  });

  it("should throw error if avatar URL generation fails", async () => {
    vi.mocked(coreMediaService.addMedia).mockResolvedValueOnce({ id: "media-1" } as unknown);
    vi.mocked(coreMediaService.getUrl).mockResolvedValueOnce(null);

    await expect(mediaService.uploadAvatar("user-1", mockFile)).rejects.toThrow("Failed to generate avatar URL");
  });

  it("should upload org logo if authorized", async () => {
    vi.mocked(coreMediaService.addMedia).mockResolvedValueOnce({ id: "media-1" } as unknown);
    vi.mocked(coreMediaService.getUrl).mockResolvedValueOnce("https://cdn.com/logo.png");

    const result = await mediaService.uploadOrgLogo("user-1", "org-1", mockFile);
    expect(result.media_id).toBe("media-1");
  });

  it("should throw ForbiddenException if uploading org logo is unauthorized", async () => {
    vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);

    await expect(
      mediaService.uploadOrgLogo("user-1", "org-1", mockFile)
    ).rejects.toThrow("You do not have permission to upload logos for this organization");
  });

  it("should upload workspace icon if authorized", async () => {
    vi.mocked(coreMediaService.addMedia).mockResolvedValueOnce({ id: "media-1" } as unknown);
    vi.mocked(coreMediaService.getUrl).mockResolvedValueOnce("https://cdn.com/icon.png");

    const result = await mediaService.uploadWorkspaceIcon("ws-1", "user-1", "org-1", mockFile);
    expect(result.media_id).toBe("media-1");
    expect(mediaRepository.updateWorkspaceIcon).toHaveBeenCalled();
  });

  it("should throw ForbiddenException if uploading workspace icon is unauthorized", async () => {
    vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);

    await expect(
      mediaService.uploadWorkspaceIcon("ws-1", "user-1", "org-1", mockFile)
    ).rejects.toThrow("You do not have permission to upload icons for this workspace");
  });

  it("should upload project icon if authorized", async () => {
    vi.mocked(mediaRepository.findProjectById).mockResolvedValueOnce({ id: "proj-1", workspaceId: "ws-1" } as unknown);
    vi.mocked(coreMediaService.addMedia).mockResolvedValueOnce({ id: "media-1" } as unknown);
    vi.mocked(coreMediaService.getUrl).mockResolvedValueOnce("https://cdn.com/icon.png");

    const result = await mediaService.uploadProjectIcon("proj-1", "user-1", "org-1", mockFile);
    expect(result.media_id).toBe("media-1");
    expect(mediaRepository.updateProjectIcon).toHaveBeenCalled();
  });

  it("should throw NotFoundException if project is missing during project icon upload", async () => {
    vi.mocked(mediaRepository.findProjectById).mockResolvedValueOnce(null);

    await expect(
      mediaService.uploadProjectIcon("proj-1", "user-1", "org-1", mockFile)
    ).rejects.toThrow("Project not found");
  });

  it("should throw ForbiddenException if project icon upload is unauthorized", async () => {
    vi.mocked(mediaRepository.findProjectById).mockResolvedValueOnce({ id: "proj-1", workspaceId: "ws-1" } as unknown);
    vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);

    await expect(
      mediaService.uploadProjectIcon("proj-1", "user-1", "org-1", mockFile)
    ).rejects.toThrow("You do not have permission to upload icons for this project");
  });

  it("should upload file attachments", async () => {
    vi.mocked(coreMediaService.addMedia).mockResolvedValueOnce({ id: "media-1" } as unknown);
    vi.mocked(coreMediaService.getUrl).mockResolvedValueOnce("https://cdn.com/file.png");

    const result = await mediaService.uploadFile("user-1", mockFile);
    expect(result.media_id).toBe("media-1");
  });

  it("should upload file versions and calculate correct next version number", async () => {
    prismaMock.media.findUnique.mockResolvedValueOnce({
      id: "parent-1",
      modelType: "Project",
      modelId: "proj-1",
      collectionName: "docs",
    });
    prismaMock.media.findFirst.mockResolvedValueOnce({ version: 2 });
    vi.mocked(coreMediaService.addMedia).mockResolvedValueOnce({ id: "version-2" } as unknown);
    prismaMock.media.update.mockResolvedValueOnce({ id: "version-2", version: 3, name: "test-v3.png" });
    vi.mocked(coreMediaService.getUrl).mockResolvedValueOnce("https://cdn.com/v3.png");

    const result = await mediaService.uploadVersion("parent-1", mockFile);
    expect(result.version).toBe(3);
    expect(result.url).toBe("https://cdn.com/v3.png");
  });

  it("should throw NotFoundException if parent version file is missing", async () => {
    prismaMock.media.findUnique.mockResolvedValueOnce(null);

    await expect(
      mediaService.uploadVersion("parent-missing", mockFile)
    ).rejects.toThrow("Parent file not found");
  });

  it("should manage annotations (create, get, delete)", async () => {
    // Create Annotation
    prismaMock.media.findUnique.mockResolvedValueOnce({ id: "media-1" });
    prismaMock.annotation.create.mockResolvedValueOnce({ id: "ann-1" });

    const ann = await mediaService.createAnnotation({
      mediaId: "media-1",
      userId: "user-1",
      x: 10,
      y: 20,
      content: "Nice comment",
    });
    expect(ann.id).toBe("ann-1");

    // Create Annotation - missing media
    prismaMock.media.findUnique.mockResolvedValueOnce(null);
    await expect(
      mediaService.createAnnotation({
        mediaId: "media-missing",
        userId: "user-1",
        x: 10,
        y: 20,
        content: "Nice comment",
      })
    ).rejects.toThrow("Media not found");

    // Get Annotations
    prismaMock.annotation.findMany.mockResolvedValueOnce([{ id: "ann-1" }]);
    expect(await mediaService.getAnnotations("media-1")).toHaveLength(1);

    // Delete Annotation
    prismaMock.annotation.findUnique.mockResolvedValueOnce({ id: "ann-1", userId: "user-1" });
    prismaMock.annotation.delete.mockResolvedValueOnce({ id: "ann-1" });
    await mediaService.deleteAnnotation("ann-1", "user-1");
    expect(prismaMock.annotation.delete).toHaveBeenCalled();

    // Delete Annotation - missing
    prismaMock.annotation.findUnique.mockResolvedValueOnce(null);
    await expect(mediaService.deleteAnnotation("ann-missing", "user-1")).rejects.toThrow("Annotation not found");

    // Delete Annotation - forbidden
    prismaMock.annotation.findUnique.mockResolvedValueOnce({ id: "ann-1", userId: "user-other" });
    await expect(mediaService.deleteAnnotation("ann-1", "user-1")).rejects.toThrow("You cannot delete other user's annotation");
  });
});
