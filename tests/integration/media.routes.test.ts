import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import app from "@/app";

// 1. Register Global Mocks with dynamic imports to avoid ReferenceError
vi.mock("../../src/lib/auth/auth", async () => {
  const { getSessionMock } = await import("../helpers/auth");
  return {
    auth: {
      api: {
        getSession: getSessionMock,
      },
    },
  };
});

vi.mock("../../src/app/http/middlewares/rate-limit.middleware", () => ({
  rateLimit: () => (req: unknown, res: unknown, next: unknown) => next(),
}));

const { mockMediaService } = vi.hoisted(() => ({
  mockMediaService: {
    addMedia: vi.fn(),
    getUrl: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
  },
}));

vi.mock("../../src/core/media", () => ({
  mediaService: mockMediaService,
}));

import { rbacService } from "@/app/services/rbac.service";
import prisma from "@/lib/prisma";

import { setMockUser } from "../helpers/auth";
const prismaMock = prisma as unknown;
import { createUser, createProject } from "../helpers/factories";

describe("Media API Endpoint Integration Tests (/api/v1/media)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Configure default mock user/session
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }), {
      activeOrganizationId: "org-123",
    });
  });

  describe("POST /api/v1/media/avatar", () => {
    it("successfully uploads user avatar and updates user record", async () => {
      const mockMedia = { id: "media-avatar" };
      mockMediaService.addMedia.mockResolvedValueOnce(mockMedia);
      mockMediaService.getUrl.mockResolvedValueOnce(
        "http://localhost/avatars/avatar.png",
      );
      prismaMock.user.update.mockResolvedValueOnce({ id: "user-123" });

      const res = await request(app)
        .post("/api/v1/media/avatar")
        .set("Authorization", "Bearer mock-token")
        .attach("avatar", Buffer.from("dummy-avatar-content"), "avatar.png");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.media_id).toBe("media-avatar");
      expect(res.body.data.url).toBe("http://localhost/avatars/avatar.png");

      expect(mockMediaService.addMedia).toHaveBeenCalledWith(
        "User",
        "user-123",
        expect.objectContaining({
          originalname: "avatar.png",
        }),
        "avatars",
        true,
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { image: "http://localhost/avatars/avatar.png" },
      });
    });

    it("returns error response when no file is uploaded", async () => {
      const res = await request(app)
        .post("/api/v1/media/avatar")
        .set("Authorization", "Bearer mock-token");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Something went wrong");
    });
  });

  describe("POST /api/v1/media/org/logo", () => {
    it("successfully uploads organization logo for owner/admin", async () => {
      // User is Org Admin/Owner
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "member-123",
        role: "owner",
      });

      const mockMedia = { id: "media-logo" };
      mockMediaService.addMedia.mockResolvedValueOnce(mockMedia);
      mockMediaService.getUrl.mockResolvedValueOnce(
        "http://localhost/logos/logo.png",
      );

      const res = await request(app)
        .post("/api/v1/media/org/logo")
        .set("Authorization", "Bearer mock-token")
        .attach("logo", Buffer.from("dummy-logo-content"), "logo.png");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.media_id).toBe("media-logo");
      expect(res.body.data.url).toBe("http://localhost/logos/logo.png");

      expect(mockMediaService.addMedia).toHaveBeenCalledWith(
        "Organization",
        "org-123",
        expect.objectContaining({
          originalname: "logo.png",
        }),
        "logos",
        true,
      );
    });

    it("returns 403 Forbidden when member is not an owner or admin", async () => {
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);
      prismaMock.member.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/media/org/logo")
        .set("Authorization", "Bearer mock-token")
        .attach("logo", Buffer.from("dummy-logo-content"), "logo.png");

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "You do not have permission to upload logos for this organization",
      );
    });

    it("returns 400 Bad Request when there is no active organization in the session", async () => {
      setMockUser(createUser({ id: "user-123" }), {
        activeOrganizationId: null,
      });

      const res = await request(app)
        .post("/api/v1/media/org/logo")
        .set("Authorization", "Bearer mock-token")
        .attach("logo", Buffer.from("dummy-logo-content"), "logo.png");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("No active organization found");
    });
  });

  describe("POST /api/v1/media/workspace/:id/icon", () => {
    it("successfully uploads workspace icon for admin member", async () => {
      // User is workspace admin
      prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({
        id: "ws-member-123",
        role: "admin",
      });
      prismaMock.member.findFirst.mockResolvedValueOnce(null); // orgAdmin is null but workspaceMember is admin
      prismaMock.workspace.update.mockResolvedValueOnce({ id: "ws-123" });

      const mockMedia = { id: "media-ws-icon" };
      mockMediaService.addMedia.mockResolvedValueOnce(mockMedia);
      mockMediaService.getUrl.mockResolvedValueOnce(
        "http://localhost/icons/ws-icon.png",
      );

      const res = await request(app)
        .post("/api/v1/media/workspace/ws-123/icon")
        .set("Authorization", "Bearer mock-token")
        .attach("icon", Buffer.from("dummy-icon-content"), "icon.png");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prismaMock.workspace.update).toHaveBeenCalledWith({
        where: { id: "ws-123" },
        data: { icon: "http://localhost/icons/ws-icon.png" },
      });
    });

    it("returns 403 Forbidden when member is not workspace admin or org owner/admin", async () => {
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);
      prismaMock.workspaceMember.findFirst.mockResolvedValueOnce(null);
      prismaMock.member.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/media/workspace/ws-123/icon")
        .set("Authorization", "Bearer mock-token")
        .attach("icon", Buffer.from("dummy-icon-content"), "icon.png");

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "You do not have permission to upload icons for this workspace",
      );
    });
  });

  describe("POST /api/v1/media/project/:id/icon", () => {
    it("successfully uploads project icon for admin member", async () => {
      const mockProject = createProject({
        id: "proj-123",
        workspaceId: "ws-123",
      });
      prismaMock.project.findUnique.mockResolvedValueOnce(mockProject);
      prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({
        id: "ws-member-123",
        role: "admin",
      });
      prismaMock.member.findFirst.mockResolvedValueOnce(null);
      prismaMock.project.update.mockResolvedValueOnce(mockProject);

      const mockMedia = { id: "media-proj-icon" };
      mockMediaService.addMedia.mockResolvedValueOnce(mockMedia);
      mockMediaService.getUrl.mockResolvedValueOnce(
        "http://localhost/icons/proj-icon.png",
      );

      const res = await request(app)
        .post("/api/v1/media/project/proj-123/icon")
        .set("Authorization", "Bearer mock-token")
        .attach("icon", Buffer.from("dummy-icon-content"), "icon.png");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: "proj-123" },
        data: { icon: "http://localhost/icons/proj-icon.png" },
      });
    });

    it("returns 404 Project Not Found when project does not exist", async () => {
      prismaMock.project.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/media/project/non-existent/icon")
        .set("Authorization", "Bearer mock-token")
        .attach("icon", Buffer.from("dummy-icon-content"), "icon.png");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Project not found");
    });

    it("returns 403 Forbidden when user does not have permission", async () => {
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);
      const mockProject = createProject({
        id: "proj-123",
        workspaceId: "ws-123",
      });
      prismaMock.project.findUnique.mockResolvedValueOnce(mockProject);
      prismaMock.workspaceMember.findFirst.mockResolvedValueOnce(null);
      prismaMock.member.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/media/project/proj-123/icon")
        .set("Authorization", "Bearer mock-token")
        .attach("icon", Buffer.from("dummy-icon-content"), "icon.png");

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "You do not have permission to upload icons for this project",
      );
    });
  });

  describe("POST /api/v1/media/upload", () => {
    it("successfully uploads a generic file attachment", async () => {
      const mockMedia = { id: "media-attachment" };
      mockMediaService.addMedia.mockResolvedValueOnce(mockMedia);
      mockMediaService.getUrl.mockResolvedValueOnce(
        "http://localhost/attachments/attachment.pdf",
      );

      const res = await request(app)
        .post("/api/v1/media/upload")
        .set("Authorization", "Bearer mock-token")
        .attach("file", Buffer.from("dummy-file-content"), "attachment.pdf");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.media_id).toBe("media-attachment");
      expect(res.body.data.url).toBe(
        "http://localhost/attachments/attachment.pdf",
      );

      expect(mockMediaService.addMedia).toHaveBeenCalledWith(
        "User",
        "user-123",
        expect.objectContaining({
          originalname: "attachment.pdf",
        }),
        "attachments",
        false,
      );
    });
  });
});
