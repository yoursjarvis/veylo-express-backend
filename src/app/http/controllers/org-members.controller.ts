import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { orgMembersService } from "@/app/services/org-members.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { logger } from "@/lib/logger";
import { UnauthorizedException, BadRequestException, NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

async function getActiveOrgAndSession(req: Request) {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    throw new BadRequestException("No active organization found");
  }

  return { activeOrgId, sessionUserId: session.user.id };
}

export const orgMembersController = {
  banMember: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { reason } = req.body;
    const { activeOrgId, sessionUserId } = await getActiveOrgAndSession(req);

    await orgMembersService.banMember(activeOrgId, sessionUserId, id, reason);

    return ok(res, "Member banned successfully");
  }),

  unbanMember: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId, sessionUserId } = await getActiveOrgAndSession(req);

    await orgMembersService.unbanMember(activeOrgId, sessionUserId, id);

    return ok(res, "Member unbanned successfully");
  }),

  revokeSessions: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId, sessionUserId } = await getActiveOrgAndSession(req);

    await orgMembersService.revokeSessions(activeOrgId, sessionUserId, id);

    return ok(res, "Sessions revoked successfully");
  }),

  impersonateUser: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId, sessionUserId } = await getActiveOrgAndSession(req);

    const result = await orgMembersService.impersonateUser(
      activeOrgId,
      sessionUserId,
      id,
      betterAuthHeaders(req)
    );

    if (result.success) {
      return ok(res, "Impersonation started", result.result);
    } else {
      res.setHeader(
        "Set-Cookie",
        `better-auth.session_token=${result.fallback?.token}; Path=/; HttpOnly; SameSite=Lax`
      );
      return ok(res, "Impersonation started", { session: result.fallback?.session });
    }
  }),

  setPassword: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { password } = req.body;
    const { activeOrgId, sessionUserId } = await getActiveOrgAndSession(req);

    await orgMembersService.verifyAdminAccess(activeOrgId, sessionUserId, id);

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    return res.status(501).json({
      message:
        "Direct password setting requires global admin role. Please use the password reset flow.",
    });
  }),

  bulkInvite: asyncHandler(async (req: Request, res: Response) => {
    const { activeOrgId } = await getActiveOrgAndSession(req);

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const results = await orgMembersService.bulkInvite(
      activeOrgId,
      req.file,
      betterAuthHeaders(req)
    );

    return ok(res, "Bulk invite processed", results);
  }),

  inviteMember: asyncHandler(async (req: Request, res: Response) => {
    const { activeOrgId, sessionUserId } = await getActiveOrgAndSession(req);
    const { email, role, projectIds } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    await orgMembersService.verifyAdminAccess(activeOrgId, sessionUserId);

    try {
      const result = await orgMembersService.inviteMember(
        activeOrgId,
        email,
        role,
        projectIds,
        betterAuthHeaders(req)
      );

      return ok(res, "Invitation sent successfully", result);
    } catch (error) {
      const err = error as Error & { status?: number | string; code?: string };
      logger.error({ error: err, email }, "[ORG_MEMBERS] inviteMember failed");
      let statusCode = 500;
      if (err.status) {
        if (typeof err.status === "number") {
          statusCode = err.status;
        } else if (typeof err.status === "string") {
          const parsed = parseInt(err.status, 10);
          if (!isNaN(parsed)) {
            statusCode = parsed;
          } else {
            const statusMap: Record<string, number> = {
              BAD_REQUEST: 400,
              UNAUTHORIZED: 401,
              FORBIDDEN: 403,
              NOT_FOUND: 404,
              CONFLICT: 409,
              UNPROCESSABLE_ENTITY: 422,
              INTERNAL_SERVER_ERROR: 500,
            };
            if (err.status in statusMap) {
              statusCode = statusMap[err.status];
            }
          }
        }
      }
      return res.status(statusCode).json({
        message: err.message || "Failed to send invitation",
        code: err.code,
      });
    }
  }),

  getMembers: asyncHandler(async (req: Request, res: Response) => {
    const { activeOrgId, sessionUserId } = await getActiveOrgAndSession(req);

    const limit = parseInt(req.query.limit as string) || 20;
    const cursor = req.query.cursor as string;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string; // 'banned' or 'active'

    const result = await orgMembersService.getMembers(activeOrgId, sessionUserId, {
      limit,
      cursor,
      search,
      role,
      status,
    });

    return ok(res, "Members fetched", result);
  }),

  getInvitationPublic: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    try {
      const invitation = await orgMembersService.getInvitationPublic(id);
      return ok(res, "Invitation found", invitation);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (error instanceof BadRequestException) {
        return res.status(400).json({ message: "Invitation is no longer active" });
      }
      throw error;
    }
  }),

  getPendingInvitations: asyncHandler(async (req: Request, res: Response) => {
    const { activeOrgId, sessionUserId } = await getActiveOrgAndSession(req);

    const invitations = await orgMembersService.getPendingInvitations(activeOrgId, sessionUserId);

    return ok(res, "Pending invitations fetched", invitations);
  }),

  revokeInvitation: asyncHandler(async (req: Request, res: Response) => {
    const { activeOrgId, sessionUserId } = await getActiveOrgAndSession(req);
    const id = req.params.id as string;

    try {
      const result = await orgMembersService.revokeInvitation(
        activeOrgId,
        sessionUserId,
        id,
        betterAuthHeaders(req)
      );

      return ok(res, "Invitation revoked successfully", result);
    } catch (error) {
      const err = error as Error & { status?: number | string; code?: string };
      logger.error({ error: err, id }, "[ORG_MEMBERS] revokeInvitation failed");
      let statusCode = 500;
      if (err.status) {
        if (typeof err.status === "number") {
          statusCode = err.status;
        } else if (typeof err.status === "string") {
          const parsed = parseInt(err.status, 10);
          if (!isNaN(parsed)) {
            statusCode = parsed;
          } else {
            const statusMap: Record<string, number> = {
              BAD_REQUEST: 400,
              UNAUTHORIZED: 401,
              FORBIDDEN: 403,
              NOT_FOUND: 404,
              CONFLICT: 409,
              UNPROCESSABLE_ENTITY: 422,
              INTERNAL_SERVER_ERROR: 500,
            };
            if (err.status in statusMap) {
              statusCode = statusMap[err.status];
            }
          }
        }
      }
      return res.status(statusCode).json({
        message: err.message || "Failed to revoke invitation",
        code: err.code,
      });
    }
  }),
};
