import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { config } from "@/utils/config";
import { mailService } from "@/app/services/mail";
import { logger } from "@/lib/logger";
import { betterAuth, type SecondaryStorage } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

function resolveTrustedOrigins(): string[] {
  const origins = config("app.origins");
  return origins.length > 0 ? origins : [new URL(config("app.url")).origin];
}

function buildSecondaryStorage(): SecondaryStorage | undefined {
  // When Redis isn't reachable (local dev without Redis), Better Auth still works
  // using DB-backed sessions. Secondary storage is an optional scalability layer.
  if (!config("auth.betterAuth.secondaryStorageEnabled")) return undefined;

  return {
    async get(key) {
      return await redis.get(key);
    },
    async set(key, value, ttl) {
      if (ttl && ttl > 0) {
        await redis.set(key, value, "EX", ttl);
        return;
      }
      await redis.set(key, value);
    },
    async delete(key) {
      await redis.del(key);
    },
  };
}

export const auth = betterAuth({
  appName: config("app.name"),
  // Security best practice: do not rely on request-inferred origins.
  baseURL: config("auth.betterAuth.url"),
  secret: config("auth.betterAuth.secret"),
  trustedOrigins: resolveTrustedOrigins(),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secondaryStorage: buildSecondaryStorage(),
  advanced: {
    useSecureCookies: config("app.env") === "production",
    database: {
      // Keep auth-generated ids aligned with the Prisma schema's UUID primary keys.
      generateId: "uuid",
    },
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      lastName: { type: "string", required: true },
      // Enterprise fields (server-controlled)
      isActive: { type: "boolean", required: false, defaultValue: true, input: false },
      lastLoginAt: { type: "date", required: false, input: false },
      passwordChangedAt: { type: "date", required: false, input: false },
      failedLoginAttempts: { type: "number", required: false, defaultValue: 0, input: false },
      lockedUntil: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    // 7 days; refreshed at most once per day by default behavior
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
    additionalFields: {
      deviceName: { type: "string", required: false, input: false },
      browser: { type: "string", required: false, input: false },
      os: { type: "string", required: false, input: false },
      country: { type: "string", required: false, input: false },
      location: { type: "string", required: false, input: false },
      lastActiveAt: { type: "date", required: false, input: false },
      revokedAt: { type: "date", required: false, input: false },
    },
  },
  emailVerification: {
    // Stub: integrate with your mail/queue provider later.
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, token }, _request) => {
      // Avoid awaiting any email operation here to prevent timing attacks.

      const verifyUrl = `${config(
        "auth.betterAuth.emailVerificationRedirectURL"
      )}?token=${encodeURIComponent(token)}`;

      try {
        const firstName =
          typeof (user as { firstName?: unknown }).firstName === "string"
            ? (user as { firstName?: string }).firstName
            : undefined;

        void mailService
          .to(user.email, user.name ?? undefined)
          .view("verify-email", { firstName, verifyUrl })
          .queue();
      } catch (error) {
        logger.error({ error }, "[AUTH][verify-email] enqueue failed");
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    // Enforces enumeration-safe signup and blocks session creation until verified.
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30, // 30 minutes
    sendResetPassword: async ({ user, url }, _request) => {
      const token = (() => {
        try {
          return new URL(url).searchParams.get("token") ?? undefined;
        } catch {
          return undefined;
        }
      })();

      const redirectBase = config("auth.betterAuth.resetPasswordRedirectURL");
      const resetUrl = token
        ? `${redirectBase}?token=${encodeURIComponent(token)}`
        : redirectBase;

      try {
        const firstName =
          typeof (user as { firstName?: unknown }).firstName === "string"
            ? (user as { firstName?: string }).firstName
            : undefined;

        void mailService
          .to(user.email, user.name ?? undefined)
          .view("forgot-password", { firstName, resetUrl })
          .queue();
      } catch (error) {
        logger.error({ error }, "[AUTH][forgot-password] enqueue failed");
      }
    },
    onPasswordReset: async ({ user }, _request) => {
      try {
        const firstName =
          typeof (user as { firstName?: unknown }).firstName === "string"
            ? (user as { firstName?: string }).firstName
            : undefined;

        void mailService
          .to(user.email, user.name ?? undefined)
          .view("reset-password-success", { firstName })
          .queue();
      } catch (error) {
        logger.error({ error }, "[AUTH][reset-password-success] enqueue failed");
      }
    },
  },
});
