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
  ) {
    const callerMember = await orgMembersRepository.findCallerMember(
      activeOrgId,
      sessionUserId,
    );
    if (!callerMember) {
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

      // Prevent modifying other admins if caller is not owner
      if (
        callerMember.role === "admin" &&
        (targetMember.role === "admin" || targetMember.role === "owner")
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
    await this.verifyAdminAccess(activeOrgId, sessionUserId, targetUserId);

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
    await this.verifyAdminAccess(activeOrgId, sessionUserId, targetUserId);
    await orgMembersRepository.unbanUser(targetUserId);
  },

  async revokeSessions(
    activeOrgId: string,
    sessionUserId: string,
    targetUserId: string,
  ) {
    await this.verifyAdminAccess(activeOrgId, sessionUserId, targetUserId);
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
    await this.verifyAdminAccess(activeOrgId, sessionUserId);

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
    await this.verifyAdminAccess(activeOrgId, sessionUserId);
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
    file: { buffer: Buffer; mimetype: string; originalname: string },
    headers: HeadersInit,
  ) {
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
    await this.verifyAdminAccess(activeOrgId, sessionUserId);

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
};
