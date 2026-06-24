import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockGetSession, mockImpersonate, mockCreateInvitation, mockCancelInvitation, prismaMock } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockImpersonate: vi.fn(),
  mockCreateInvitation: vi.fn(),
  mockCancelInvitation: vi.fn(),
  prismaMock: {
    member: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    invitation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
      impersonateUser: mockImpersonate,
      createInvitation: mockCreateInvitation,
      cancelInvitation: mockCancelInvitation,
    },
  },
}));

vi.mock("../src/lib/auth/node-headers", () => ({
  betterAuthHeaders: vi.fn(),
}));

vi.mock("../src/lib/prisma", () => ({ default: prismaMock }));

vi.mock("csv-parse/sync", () => ({
  parse: vi.fn(() => [{ email: "csv@example.com", role: "member" }]),
}));

vi.mock("xlsx", () => ({
  read: vi.fn(() => ({
    SheetNames: ["Sheet1"],
    Sheets: { Sheet1: {} },
  })),
  utils: {
    sheet_to_json: vi.fn(() => [{ email: "excel@example.com", role: "admin" }]),
  },
}));

import { orgMembersController } from "../src/app/http/controllers/org-members.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
}

describe("orgMembersController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyOrgAdmin helpers validation", () => {
    it("throws UnauthorizedException if session has no user", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const req: any = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect((orgMembersController.banMember as any)(req, res)).rejects.toThrow("Unauthorized");
    });

    it("throws BadRequestException if no active organization", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: null } });

      const req: any = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect((orgMembersController.banMember as any)(req, res)).rejects.toThrow("No active organization found");
    });

    it("throws ForbiddenException if caller is not org owner/admin", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst.mockResolvedValueOnce(null); // not admin/owner

      const req: any = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect((orgMembersController.banMember as any)(req, res)).rejects.toThrow(
        "Forbidden: You must be an organization admin"
      );
    });

    it("throws NotFoundException if target is not a member of organization", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" }) // caller
        .mockResolvedValueOnce(null); // target

      const req: any = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect((orgMembersController.banMember as any)(req, res)).rejects.toThrow(
        "Not Found: User is not a member of this organization"
      );
    });

    it("throws ForbiddenException if admin tries to modify other admin/owner", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "admin" }) // caller is admin
        .mockResolvedValueOnce({ id: "target-mem", role: "admin" }); // target is admin

      const req: any = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect((orgMembersController.banMember as any)(req, res)).rejects.toThrow(
        "Forbidden: Admins cannot modify other admins or owners"
      );
    });
  });

  describe("banMember", () => {
    it("bans user and revokes sessions successfully", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" })
        .mockResolvedValueOnce({ id: "target-mem", role: "member" });
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.session.deleteMany.mockResolvedValueOnce({});

      const req: any = { params: { id: "target-user" }, body: { reason: "test reason" } };
      const res = createRes();

      await (orgMembersController.banMember as any)(req, res);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "target-user" },
        data: { banned: true, banReason: "test reason" },
      });
      expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "target-user" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Member banned successfully",
        data: {},
      });
    });
  });

  describe("unbanMember", () => {
    it("unbans member successfully", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" })
        .mockResolvedValueOnce({ id: "target-mem", role: "member" });
      prismaMock.user.update.mockResolvedValueOnce({});

      const req: any = { params: { id: "target-user" } };
      const res = createRes();

      await (orgMembersController.unbanMember as any)(req, res);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "target-user" },
        data: { banned: false, banReason: null, banExpires: null },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Member unbanned successfully",
        data: {},
      });
    });
  });

  describe("revokeSessions", () => {
    it("revokes sessions successfully", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" })
        .mockResolvedValueOnce({ id: "target-mem", role: "member" });
      prismaMock.session.deleteMany.mockResolvedValueOnce({});

      const req: any = { params: { id: "target-user" } };
      const res = createRes();

      await (orgMembersController.revokeSessions as any)(req, res);

      expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "target-user" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Sessions revoked successfully",
        data: {},
      });
    });
  });

  describe("impersonateUser", () => {
    it("impersonates via API successfully", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" })
        .mockResolvedValueOnce({ id: "target-mem", role: "member" });
      mockImpersonate.mockResolvedValueOnce({ token: "impers-tok" });

      const req: any = { params: { id: "target-user" } };
      const res = createRes();

      await (orgMembersController.impersonateUser as any)(req, res);

      expect(mockImpersonate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Impersonation started",
        data: { token: "impers-tok" },
      });
    });

    it("falls back to manual prisma impersonation session if API fails", async () => {
      mockGetSession.mockResolvedValue({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst
        .mockResolvedValue({ id: "caller-mem", role: "owner", userId: "u1" })
        .mockResolvedValue({ id: "target-mem", role: "member" });
      mockImpersonate.mockRejectedValueOnce(new Error("API check failed"));
      prismaMock.session.create.mockResolvedValueOnce({ id: "s-manual", token: "man-tok" });

      const req: any = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await (orgMembersController.impersonateUser as any)(req, res);

      expect(prismaMock.session.create).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("better-auth.session_token="));
    });
  });

  describe("bulkInvite", () => {
    it("returns 400 if no file uploaded", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "caller-mem", role: "owner" });

      const req: any = {};
      const res = createRes();

      await (orgMembersController.bulkInvite as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "No file uploaded" });
    });

    it("invites CSV members successfully", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "caller-mem", role: "owner" });
      mockCreateInvitation.mockResolvedValueOnce({ id: "inv-1" });

      const req: any = {
        file: { mimetype: "text/csv", originalname: "invites.csv", buffer: Buffer.from("email,role\ntest@example.com,member") }
      };
      const res = createRes();

      await (orgMembersController.bulkInvite as any)(req, res);

      expect(mockCreateInvitation).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Bulk invite processed",
        data: expect.objectContaining({ successful: 1, failed: 0 }),
      });
    });
  });

  describe("inviteMember", () => {
    it("invites member successfully", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "caller-mem", role: "owner" });
      mockCreateInvitation.mockResolvedValueOnce({ id: "inv-1" });

      const req: any = { body: { email: "new@example.com", role: "member" } };
      const res = createRes();

      await (orgMembersController.inviteMember as any)(req, res);

      expect(mockCreateInvitation).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Invitation sent successfully",
        data: { id: "inv-1" },
      });
    });
  });

  describe("getMembers", () => {
    it("fetches members successfully", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "caller-mem", role: "owner" });
      prismaMock.member.findMany.mockResolvedValueOnce([{ id: "mem-1" }]);

      const req: any = { query: {} };
      const res = createRes();

      await (orgMembersController.getMembers as any)(req, res);

      expect(prismaMock.member.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Members fetched",
        data: expect.objectContaining({ members: [{ id: "mem-1" }] }),
      });
    });
  });

  describe("getInvitationPublic", () => {
    it("returns invitation details if pending", async () => {
      const invitation = { id: "inv-1", email: "new@example.com", role: "member", status: "pending", expiresAt: new Date(), organization: { name: "Org", slug: "org" } };
      prismaMock.invitation.findUnique.mockResolvedValueOnce(invitation);

      const req: any = { params: { id: "inv-1" } };
      const res = createRes();

      await (orgMembersController.getInvitationPublic as any)(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Invitation found",
        data: expect.objectContaining({ id: "inv-1", email: "new@example.com" }),
      });
    });

    it("returns 404 if invitation not found", async () => {
      prismaMock.invitation.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "inv-1" } };
      const res = createRes();

      await (orgMembersController.getInvitationPublic as any)(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Invitation not found" });
    });
  });

  describe("getPendingInvitations", () => {
    it("fetches pending invitations", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "caller-mem", role: "owner" });
      prismaMock.invitation.findMany.mockResolvedValueOnce([{ id: "inv-1" }]);

      const req: any = {};
      const res = createRes();

      await (orgMembersController.getPendingInvitations as any)(req, res);

      expect(prismaMock.invitation.findMany).toHaveBeenCalled();
    });
  });

  describe("revokeInvitation", () => {
    it("revokes invitation successfully", async () => {
      mockGetSession.mockResolvedValueOnce({ user: { id: "u1" }, session: { activeOrganizationId: "org1" } });
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "caller-mem", role: "owner" });
      prismaMock.invitation.findFirst.mockResolvedValueOnce({ id: "inv-1" });
      mockCancelInvitation.mockResolvedValueOnce({ id: "inv-1" });

      const req: any = { params: { id: "inv-1" } };
      const res = createRes();

      await (orgMembersController.revokeInvitation as any)(req, res);

      expect(mockCancelInvitation).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Invitation revoked successfully",
        data: { id: "inv-1" },
      });
    });
  });
});
