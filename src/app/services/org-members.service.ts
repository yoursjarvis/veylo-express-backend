import crypto from "crypto";

import { parse } from "csv-parse/sync";
import * as xlsx from "xlsx";

import { orgMembersRepository } from "@/app/repositories/org-members.repository";
import { auth } from "@/lib/auth/auth";
import prisma from "@/lib/prisma";
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@/utils/app-error";

export const orgMembersService = {
  async verifyAdminAccess(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId?: string,
    action: string = "update",
    allowSelf = false,
  ) {
    const callerMember = await orgMembersRepository.findCallerMember(
      activeOrgId,
      sessionUserId,
    );
    if (!callerMember) {
      throw new ForbiddenException(
        "Forbidden: You must be a member of this organization",
      );
    }

    // Ownership check: If modifying oneself, and allowSelf is true, bypass permission check
    if (allowSelf && targetUserId && sessionUserId === targetUserId) {
      return callerMember;
    }

    const { rbacService } = await import("@/app/services/rbac.service");

    // Map action to permission string
    let requiredPermission = `member:${action}`;
    if (action === "invite") {
      requiredPermission = "member:invite";
    } else if (action === "cancel_invitation") {
      requiredPermission = "invitation:cancel";
    }

    const isAllowed = await rbacService.authorize(
      sessionUserId,
      requiredPermission,
      {
        organizationId: activeOrgId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You must be an organization admin",
      );
    }

    if (targetUserId) {
      const targetMember = await orgMembersRepository.findTargetMember(
        activeOrgId,
        targetUserId,
      );
      if (!targetMember) {
        throw new NotFoundException(
          "Not Found: User is not a member of this organization",
        );
      }

      const prisma = (await import("@/lib/prisma")).default;
      const [org, callerRoleAssignment, targetRoleAssignment] =
        await Promise.all([
          prisma.organization.findUnique({
            where: { id: activeOrgId },
            select: { ownerId: true },
          }),
          prisma.userRoleAssignment.findFirst({
            where: {
              userId: sessionUserId,
              scopeType: "ORGANIZATION",
              scopeId: activeOrgId,
            },
            include: { role: true },
          }),
          prisma.userRoleAssignment.findFirst({
            where: {
              userId: targetUserId,
              scopeType: "ORGANIZATION",
              scopeId: activeOrgId,
            },
            include: { role: true },
          }),
        ]);

      const callerRoleName = callerRoleAssignment?.role?.name;
      const targetRoleName = targetRoleAssignment?.role?.name;
      const isTargetOwner = org?.ownerId === targetUserId;

      if (
        callerRoleName === "admin" &&
        (targetRoleName === "admin" || isTargetOwner)
      ) {
        throw new ForbiddenException(
          "Forbidden: Admins cannot modify other admins or owners",
        );
      }
    }

    return callerMember;
  },

  async banMember(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
    reason?: string,
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      targetUserId,
      "ban",
    );

    await orgMembersRepository.banUser(
      targetUserId,
      reason || "Banned by organization admin",
    );
    await orgMembersRepository.deleteSessionsByUserId(targetUserId);
  },

  async unbanMember(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      targetUserId,
      "ban",
    );
    await orgMembersRepository.unbanUser(targetUserId);
  },

  async revokeSessions(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      targetUserId,
      "update",
      true,
    );
    await orgMembersRepository.deleteSessionsByUserId(targetUserId);
  },

  async impersonateUser(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
    headers: HeadersInit,
  ) {
    const callerMember = await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      targetUserId,
      "impersonate",
    );

    try {
      // Create impersonated session using Better Auth API
      const impersonateUser = (auth.api as Record<string, unknown>)
        .impersonateUser as (options: {
        body: { userId: string };
        headers: HeadersInit;
      }) => Promise<unknown>;
      const result = await impersonateUser({
        body: { userId: targetUserId },
        headers,
      });
      return { success: true, result };
    } catch {
      // Fallback manual impersonation session
      const token = crypto.randomBytes(32).toString("hex");
      const newSession = await orgMembersRepository.createSession({
        userId: targetUserId,
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
        impersonatedBy: callerMember.userId,
      });

      return { success: false, fallback: { token, session: newSession } };
    }
  },

  async setPassword(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
    password: string,
    headers: HeadersInit,
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      targetUserId,
      "change-password",
      true,
    );

    const setUserPassword = (auth.api as Record<string, unknown>)
      .setUserPassword as (options: {
      body: { userId: string; newPassword: string };
      headers: HeadersInit;
    }) => Promise<unknown>;

    await setUserPassword({
      body: { userId: targetUserId, newPassword: password },
      headers,
    });
  },

  async getSessions(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      targetUserId,
      "read",
      true,
    );
    return prisma.session.findMany({
      where: { userId: targetUserId },
      orderBy: { lastActiveAt: "desc" },
    });
  },

  async revokeSession(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
    sessionId: string,
    _headers: HeadersInit,
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      targetUserId,
      "update",
      true,
    );
    await prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId: targetUserId,
      },
    });
  },

  async updatePhoto(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      targetUserId,
      "update",
      true,
    );

    const { mediaService } = await import("@/app/services/media.service");
    const result = await mediaService.uploadAvatar(targetUserId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    return result.url;
  },

  async updateProfile(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
    data: { firstName: string; lastName: string; email: string },
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      targetUserId,
      "update",
      true,
    );

    // Verify user belongs to org
    const member = await prisma.member.findFirst({
      where: {
        userId: targetUserId,
        organizationId: activeOrgId,
      },
    });

    if (!member) {
      throw new NotFoundException("User is not a member of this organization");
    }

    const { firstName, lastName, email } = data;
    const name = `${firstName} ${lastName}`.trim();

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        firstName,
        lastName,
        name,
        email,
      },
    });
  },

  async getMembers(
    activeOrgId: string,
    sessionUserId: string,
    params: {
      limit: number;
      cursor?: string;
      search?: string;
      role?: string;
      status?: string;
    },
  ) {
    await this.verifyAdminAccess(activeOrgId, sessionUserId, undefined, "read");

    const members = await orgMembersRepository.findMembers({
      activeOrgId,
      limit: params.limit,
      cursor: params.cursor,
      search: params.search,
      role: params.role,
      status: params.status,
    });

    let nextCursor: string | undefined = undefined;
    if (members.length > params.limit) {
      const nextItem = members.pop();
      nextCursor = nextItem?.id;
    }

    return { members, nextCursor };
  },

  async getInvitationPublic(invitationId: string) {
    const invitation =
      await orgMembersRepository.findInvitationById(invitationId);
    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    // Allow pending or accepted so frontend can auto-redirect
    if (invitation.status !== "pending" && invitation.status !== "accepted") {
      throw new BadRequestException("Invitation is no longer active");
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      organizationSlug: invitation.organization.slug,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };
  },

  async getPendingInvitations(activeOrgId: string, sessionUserId: string) {
    await this.verifyAdminAccess(activeOrgId, sessionUserId, undefined, "read");
    return orgMembersRepository.findPendingInvitations(activeOrgId);
  },

  async inviteMember(
    activeOrgId: string,
    email: string,
    role: string,
    projectIds: string[] | undefined,
    headers: HeadersInit,
  ) {
    const createInvitation = (auth.api as Record<string, unknown>)
      .createInvitation as (options: {
      body: {
        email: string;
        role: string;
        organizationId: string;
        resend: boolean;
      };
      headers: HeadersInit;
    }) => Promise<{ id: string; [key: string]: unknown } | null>;
    const invitation = await createInvitation({
      body: {
        email,
        role: role || "member",
        organizationId: activeOrgId,
        resend: true,
      },
      headers,
    });

    if (invitation && projectIds && projectIds.length > 0) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { projectIds },
      });
    }

    return invitation;
  },

  async bulkInvite(
    activeOrgId: string,
    sessionUserId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    headers: HeadersInit,
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      undefined,
      "invite",
    );

    let records: Record<string, unknown>[] = [];

    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      records = parse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
      }) as Record<string, unknown>[];
    } else if (
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      const workbook = xlsx.read(file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      records = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as Record<
        string,
        unknown
      >[];
    } else {
      throw new BadRequestException(
        "Unsupported file type. Please upload CSV or Excel.",
      );
    }

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    const createInvitation = (auth.api as Record<string, unknown>)
      .createInvitation as (options: {
      body: {
        email: string;
        role: string;
        organizationId: string;
        resend: boolean;
      };
      headers: HeadersInit;
    }) => Promise<unknown>;

    for (const record of records) {
      const email =
        (record.email as string | undefined) ||
        (record.Email as string | undefined);
      const role = String(record.role || record.Role || "member").toLowerCase();

      if (!email) {
        results.failed++;
        results.errors.push("Missing email in row");
        continue;
      }

      try {
        await createInvitation({
          body: {
            email,
            role,
            organizationId: activeOrgId,
            resend: true,
          },
          headers,
        });

        results.successful++;
      } catch (error) {
        const err = error as Error;
        results.failed++;
        results.errors.push(
          `Failed to invite ${email}: ${err.message || "Unknown error"}`,
        );
      }
    }

    return results;
  },

  async revokeInvitation(
    activeOrgId: string,
    sessionUserId: string,
    id: string,
    headers: HeadersInit,
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      undefined,
      "cancel_invitation",
    );

    const invitation = await orgMembersRepository.findInvitationInOrg(
      id,
      activeOrgId,
    );
    if (!invitation) {
      throw new NotFoundException("Invitation not found in this organization");
    }

    const cancelInvitation = (auth.api as Record<string, unknown>)
      .cancelInvitation as (options: {
      body: { invitationId: string };
      headers: HeadersInit;
    }) => Promise<unknown>;
    return cancelInvitation({
      body: {
        invitationId: id,
      },
      headers,
    });
  },

  async resendInvitation(
    activeOrgId: string,
    sessionUserId: string,
    id: string,
    headers: HeadersInit,
  ) {
    await this.verifyAdminAccess(
      activeOrgId,
      sessionUserId,
      undefined,
      "invite",
    );

    const invitation = await orgMembersRepository.findInvitationInOrg(
      id,
      activeOrgId,
    );
    if (!invitation) {
      throw new NotFoundException("Invitation not found in this organization");
    }

    const createInvitation = (auth.api as Record<string, unknown>)
      .createInvitation as (options: {
      body: {
        email: string;
        role: string;
        organizationId: string;
        resend: boolean;
      };
      headers: HeadersInit;
    }) => Promise<{ id: string; [key: string]: unknown } | null>;

    const result = await createInvitation({
      body: {
        email: invitation.email,
        role: invitation.role || "member",
        organizationId: activeOrgId,
        resend: true,
      },
      headers,
    });

    if (result && Array.isArray(invitation.projectIds) && invitation.projectIds.length > 0) {
      await prisma.invitation.update({
        where: { id: result.id },
        data: { projectIds: invitation.projectIds as string[] },
      });
    }

    return result;
  },
};
