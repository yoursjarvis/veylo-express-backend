import { describe, it, expect, vi, beforeEach } from "vitest";
import { orgMembersService } from "@/app/services/org-members.service";
import { orgMembersRepository } from "@/app/repositories/org-members.repository";
import { rbacService } from "@/app/services/rbac.service";
import { mediaService } from "@/app/services/media.service";
import { auth } from "@/lib/auth/auth";
import prisma from "@/lib/prisma";

// Mock orgMembersRepository
vi.mock("@/app/repositories/org-members.repository", () => ({
  orgMembersRepository: {
    findCallerMember: vi.fn(),
    findTargetMember: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
    deleteSessionsByUserId: vi.fn(),
    findUserById: vi.fn(),
    createSession: vi.fn(),
    findMembers: vi.fn(),
    findInvitationById: vi.fn(),
    findPendingInvitations: vi.fn(),
    findInvitationInOrg: vi.fn(),
  },
}));

// Mock rbacService
vi.mock("@/app/services/rbac.service", () => ({
  rbacService: {
    authorize: vi.fn(),
  },
}));

// Mock mediaService
vi.mock("@/app/services/media.service", () => ({
  mediaService: {
    uploadAvatar: vi.fn(),
  },
}));

// Mock Better Auth
vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      impersonateUser: vi.fn(),
      setUserPassword: vi.fn(),
      createInvitation: vi.fn(),
      cancelInvitation: vi.fn(),
    },
  },
}));

describe("OrgMembersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyAdminAccess", () => {
    it("should throw ForbiddenException if caller is not in organization", async () => {
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValueOnce(null);
      await expect(
        orgMembersService.verifyAdminAccess("org-1", "user-1")
      ).rejects.toThrow("Forbidden: You must be a member of this organization");
    });

    it("should bypass permission check if self-modifying and allowSelf is true", async () => {
      const member = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValueOnce(member as unknown);

      const result = await orgMembersService.verifyAdminAccess("org-1", "user-1", "user-1", "update", true);
      expect(result).toEqual(member);
    });

    it("should throw ForbiddenException if RBAC authorization fails", async () => {
      const member = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValueOnce(member as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);

      await expect(
        orgMembersService.verifyAdminAccess("org-1", "user-1", "user-2", "update")
      ).rejects.toThrow("Forbidden: You must be an organization admin");
    });

    it("should throw NotFoundException if target user is not in organization", async () => {
      const member = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValueOnce(member as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValueOnce(null);

      await expect(
        orgMembersService.verifyAdminAccess("org-1", "user-1", "user-2", "update")
      ).rejects.toThrow("Not Found: User is not a member of this organization");
    });

    it("should throw ForbiddenException if admin attempts to modify another admin/owner", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      const target = { id: "m-2", userId: "user-2", organizationId: "org-1" };

      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValueOnce(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValueOnce(target as unknown);

      prisma.organization.findUnique = vi.fn().mockResolvedValue({ ownerId: "user-owner" });
      prisma.userRoleAssignment.findFirst = vi.fn()
        .mockResolvedValueOnce({ role: { name: "admin" } }) // caller
        .mockResolvedValueOnce({ role: { name: "admin" } }); // target

      await expect(
        orgMembersService.verifyAdminAccess("org-1", "user-1", "user-2", "update")
      ).rejects.toThrow("Forbidden: Admins cannot modify other admins or owners");
    });
  });

  describe("Operations", () => {
    it("should ban and unban members", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValue({ id: "m-2" } as unknown);

      await orgMembersService.banMember("org-1", "user-1", "user-2", "reason");
      expect(orgMembersRepository.banUser).toHaveBeenCalledWith("user-2", "reason");

      await orgMembersService.unbanMember("org-1", "user-1", "user-2");
      expect(orgMembersRepository.unbanUser).toHaveBeenCalledWith("user-2");
    });

    it("should revoke sessions and get sessions", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValue({ id: "m-2" } as unknown);

      await orgMembersService.revokeSessions("org-1", "user-1", "user-2");
      expect(orgMembersRepository.deleteSessionsByUserId).toHaveBeenCalledWith("user-2");

      prisma.session.findMany = vi.fn().mockResolvedValueOnce([{ id: "sess-1" }]);
      const sessions = await orgMembersService.getSessions("org-1", "user-1", "user-2");
      expect(sessions).toHaveLength(1);
    });

    it("should impersonate user (with Better Auth and manual fallback)", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValue({ id: "m-2" } as unknown);

      // Case 1: Better Auth success
      vi.mocked(auth.api.impersonateUser as unknown).mockResolvedValueOnce({ sessionToken: "token" });
      const res1 = await orgMembersService.impersonateUser("org-1", "user-1", "user-2", {});
      expect(res1.success).toBe(true);

      // Case 2: Better Auth fail -> fallback manual
      vi.mocked(auth.api.impersonateUser as unknown).mockRejectedValueOnce(new Error("Error"));
      vi.mocked(orgMembersRepository.createSession).mockResolvedValueOnce({ id: "sess-fallback" } as unknown);
      const res2 = await orgMembersService.impersonateUser("org-1", "user-1", "user-2", {});
      expect(res2.success).toBe(false);
      expect(res2.fallback).toBeDefined();
    });

    it("should set password", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValue({ id: "m-2" } as unknown);

      await orgMembersService.setPassword("org-1", "user-1", "user-2", "new-pass", {});
      expect(auth.api.setUserPassword as unknown).toHaveBeenCalled();
    });

    it("should revoke session", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValue({ id: "m-2" } as unknown);

      prisma.session.deleteMany = vi.fn().mockResolvedValueOnce({ count: 1 });
      await orgMembersService.revokeSession("org-1", "user-1", "user-2", "sess-1", {});
      expect(prisma.session.deleteMany).toHaveBeenCalled();
    });

    it("should update photo", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValue({ id: "m-2" } as unknown);

      vi.mocked(mediaService.uploadAvatar).mockResolvedValueOnce({ url: "https://newphoto.png" } as unknown);
      const url = await orgMembersService.updatePhoto("org-1", "user-1", "user-2", {
        buffer: Buffer.from(""),
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
        size: 50,
      });
      expect(url).toBe("https://newphoto.png");
    });

    it("should update profile", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValue({ id: "m-2" } as unknown);

      prisma.member.findFirst = vi.fn().mockResolvedValueOnce({ id: "m-2" });
      prisma.user.update = vi.fn().mockResolvedValueOnce({ id: "user-2" });

      await orgMembersService.updateProfile("org-1", "user-1", "user-2", {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
      });
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("should list members", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findMembers).mockResolvedValue([{ id: "m-1" }, { id: "m-2" }] as unknown);

      const result = await orgMembersService.getMembers("org-1", "user-1", { limit: 1 });
      expect(result.members).toHaveLength(1);
      expect(result.nextCursor).toBe("m-2");
    });

    it("should get public details of active invitations", async () => {
      const invitation = {
        id: "invite-1",
        email: "guest@example.com",
        role: "member",
        status: "pending",
        expiresAt: new Date(),
        organization: { name: "OrgName", slug: "orgslug" },
      };
      vi.mocked(orgMembersRepository.findInvitationById).mockResolvedValueOnce(invitation as unknown);

      const res = await orgMembersService.getInvitationPublic("invite-1");
      expect(res.organizationName).toBe("OrgName");

      // Inactive invitation case
      vi.mocked(orgMembersRepository.findInvitationById).mockResolvedValueOnce({ status: "cancelled" } as unknown);
      await expect(orgMembersService.getInvitationPublic("invite-1")).rejects.toThrow("Invitation is no longer active");
    });

    it("should get pending invitations", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findPendingInvitations).mockResolvedValueOnce([{ id: "inv-1" }] as unknown);

      expect(await orgMembersService.getPendingInvitations("org-1", "user-1")).toHaveLength(1);
    });

    it("should invite member", async () => {
      vi.mocked(auth.api.createInvitation as unknown).mockResolvedValueOnce({ id: "inv-1" });
      prisma.invitation.update = vi.fn().mockResolvedValueOnce({});

      const invite = await orgMembersService.inviteMember("org-1", "guest@example.com", "member", ["proj-1"], {});
      expect(invite?.id).toBe("inv-1");
      expect(prisma.invitation.update).toHaveBeenCalled();
    });

    it("should bulk invite members via CSV/Excel", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);

      // CSV bulk invite
      vi.mocked(auth.api.createInvitation as unknown).mockResolvedValueOnce({ id: "inv-1" });
      const csvBuffer = Buffer.from("email,role\ntest@example.com,member\n");
      const resultCsv = await orgMembersService.bulkInvite("org-1", "user-1", {
        buffer: csvBuffer,
        mimetype: "text/csv",
        originalname: "members.csv",
      }, {});
      expect(resultCsv.successful).toBe(1);

      // Unsupported file type
      await expect(
        orgMembersService.bulkInvite("org-1", "user-1", {
          buffer: Buffer.from(""),
          mimetype: "image/png",
          originalname: "img.png",
        }, {})
      ).rejects.toThrow("Unsupported file type. Please upload CSV or Excel.");
    });

    it("should cancel/revoke invitation", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findInvitationInOrg).mockResolvedValueOnce({ id: "inv-1" } as unknown);
      vi.mocked(auth.api.cancelInvitation as unknown).mockResolvedValueOnce({ success: true });

      const result = await orgMembersService.revokeInvitation("org-1", "user-1", "inv-1", {});
      expect(result).toBeDefined();

      // NotFound case
      vi.mocked(orgMembersRepository.findInvitationInOrg).mockResolvedValueOnce(null);
      await expect(
        orgMembersService.revokeInvitation("org-1", "user-1", "inv-missing", {})
      ).rejects.toThrow("Invitation not found in this organization");
    });

    it("should resend invitation", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findInvitationInOrg).mockResolvedValueOnce({
        id: "inv-1",
        email: "guest@example.com",
        role: "member",
        projectIds: ["proj-1"],
      } as unknown);

      vi.mocked(auth.api.createInvitation as unknown).mockResolvedValueOnce({ id: "inv-new" });
      prisma.invitation.update = vi.fn().mockResolvedValueOnce({});

      const result = await orgMembersService.resendInvitation("org-1", "user-1", "inv-1", {});
      expect(result?.id).toBe("inv-new");
      expect(prisma.invitation.update).toHaveBeenCalled();
    });

    it("should throw NotFoundException on resendInvitation if invitation not found", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findInvitationInOrg).mockResolvedValueOnce(null);

      await expect(
        orgMembersService.resendInvitation("org-1", "user-1", "inv-missing", {})
      ).rejects.toThrow("Invitation not found in this organization");
    });

    it("should handle bulk invite with missing email in CSV row and invite failure", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);

      // CSV with missing email row
      const csvBuffer = Buffer.from("email,role\n,member\ntest@example.com,member\n");
      vi.mocked(auth.api.createInvitation as unknown)
        .mockRejectedValueOnce(new Error("Invite error")); // first valid invite fails

      const result = await orgMembersService.bulkInvite("org-1", "user-1", {
        buffer: csvBuffer,
        mimetype: "text/csv",
        originalname: "members.csv",
      }, {});

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should throw NotFoundException on updateProfile if member not in org", async () => {
      const caller = { id: "m-1", userId: "user-1", organizationId: "org-1" };
      vi.mocked(orgMembersRepository.findCallerMember).mockResolvedValue(caller as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValue(true);
      vi.mocked(orgMembersRepository.findTargetMember).mockResolvedValue({ id: "m-2" } as unknown);

      prisma.member.findFirst = vi.fn().mockResolvedValueOnce(null); // not a member

      await expect(
        orgMembersService.updateProfile("org-1", "user-1", "user-2", {
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@example.com",
        })
      ).rejects.toThrow("User is not a member of this organization");
    });

    it("getInvitationPublic: throws NotFoundException if invitation not found", async () => {
      vi.mocked(orgMembersRepository.findInvitationById).mockResolvedValueOnce(null);
      await expect(
        orgMembersService.getInvitationPublic("invite-missing")
      ).rejects.toThrow("Invitation not found");
    });

    it("inviteMember: skips invitation update if no projectIds", async () => {
      vi.mocked(auth.api.createInvitation as unknown).mockResolvedValueOnce({ id: "inv-1" });
      prisma.invitation.update = vi.fn();

      const invite = await orgMembersService.inviteMember("org-1", "guest@example.com", "member", undefined, {});
      expect(invite?.id).toBe("inv-1");
      expect(prisma.invitation.update).not.toHaveBeenCalled();
    });
  });
});
