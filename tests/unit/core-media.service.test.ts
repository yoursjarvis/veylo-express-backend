import { describe, it, expect, vi, beforeEach } from "vitest";
import { mediaService } from "@/core/media/media.service";
import { prismaMock } from "../../tests/helpers/db";

// Mock fs/promises and config with hoisting
const { fsMock, configMock, mediaQueueAddMock } = vi.hoisted(() => {
  return {
    fsMock: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
    },
    configMock: vi.fn(),
    mediaQueueAddMock: vi.fn(),
  };
});

vi.mock("fs/promises", () => ({
  default: fsMock,
}));

vi.mock("@/utils/config", () => ({
  config: configMock,
}));

vi.mock("@/app/queues/media.queue", () => ({
  mediaQueue: {
    add: mediaQueueAddMock,
  },
}));

describe("Core MediaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should add media with replace option, writing to local disk, and queueing a process job", async () => {
    // Config: local storage
    configMock.mockImplementation((key: string) => {
      if (key === "storage.default") return "local";
      if (key === "storage.disks.local.root") return "storage/app";
      return undefined;
    });

    // Mock existing media for replace
    prismaMock.media.findMany.mockResolvedValueOnce([{ id: "existing-1" }]);
    // Mock delete media calls inside replace
    prismaMock.media.findUnique.mockResolvedValueOnce({
      id: "existing-1",
      disk: "local",
      modelType: "User",
      collectionName: "avatars",
      fileName: "ex.png",
      generatedConversions: { thumb: { fileName: "ex-thumb.png" } },
    });
    prismaMock.media.delete.mockResolvedValue({ id: "existing-1" });

    // Mock target media creation
    const createdMedia = { id: "new-media-1", disk: "local", modelType: "User", collectionName: "avatars" };
    prismaMock.media.create.mockResolvedValueOnce(createdMedia);

    const file = {
      buffer: Buffer.from("data"),
      originalname: "test.png",
      mimetype: "image/png",
      size: 100,
    };

    const result = await mediaService.addMedia("User", "user-1", file, "avatars", true);

    expect(prismaMock.media.findMany).toHaveBeenCalled();
    expect(fsMock.unlink).toHaveBeenCalled(); // from deleting existing-1 and its conversions
    expect(fsMock.mkdir).toHaveBeenCalled();
    expect(fsMock.writeFile).toHaveBeenCalled();
    expect(prismaMock.media.create).toHaveBeenCalled();
    expect(mediaQueueAddMock).toHaveBeenCalledWith("process", { mediaId: "new-media-1" });
    expect(result.id).toBe("new-media-1");
  });

  it("should fail if disk type is not local", async () => {
    configMock.mockImplementation((key: string) => {
      if (key === "storage.default") return "s3";
      return undefined;
    });

    const file = {
      buffer: Buffer.from("data"),
      originalname: "test.png",
      mimetype: "image/png",
      size: 100,
    };

    await expect(
      mediaService.addMedia("User", "user-1", file, "avatars", false)
    ).rejects.toThrow("Disk s3 not implemented yet");
  });

  it("should list media", async () => {
    prismaMock.media.findMany.mockResolvedValueOnce([{ id: "media-1" }]);
    const result = await mediaService.getMedia("User", "user-1", "avatars");
    expect(result).toHaveLength(1);
  });

  it("should delete media from local disk and database", async () => {
    prismaMock.media.findUnique.mockResolvedValueOnce({
      id: "media-1",
      disk: "local",
      modelType: "User",
      collectionName: "avatars",
      fileName: "test.png",
      generatedConversions: null,
    });
    prismaMock.media.delete.mockResolvedValueOnce({ id: "media-1" });
    configMock.mockReturnValue("storage/app");

    await mediaService.deleteMedia("media-1");

    expect(fsMock.unlink).toHaveBeenCalled();
    expect(prismaMock.media.delete).toHaveBeenCalled();
  });

  it("should delete media gracefully when file is not found on disk", async () => {
    prismaMock.media.findUnique.mockResolvedValueOnce({
      id: "media-1",
      disk: "local",
      modelType: "User",
      collectionName: "avatars",
      fileName: "test.png",
      generatedConversions: null,
    });
    fsMock.unlink.mockRejectedValueOnce(new Error("File not found"));
    prismaMock.media.delete.mockResolvedValueOnce({ id: "media-1" });

    await mediaService.deleteMedia("media-1");
    expect(prismaMock.media.delete).toHaveBeenCalled();
  });

  it("should generate URL for local disk and return null for others", async () => {
    configMock.mockReturnValue("https://cdn.example.com");

    const localUrl = mediaService.generateUrl({
      disk: "local",
      modelType: "User",
      collectionName: "avatars",
      fileName: "test.png",
    });
    expect(localUrl).toBe("https://cdn.example.com/User/avatars/test.png");

    const nonLocalUrl = mediaService.generateUrl({
      disk: "s3",
      modelType: "User",
      collectionName: "avatars",
      fileName: "test.png",
    });
    expect(nonLocalUrl).toBeNull();
  });

  it("should get URL from media ID", async () => {
    // Case 1: Media not found
    prismaMock.media.findUnique.mockResolvedValueOnce(null);
    expect(await mediaService.getUrl("media-1")).toBeNull();

    // Case 2: Media exists
    prismaMock.media.findUnique.mockResolvedValueOnce({
      disk: "local",
      modelType: "User",
      collectionName: "avatars",
      fileName: "test.png",
    });
    configMock.mockReturnValue("https://cdn.example.com");
    expect(await mediaService.getUrl("media-1")).toBe("https://cdn.example.com/User/avatars/test.png");
  });
});
