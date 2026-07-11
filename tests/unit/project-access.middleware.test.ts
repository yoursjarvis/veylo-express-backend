import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  resolveSession,
  verifyWorkspaceAdmin,
  verifyProjectAccess,
  verifyProjectAdmin,
} from "@/app/http/middlewares/project-access.middleware";
import { rbacService } from "@/app/services/rbac.service";
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";

const { getSessionMock, prismaMock, betterAuthHeadersMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    prismaMock: {
      project: {
        findUnique: vi.fn(),
      },
    },
    betterAuthHeadersMock: vi.fn().mockReturnValue(new Headers()),
  }),
);

vi.mock("../../src/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("../../src/lib/prisma", () => ({
  default: prismaMock,
}));

vi.mock("../../src/lib/auth/node-headers", () => ({
  betterAuthHeaders: betterAuthHeadersMock,
}));

describe("project-access middleware utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rbacService.authorize).mockResolvedValue(true);
  });

  describe("resolveSession", () => {
    it("UT-PA-01: throws UnauthorizedException when no user is present in session", async () => {
      getSessionMock.mockResolvedValueOnce(null);
      const req: any = {};

      await expect(resolveSession(req)).rejects.toThrow(UnauthorizedException);
    });

    it("UT-PA-02: throws BadRequestException when user has no active organization", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: null },
      });
      const req: any = {};

      await expect(resolveSession(req)).rejects.toThrow(BadRequestException);
    });

    it("UT-PA-03: returns activeOrgId and userId on success", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      });
      const req: any = {};

      const result = await resolveSession(req);
      expect(result).toEqual({ activeOrgId: "org-1", userId: "user-1" });
    });
  });

  describe("verifyWorkspaceAdmin", () => {
    it("UT-WA-01: returns context if caller is an Org Owner/Admin", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      });

      const req: any = {};
      const ctx = await verifyWorkspaceAdmin(req, "ws-1");

      expect(ctx).toEqual({ activeOrgId: "org-1", userId: "user-1" });
      expect(rbacService.authorize).toHaveBeenCalledWith(
        "user-1",
        "workspace:update",
        {
          organizationId: "org-1",
          workspaceId: "ws-1",
        },
      );
    });

    it("UT-WA-02: returns context if caller is a Workspace Admin (but not Org Admin)", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      });

      const req: any = {};
      const ctx = await verifyWorkspaceAdmin(req, "ws-1");

      expect(ctx).toEqual({ activeOrgId: "org-1", userId: "user-1" });
      expect(rbacService.authorize).toHaveBeenCalledWith(
        "user-1",
        "workspace:update",
        {
          organizationId: "org-1",
          workspaceId: "ws-1",
        },
      );
    });

    it("UT-WA-03: throws ForbiddenException if caller has no admin permissions", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      });
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);

      const req: any = {};
      await expect(verifyWorkspaceAdmin(req, "ws-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("verifyProjectAccess", () => {
    it("UT-PA-04: throws NotFoundException if project does not exist", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      });
      prismaMock.project.findUnique.mockResolvedValueOnce(null);

      const req: any = {};
      await expect(verifyProjectAccess(req, "proj-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("UT-PA-05: returns context if project exists and user is Org Owner/Admin", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      });
      const project = { id: "proj-1", workspaceId: "ws-1" };
      prismaMock.project.findUnique.mockResolvedValueOnce(project);

      const req: any = {};
      const ctx = await verifyProjectAccess(req, "proj-1");

      expect(ctx).toEqual({ activeOrgId: "org-1", userId: "user-1", project });
      expect(rbacService.authorize).toHaveBeenCalledWith(
        "user-1",
        "project:read",
        {
          organizationId: "org-1",
          workspaceId: "ws-1",
          projectId: "proj-1",
        },
      );
    });

    it("UT-PA-06: returns context if project exists and user is Workspace Admin", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      });
      const project = { id: "proj-1", workspaceId: "ws-1" };
      prismaMock.project.findUnique.mockResolvedValueOnce(project);

      const req: any = {};
      const ctx = await verifyProjectAccess(req, "proj-1");

      expect(ctx).toEqual({ activeOrgId: "org-1", userId: "user-1", project });
      expect(rbacService.authorize).toHaveBeenCalledWith(
        "user-1",
        "project:read",
        {
          organizationId: "org-1",
          workspaceId: "ws-1",
          projectId: "proj-1",
        },
      );
    });

    it("UT-PA-07: returns context if project exists and user is direct Project Member", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      });
      const project = { id: "proj-1", workspaceId: "ws-1" };
      prismaMock.project.findUnique.mockResolvedValueOnce(project);

      const req: any = {};
      const ctx = await verifyProjectAccess(req, "proj-1");

      expect(ctx).toEqual({ activeOrgId: "org-1", userId: "user-1", project });
      expect(rbacService.authorize).toHaveBeenCalledWith(
        "user-1",
        "project:read",
        {
          organizationId: "org-1",
          workspaceId: "ws-1",
          projectId: "proj-1",
        },
      );
    });

    it("UT-PA-08: throws ForbiddenException if user has no project access", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      });
      const project = { id: "proj-1", workspaceId: "ws-1" };
      prismaMock.project.findUnique.mockResolvedValueOnce(project);
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);

      const req: any = {};
      await expect(verifyProjectAccess(req, "proj-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("verifyProjectAdmin", () => {
    it("UT-PA-09: throws NotFoundException if project is missing", async () => {
      prismaMock.project.findUnique.mockResolvedValueOnce(null);
      const req: any = {};
      await expect(verifyProjectAdmin(req, "proj-missing")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("UT-PA-10: verifies project admin permissions using workspace admin utility", async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: "admin-1" },
        session: { activeOrganizationId: "org-1" },
      });
      const project = { id: "proj-1", workspaceId: "ws-1" };
      prismaMock.project.findUnique.mockResolvedValueOnce(project);

      const req: any = {};
      const ctx = await verifyProjectAdmin(req, "proj-1");

      expect(ctx).toEqual({ activeOrgId: "org-1", userId: "admin-1", project });
      expect(rbacService.authorize).toHaveBeenCalledWith(
        "admin-1",
        "project:update",
        {
          organizationId: "org-1",
          workspaceId: "ws-1",
          projectId: "proj-1",
        },
      );
    });
  });
});
