import { authRepository } from "@/app/repositories/auth.repository";
import { mailService } from "@/app/services/mail";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { forwardSetCookie } from "@/lib/auth/set-cookie";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { ForbiddenException, UnauthorizedException } from "@/utils/app-error";
import { config } from "@/utils/config";
import { parseUserAgent } from "@/utils/user-agent";
import { isAPIError } from "@better-auth/core/utils/is-api-error";
import type { Request, Response } from "express";

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
    const email = input.email.trim().toLowerCase();

    const user = await authRepository.findUserByEmail(email);
    if (user) {
      if (!user.isActive || user.deletedAt)
        throw new UnauthorizedException("Invalid credentials");
      if (user.lockedUntil && user.lockedUntil > now) {
        throw new UnauthorizedException("Invalid credentials");
      }
    }

    let result: any;
    try {
      result = await auth.api.signInEmail({
        headers,
        returnHeaders: true,
        body: {
          email,
          password: input.password,
        },
      });
    } catch (error) {
      if (isAPIError(error)) {
        if (error.message === "Email not verified") {
          logger.warn({ error, email }, "[AUTH][login] email not verified");
          throw new ForbiddenException("Email not verified");
        }

        if (
          error.message === "Invalid email or password" ||
          error.message === "Invalid email" ||
          error.message === "Invalid password" ||
          error.message === "Credential account not found"
        ) {
          await authRepository.markLoginFailure(email, now);
          logger.warn({ error, email }, "[AUTH][login] sign-in failed");
          throw new UnauthorizedException("Invalid credentials");
        }
      }

      logger.error({ error, email }, "[AUTH][login] unexpected sign-in failure");
      throw new UnauthorizedException("Invalid credentials");
    }

    forwardSetCookie(res, result.headers);

    const sessionToken = result.response?.token ?? undefined;
    if (sessionToken) {
      const { browser, os } = parseUserAgent(req.headers["user-agent"]);
      try {
        await authRepository.updateSessionMetadataByToken(sessionToken, {
          browser,
          os,
          ipAddress: getIpAddress(req),
          userAgent: req.headers["user-agent"],
          lastActiveAt: now,
        });
      } catch (error) {
        logger.error({ error, email }, "[AUTH][login] session metadata update failed");
      }
    }

    if (user) {
      try {
        await authRepository.markLoginSuccess(user.id, now);
      } catch (error) {
        logger.error({ error, userId: user.id, email }, "[AUTH][login] login success bookkeeping failed");
      }
    }

    return result.response;
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
    const userId = sessionResult?.user?.id;

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
    if (userId) {
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

  async revokeSession(req: Request, sessionId: string) {
    const headers = betterAuthHeaders(req);

    // Authorization is enforced by matching against the authenticated user.
    const sessionResult = await auth.api.getSession({ headers, returnHeaders: true });
    const userId = sessionResult.response?.user?.id;
    if (!userId) throw new UnauthorizedException();

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
