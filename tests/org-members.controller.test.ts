import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const {
  mockGetSession,
  mockImpersonate,
  mockCreateInvitation,
  mockCancelInvitation,
  mockSetUserPassword,
  prismaMock,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockImpersonate: vi.fn(),
  mockCreateInvitation: vi.fn(),
  mockCancelInvitation: vi.fn(),
  mockSetUserPassword: vi.fn(),
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
      findMany: vi.fn(),
    },
    invitation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    userRoleAssignment: {
      findFirst: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
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
      setUserPassword: mockSetUserPassword,
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

import { rbacService } from "@/app/services/rbac.service";

import { orgMembersController } from "../src/app/http/controllers/org-members.controller";

function createRes() {
  const res: unknown = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
}

describe("orgMembersController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.organization.findUnique.mockResolvedValue({
      id: "org1",
      ownerId: "org-owner-id",
    });
  });

  describe("verifyOrgAdmin helpers validation", () => {
    it("throws UnauthorizedException if session has no user", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const req: unknown = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect(
        (orgMembersController.banMember as unknown)(req, res),
      ).rejects.toThrow("Unauthorized");
    });

    it("throws BadRequestException if no active organization", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: null },
      });

      const req: unknown = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect(
        (orgMembersController.banMember as unknown)(req, res),
      ).rejects.toThrow("No active organization found");
    });

    it("throws ForbiddenException if caller is not org owner/admin", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "member",
      }); // not admin/owner
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);

      const req: unknown = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect(
        (orgMembersController.banMember as unknown)(req, res),
      ).rejects.toThrow("Forbidden: You must be an organization admin");
    });

    it("throws NotFoundException if target is not a member of organization", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" }) // caller
        .mockResolvedValueOnce(null); // target

      const req: unknown = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect(
        (orgMembersController.banMember as unknown)(req, res),
      ).rejects.toThrow("Not Found: User is not a member of this organization");
    });

    it("throws ForbiddenException if admin tries to modify other admin/owner", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem" }) // caller is member
        .mockResolvedValueOnce({ id: "target-mem" }); // target is member
      prismaMock.userRoleAssignment.findFirst
        .mockResolvedValueOnce({ role: { name: "admin" } }) // caller is admin
        .mockResolvedValueOnce({ role: { name: "admin" } }); // target is admin

      const req: unknown = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await expect(
        (orgMembersController.banMember as unknown)(req, res),
      ).rejects.toThrow(
        "Forbidden: Admins cannot modify other admins or owners",
      );
    });
  });

  describe("banMember", () => {
    it("bans user and revokes sessions successfully", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" })
        .mockResolvedValueOnce({ id: "target-mem", role: "member" });
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.session.deleteMany.mockResolvedValueOnce({});

      const req: unknown = {
        params: { id: "target-user" },
        body: { reason: "test reason" },
      };
      const res = createRes();

      await (orgMembersController.banMember as unknown)(req, res);

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
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" })
        .mockResolvedValueOnce({ id: "target-mem", role: "member" });
      prismaMock.user.update.mockResolvedValueOnce({});

      const req: unknown = { params: { id: "target-user" } };
      const res = createRes();

      await (orgMembersController.unbanMember as unknown)(req, res);

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
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" })
        .mockResolvedValueOnce({ id: "target-mem", role: "member" });
      prismaMock.session.deleteMany.mockResolvedValueOnce({});

      const req: unknown = { params: { id: "target-user" } };
      const res = createRes();

      await (orgMembersController.revokeSessions as unknown)(req, res);

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
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" })
        .mockResolvedValueOnce({ id: "target-mem", role: "member" });
      mockImpersonate.mockResolvedValueOnce({ token: "impers-tok" });

      const req: unknown = { params: { id: "target-user" } };
      const res = createRes();

      await (orgMembersController.impersonateUser as unknown)(req, res);

      expect(mockImpersonate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Impersonation started",
        data: { token: "impers-tok" },
      });
    });

    it("falls back to manual prisma impersonation session if API fails", async () => {
      mockGetSession.mockResolvedValue({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst
        .mockResolvedValue({ id: "caller-mem", role: "owner", userId: "u1" })
        .mockResolvedValue({ id: "target-mem", role: "member" });
      mockImpersonate.mockRejectedValueOnce(new Error("API check failed"));
      prismaMock.session.create.mockResolvedValueOnce({
        id: "s-manual",
        token: "man-tok",
      });

      const req: unknown = { params: { id: "target-user" }, body: {} };
      const res = createRes();

      await (orgMembersController.impersonateUser as unknown)(req, res);

      expect(prismaMock.session.create).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("better-auth.session_token="),
      );
    });
  });

  describe("bulkInvite", () => {
    it("returns 400 if no file uploaded", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "owner",
      });

      const req: unknown = {};
      const res = createRes();

      await (orgMembersController.bulkInvite as unknown)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "No file uploaded" });
    });

    it("invites CSV members successfully", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "owner",
      });
      mockCreateInvitation.mockResolvedValueOnce({ id: "inv-1" });

      const req: unknown = {
        file: {
          mimetype: "text/csv",
          originalname: "invites.csv",
          buffer: Buffer.from("email,role\ntest@example.com,member"),
        },
      };
      const res = createRes();

      await (orgMembersController.bulkInvite as unknown)(req, res);

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
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "owner",
      });
      mockCreateInvitation.mockResolvedValueOnce({ id: "inv-1" });

      const req: unknown = { body: { email: "new@example.com", role: "member" } };
      const res = createRes();

      await (orgMembersController.inviteMember as unknown)(req, res);

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
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "owner",
      });
      prismaMock.member.findMany.mockResolvedValueOnce([{ id: "mem-1" }]);

      const req: unknown = { query: {} };
      const res = createRes();

      await (orgMembersController.getMembers as unknown)(req, res);

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
      const invitation = {
        id: "inv-1",
        email: "new@example.com",
        role: "member",
        status: "pending",
        expiresAt: new Date(),
        organization: { name: "Org", slug: "org" },
      };
      prismaMock.invitation.findUnique.mockResolvedValueOnce(invitation);

      const req: unknown = { params: { id: "inv-1" } };
      const res = createRes();

      await (orgMembersController.getInvitationPublic as unknown)(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Invitation found",
        data: expect.objectContaining({
          id: "inv-1",
          email: "new@example.com",
        }),
      });
    });

    it("returns 404 if invitation not found", async () => {
      prismaMock.invitation.findUnique.mockResolvedValueOnce(null);

      const req: unknown = { params: { id: "inv-1" } };
      const res = createRes();

      await (orgMembersController.getInvitationPublic as unknown)(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invitation not found",
      });
    });
  });

  describe("getPendingInvitations", () => {
    it("fetches pending invitations", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "owner",
      });
      prismaMock.invitation.findMany.mockResolvedValueOnce([{ id: "inv-1" }]);

      const req: unknown = {};
      const res = createRes();

      await (orgMembersController.getPendingInvitations as unknown)(req, res);

      expect(prismaMock.invitation.findMany).toHaveBeenCalled();
    });
  });

  describe("revokeInvitation", () => {
    it("revokes invitation successfully", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "owner",
      });
      prismaMock.invitation.findFirst.mockResolvedValueOnce({ id: "inv-1" });
      mockCancelInvitation.mockResolvedValueOnce({ id: "inv-1" });

      const req: unknown = { params: { id: "inv-1" } };
      const res = createRes();

      await (orgMembersController.revokeInvitation as unknown)(req, res);

      expect(mockCancelInvitation).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Invitation revoked successfully",
        data: { id: "inv-1" },
      });
    });
  });

  describe("setPassword, getSessions, revokeSession & updateProfile", () => {
    it("sets password successfully", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "owner",
      });
      mockSetUserPassword.mockResolvedValueOnce({});

      const req: unknown = {
        params: { id: "target-user" },
        body: { password: "newpassword123" },
      };
      const res = createRes();

      await (orgMembersController.setPassword as unknown)(req, res);

      expect(mockSetUserPassword).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: "Password updated successfully",
      }));
    });

    it("gets user sessions successfully", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "owner",
      });
      prismaMock.session.findMany.mockResolvedValueOnce([{ id: "s1" }]);

      const req: unknown = { params: { id: "target-user" } };
      const res = createRes();

      await (orgMembersController.getSessions as unknown)(req, res);

      expect(prismaMock.session.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: [{ id: "s1" }],
      }));
    });

    it("revokes user session successfully", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst.mockResolvedValueOnce({
        id: "caller-mem",
        role: "owner",
      });
      prismaMock.session.deleteMany.mockResolvedValueOnce({ count: 1 });

      const req: unknown = { params: { id: "target-user", sessionId: "s1" } };
      const res = createRes();

      await (orgMembersController.revokeSession as unknown)(req, res);

      expect(prismaMock.session.deleteMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: "Session revoked successfully",
      }));
    });

    it("updates profile successfully", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller-mem", role: "owner" }) // for verifyAdminAccess caller
        .mockResolvedValueOnce({ id: "target-mem" }); // for verifyAdminAccess target or user org membership check
      prismaMock.user.update.mockResolvedValueOnce({});

      const req: unknown = {
        params: { id: "target-user" },
        body: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
      };
      const res = createRes();

      await (orgMembersController.updateProfile as unknown)(req, res);

      expect(prismaMock.user.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: "Profile updated successfully",
      }));
    });
  });

  describe("updatePhoto, resendInvitation & error handler edge cases", () => {
    it("updatePhoto returns 400 if no file uploaded", async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });

      const req: unknown = { params: { id: "target-user" } };
      const res = createRes();

      await (orgMembersController.updatePhoto as unknown)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("updatePhoto updates photo successfully if file uploaded", async () => {
      const { orgMembersService } = await import("../src/app/services/org-members.service");
      vi.spyOn(orgMembersService, "updatePhoto").mockResolvedValueOnce("http://example.com/avatar.png");

      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });

      const req: unknown = {
        params: { id: "target-user" },
        file: {
          buffer: Buffer.from("img"),
          originalname: "pic.png",
          mimetype: "image/png",
          size: 100,
        },
      };
      const res = createRes();

      await (orgMembersController.updatePhoto as unknown)(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: "Photo updated successfully",
        data: { url: "http://example.com/avatar.png" },
      }));
    });

    it("inviteMember triggers error handler for CONFLICT", async () => {
      const { orgMembersService } = await import("../src/app/services/org-members.service");
      vi.spyOn(orgMembersService, "verifyAdminAccess").mockResolvedValueOnce({} as unknown);
      vi.spyOn(orgMembersService, "inviteMember").mockRejectedValueOnce(
        Object.assign(new Error("Email already registered"), { status: "CONFLICT", code: "ALREADY_EXISTS" })
      );

      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });

      const req: unknown = {
        body: { email: "new@example.com", role: "member" },
      };
      const res = createRes();

      await (orgMembersController.inviteMember as unknown)(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: "Email already registered",
        code: "ALREADY_EXISTS",
      }));
    });

    it("resendInvitation resends successfully", async () => {
      const { orgMembersService } = await import("../src/app/services/org-members.service");
      vi.spyOn(orgMembersService, "resendInvitation").mockResolvedValueOnce({ id: "inv-1" });

      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });

      const req: unknown = { params: { id: "inv-1" } };
      const res = createRes();

      await (orgMembersController.resendInvitation as unknown)(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: "Invitation resent successfully",
      }));
    });

    it("resendInvitation triggers catch block error handler for BAD_REQUEST", async () => {
      const { orgMembersService } = await import("../src/app/services/org-members.service");
      vi.spyOn(orgMembersService, "resendInvitation").mockRejectedValueOnce(
        Object.assign(new Error("Invalid link"), { status: "BAD_REQUEST" })
      );

      mockGetSession.mockResolvedValueOnce({
        user: { id: "u1" },
        session: { activeOrganizationId: "org1" },
      });

      const req: unknown = { params: { id: "inv-1" } };
      const res = createRes();

      await (orgMembersController.resendInvitation as unknown)(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: "Invalid link",
      }));
    });
  });
});
