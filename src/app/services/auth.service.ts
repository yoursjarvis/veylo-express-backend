import { UnauthorizedException } from "@/utils/app-error";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { forwardSetCookie } from "@/lib/auth/set-cookie";
import { authRepository } from "@/app/repositories/auth.repository";
import { parseUserAgent } from "@/utils/user-agent";
import type { Request, Response } from "express";
import prisma from "@/lib/prisma";
import { config } from "@/utils/config";
import { mailService } from "@/app/services/mail";
import { logger } from "@/lib/logger";

function getIpAddress(req: Request): string | undefined {
  // `trust proxy` is enabled in `src/app.ts` so `req.ip` respects X-Forwarded-For.
  return req.ip || undefined;
}

export const authService = {
  async signUp(
    req: Request,
    res: Response,
    input: { firstName: string; lastName: string; email: string; password: string }
  ) {
    const headers = betterAuthHeaders(req);
    const callbackURL = config("auth.betterAuth.emailVerificationRedirectURL");

    const result = await auth.api.signUpEmail({
      headers,
      returnHeaders: true,
      body: {
        email: input.email,
        password: input.password,
        name: `${input.firstName} ${input.lastName}`.trim(),
        firstName: input.firstName,
        lastName: input.lastName,
        callbackURL,
      },
    });

    forwardSetCookie(res, result.headers);

    try {
      void mailService
        .to(input.email, `${input.firstName} ${input.lastName}`.trim() || undefined)
        .view("welcome", { firstName: input.firstName })
        .queue();
    } catch (error) {
      logger.error({ error }, "[AUTH][welcome] enqueue failed");
    }

    return result.response;
  },

  async login(req: Request, res: Response, input: { email: string; password: string }) {
    const headers = betterAuthHeaders(req);
    const now = new Date();

    const user = await authRepository.findUserByEmail(input.email);
    if (user) {
      if (!user.isActive || user.deletedAt)
        throw new UnauthorizedException("Invalid credentials");
      if (user.lockedUntil && user.lockedUntil > now) {
        throw new UnauthorizedException("Invalid credentials");
      }
    }

    try {
      const result = await auth.api.signInEmail({
        headers,
        returnHeaders: true,
        body: {
          email: input.email,
          password: input.password,
        },
      });

      forwardSetCookie(res, result.headers);

      const sessionToken = result.response?.token ?? undefined;
      if (sessionToken) {
        const { browser, os } = parseUserAgent(req.headers["user-agent"]);
        await authRepository.updateSessionMetadataByToken(sessionToken, {
          browser,
          os,
          ipAddress: getIpAddress(req),
          userAgent: req.headers["user-agent"],
          lastActiveAt: now,
        });
      }

      if (user) await authRepository.markLoginSuccess(user.id, now);

      return result.response;
    } catch (error) {
      await authRepository.markLoginFailure(input.email, now);
      throw new UnauthorizedException("Invalid credentials");
    }
  },

  async logout(req: Request, res: Response) {
    const headers = betterAuthHeaders(req);
    const result = await auth.api.signOut({
      headers,
      returnHeaders: true,
    });
    forwardSetCookie(res, result.headers);
    return result.response;
  },

  async logoutAll(req: Request, res: Response) {
    const headers = betterAuthHeaders(req);

    // Revoke all sessions + clear current cookie.
    await auth.api.revokeSessions({ headers });
    const result = await auth.api.signOut({ headers, returnHeaders: true });

    forwardSetCookie(res, result.headers);
    return result.response;
  },

  async me(req: Request, res: Response) {
    const headers = betterAuthHeaders(req);
    const result = await auth.api.getSession({
      headers,
      returnHeaders: true,
    });
    forwardSetCookie(res, result.headers);
    return result.response;
  },

  async requestPasswordReset(req: Request, input: { email: string; redirectTo: string }) {
    const headers = betterAuthHeaders(req);
    await auth.api.requestPasswordReset({
      headers,
      body: {
        email: input.email,
        redirectTo: input.redirectTo,
      },
    });
  },

  async resetPassword(
    req: Request,
    res: Response,
    input: { token: string; newPassword: string }
  ) {
    const headers = betterAuthHeaders(req);
    const result = await auth.api.resetPassword({
      headers,
      returnHeaders: true,
      body: {
        token: input.token,
        newPassword: input.newPassword,
      },
    });
    forwardSetCookie(res, result.headers);
    return result.response;
  },

  async verifyEmail(req: Request, res: Response, token: string) {
    const result = await auth.api.verifyEmail({
      query: { token },
      returnHeaders: true,
    });
    forwardSetCookie(res, result.headers);
    return result.response;
  },

  async changePassword(
    req: Request,
    res: Response,
    input: { currentPassword: string; newPassword: string }
  ) {
    const headers = betterAuthHeaders(req);
    const sessionResult = await auth.api.getSession({ headers });
    const userId = Number(sessionResult?.user?.id);

    const result = await auth.api.changePassword({
      headers,
      returnHeaders: true,
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: true,
      },
    });
    forwardSetCookie(res, result.headers);
    if (Number.isFinite(userId)) {
      await prisma.user.update({
        where: { id: userId },
        data: { passwordChangedAt: new Date() },
      });
    }
    return result.response;
  },

  async listSessions(req: Request) {
    const headers = betterAuthHeaders(req);
    const result = await auth.api.listSessions({ headers });
    return result;
  },

  async revokeSession(req: Request, sessionId: number) {
    const headers = betterAuthHeaders(req);

    // Authorization is enforced by matching against the authenticated user.
    const sessionResult = await auth.api.getSession({ headers, returnHeaders: true });
    const userId = Number(sessionResult.response?.user?.id);
    if (!Number.isFinite(userId)) throw new UnauthorizedException();

    await authRepository.revokeSessionByIdForUser(sessionId, userId);
    // Also revoke by token (if present) to ensure Better Auth considers it invalid.
    const dbSession = await prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { token: true },
    });
    if (dbSession?.token) {
      await auth.api.revokeSession({
        headers,
        body: { token: dbSession.token },
      });
    }
  },
};
