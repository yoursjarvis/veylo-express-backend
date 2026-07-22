import type { NextFunction, Request, Response } from "express";

import { authRepository } from "@/app/repositories/auth.repository";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { forwardSetCookie } from "@/lib/auth/set-cookie";
import { redis } from "@/lib/redis";
import { UnauthorizedException } from "@/utils/app-error";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const headers = betterAuthHeaders(req);
    const result = await auth.api.getSession({
      headers,
      returnHeaders: true,
    });

    forwardSetCookie(res, result.headers);

    if (!result.response?.user || !result.response?.session) {
      throw new UnauthorizedException();
    }

    req.auth = {
      user: result.response.user as unknown as NonNullable<
        Express.Request["auth"]
      >["user"],
      session: result.response.session as unknown as NonNullable<
        Express.Request["auth"]
      >["session"],
    };

    // Attach permissions version header for frontend cache invalidation
    try {
      const version = await redis.get(
        `user:permissions_version:${req.auth.user.id}`,
      );
      res.setHeader("x-permissions-version", version || "0");
    } catch (e) {
      // Ignore redis errors here so auth still works
    }

    const token = result.response.session.token;
    if (token) {
      await authRepository.updateSessionMetadataByToken(token, {
        lastActiveAt: new Date(),
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
