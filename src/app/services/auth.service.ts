import { authRepository } from "@/app/repositories/auth.repository";
import { mailService } from "@/core/mail";

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

    const result = await (auth.api.signUpEmail as any)({
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

    if (result.response?.user) {
      const account = await prisma.account.findFirst({
        where: {
          userId: result.response.user.id,
          providerId: "credential",
        },
      });
      (result.response.user as any).hasPassword = !!account;
    }

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
    const verification = await prisma.verification.findFirst({
      where: { value: token },
    });

    const result = await auth.api.verifyEmail({
      query: { token },
      returnHeaders: true,
    });
    forwardSetCookie(res, result.headers);

    if (verification && (result.response as any)?.status !== false) {
      const user = await prisma.user.findUnique({
        where: { email: verification.identifier },
      });
      if (user) {
        try {
          void mailService
            .to(user.email, user.name || undefined)
            .view("welcome", { firstName: (user as any).firstName })
            .queue();
        } catch (error) {
          logger.error({ error, userId: user.id }, "[AUTH][welcome] enqueue failed after verification");
        }
      }
    }

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

  async updateUser(
    req: Request,
    res: Response,
    input: { firstName?: string; lastName?: string; name?: string; image?: string }
  ) {
    const headers = betterAuthHeaders(req);
    const result = await auth.api.updateUser({
      headers,
      returnHeaders: true,
      body: input,
    });
    forwardSetCookie(res, result.headers);
    return result.response;
  },

  async sendTwoFactorOtp(req: Request) {
    const headers = betterAuthHeaders(req);
    const session = await auth.api.getSession({ headers });
    if (!session?.user) throw new UnauthorizedException();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const identifier = `2fa-enable:${session.user.id}`;

    // Cleanup any existing OTPs for this user
    await prisma.verification.deleteMany({
      where: { identifier },
    });

    await prisma.verification.create({
      data: {
        identifier,
        value: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    try {
      void mailService
        .to(session.user.email, session.user.name ?? undefined)
        .view("two-factor-otp", { otp, firstName: (session.user as any).firstName })
        .queue();
    } catch (error) {
      logger.error({ error }, "[AUTH][two-factor-otp] enqueue failed");
    }
  },

  async enableTwoFactorSocial(req: Request, res: Response, input: { otp: string }) {
    const headers = betterAuthHeaders(req);
    const session = await auth.api.getSession({ headers });
    if (!session?.user) throw new UnauthorizedException();

    const identifier = `2fa-enable:${session.user.id}`;
    const otp = input.otp.trim();

    const verification = await prisma.verification.findFirst({
      where: {
        identifier,
        value: otp,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    await prisma.verification.delete({ where: { id: verification.id } });

    // Enable 2FA.
    const result = await (auth.api.enableTwoFactor as any)({
      headers,
      body: {
        password: "", // Passing empty string as allowPasswordless expects it if body is validated
      },
    });

    if (result.data) {
      return result;
    }

    // Fallback if Better Auth didn't return data directly in result.data (unlikely but safe)
    return result;
  },
};
