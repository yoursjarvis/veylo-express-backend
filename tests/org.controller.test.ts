import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockGetSession, prismaMock, mockMediaService } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      create: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation((cb) => cb(prismaMock)),
  },
  mockMediaService: {
    addMedia: vi.fn(),
    getUrl: vi.fn(),
  },
}));

vi.mock("../src/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("../src/lib/auth/node-headers", () => ({
  betterAuthHeaders: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
  basePrisma: prismaMock,
}));
vi.mock("../src/core/media/media.service", () => ({
  mediaService: mockMediaService,
}));
vi.mock("../src/lib/redis", () => ({
  redis: {
    del: vi.fn().mockResolvedValue(1),
  },
}));

import { orgController } from "../src/app/http/controllers/org.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("orgController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setupOrganization", () => {
    it("returns 401 Unauthorized if no active user session is found", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const req: any = {
        body: { name: "Org Name", slug: "slug1", workspaceName: "ws1" },
      };
      const res = createRes();

      await (orgController.setupOrganization as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    });

    it("returns 401 Unauthorized if session is stale in DB", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.session.findUnique.mockResolvedValueOnce(null);

      const req: any = {
        body: { name: "Org Name", slug: "slug1", workspaceName: "ws1" },
      };
      const res = createRes();

      await expect(
        (orgController.setupOrganization as any)(req, res),
      ).rejects.toThrow(
        "Unauthorized: Session is stale or invalid in the database. Please log out and log in again.",
      );
    });

    it("returns 400 Bad Request if user already owns an org", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u1" });
      prismaMock.session.findUnique.mockResolvedValueOnce({ id: "s1" });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "mem1",
        role: "owner",
      });

      const req: any = {
        body: { name: "Org Name", slug: "slug1", workspaceName: "ws1" },
      };
      const res = createRes();

      await expect(
        (orgController.setupOrganization as any)(req, res),
      ).rejects.toThrow("You have already created an organization.");
    });

    it("returns 400 Bad Request if slug is already taken", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { id: "s1" },
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u1" });
      prismaMock.session.findUnique.mockResolvedValueOnce({ id: "s1" });
      prismaMock.member.findFirst.mockResolvedValueOnce(null);
      prismaMock.organization.findUnique.mockResolvedValueOnce({
        id: "org1",
        slug: "slug1",
      });

      const req: any = {
        body: { name: "Org Name", slug: "slug1", workspaceName: "ws1" },
      };
      const res = createRes();

      await expect(
        (orgController.setupOrganization as any)(req, res),
      ).rejects.toThrow("This URL slug is already taken.");
    });

    it("successfully creates organization, workspace, and owner member", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { id: "s1", token: "tok1" },
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u1" });
      prismaMock.session.findUnique.mockResolvedValueOnce({ id: "s1" });
      prismaMock.member.findFirst.mockResolvedValueOnce(null);
      prismaMock.organization.findUnique.mockResolvedValueOnce(null);

      const createdOrg = {
        id: "org-new",
        name: "New Org",
        slug: "new-org",
        logo: null,
      };
      const createdWorkspace = { id: "ws-new", name: "New Ws", slug: "new-ws" };

      prismaMock.organization.create.mockResolvedValueOnce(createdOrg);
      prismaMock.member.create.mockResolvedValueOnce({ id: "mem-new" });
      prismaMock.workspace.create.mockResolvedValueOnce(createdWorkspace);
      prismaMock.session.update.mockResolvedValueOnce({ id: "s1" });

      const req: any = {
        body: { name: "New Org", slug: "new-org", workspaceName: "New Ws" },
      };
      const res = createRes();

      await (orgController.setupOrganization as any)(req, res);

      expect(prismaMock.organization.create).toHaveBeenCalledWith({
        data: { name: "New Org", slug: "new-org", logo: null },
      });
      expect(prismaMock.workspace.create).toHaveBeenCalledWith({
        data: { name: "New Ws", slug: "new-ws", organizationId: "org-new" },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Organization created successfully",
        data: {
          org: createdOrg,
          workspace: createdWorkspace,
        },
      });
    });

    it("handles logo uploading if req.file is present", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { id: "s1", token: "tok1" },
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u1" });
      prismaMock.session.findUnique.mockResolvedValueOnce({ id: "s1" });
      prismaMock.member.findFirst.mockResolvedValueOnce(null);
      prismaMock.organization.findUnique.mockResolvedValueOnce(null);

      const createdOrg = {
        id: "org-new",
        name: "New Org",
        slug: "new-org",
        logo: null,
      };
      const createdWorkspace = { id: "ws-new", name: "New Ws", slug: "new-ws" };

      prismaMock.organization.create.mockResolvedValueOnce(createdOrg);
      prismaMock.member.create.mockResolvedValueOnce({ id: "mem-new" });
      prismaMock.workspace.create.mockResolvedValueOnce(createdWorkspace);
      prismaMock.session.update.mockResolvedValueOnce({ id: "s1" });

      mockMediaService.addMedia.mockResolvedValueOnce({ id: "media-1" });
      mockMediaService.getUrl.mockResolvedValueOnce("http://s3/logo.png");
      prismaMock.organization.update.mockResolvedValueOnce({});

      const req: any = {
        body: { name: "New Org", slug: "new-org", workspaceName: "New Ws" },
        file: {
          originalname: "logo.png",
          mimetype: "image/png",
          buffer: Buffer.from(""),
          size: 10,
        },
      };
      const res = createRes();

      await (orgController.setupOrganization as any)(req, res);

      expect(mockMediaService.addMedia).toHaveBeenCalled();
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: "org-new" },
        data: { logo: "http://s3/logo.png" },
      });
    });
  });
});
