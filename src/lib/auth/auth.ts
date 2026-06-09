import { mailService } from "@/core/mail";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { config } from "@/utils/config";

import { logger } from "@/lib/logger";
import { betterAuth, type SecondaryStorage } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { lastLoginMethod, organization, twoFactor } from "better-auth/plugins";

function resolveTrustedOrigins(): string[] {
  const origins = config("app.origins");
  return origins.length > 0 ? origins : [new URL(config("app.url")).origin];
}

function buildSecondaryStorage(): SecondaryStorage | undefined {
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
  baseURL: config("auth.betterAuth.url"),
  basePath: "/api/v1/auth",
  secret: config("auth.betterAuth.secret"),

  trustedOrigins: resolveTrustedOrigins(),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secondaryStorage: buildSecondaryStorage(),
  advanced: {
    useSecureCookies: config("app.env") === "production",
    database: {
      generateId: "uuid",
    },
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      lastName: { type: "string", required: true },
      isActive: { type: "boolean", required: false, defaultValue: true, input: false },
      lastLoginAt: { type: "date", required: false, input: false },
      passwordChangedAt: { type: "date", required: false, input: false },
      failedLoginAttempts: { type: "number", required: false, defaultValue: 0, input: false },
      lockedUntil: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user.emailVerified) {
            try {
              const firstName =
                typeof (user as { firstName?: unknown }).firstName === "string"
                  ? (user as { firstName?: string }).firstName
                  : undefined;

              void mailService
                .to(user.email, user.name ?? undefined)
                .view("welcome", { firstName })
                .queue();
            } catch (error) {
              logger.error({ error, userId: user.id }, "[AUTH][welcome] enqueue failed for verified signup");
            }
          }
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
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
  socialProviders: {
    google: {
      clientId: config("auth.social.google.clientId"),
      clientSecret: config("auth.social.google.clientSecret"),
      mapProfileToUser: (profile: any) => {
        return {
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          firstName: profile.given_name || profile.name?.split(" ")[0] || "User",
          lastName: profile.family_name || profile.name?.split(" ").slice(1).join(" ") || "Name",
        };
      },
    },
    github: {
      clientId: config("auth.social.github.clientId"),
      clientSecret: config("auth.social.github.clientSecret"),
      mapProfileToUser: (profile: any) => {
        const parts = (profile.name || profile.login || "").split(" ");
        return {
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          firstName: parts[0] || "User",
          lastName: parts.slice(1).join(" ") || "Name",
        };
      },
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, token }, _request) => {
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
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
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
  plugins: [
    lastLoginMethod(),
    organization({
      creatorRole: "owner",
    }),
    twoFactor({
      issuer: config("app.name"),
      allowPasswordless: true,
    }),
  ],
});



