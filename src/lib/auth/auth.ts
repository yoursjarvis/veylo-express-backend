import { betterAuth, type SecondaryStorage } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  admin,
  lastLoginMethod,
  organization,
  twoFactor,
} from "better-auth/plugins";

import { mailService } from "@/core/mail";
import { logger } from "@/lib/logger";
import prisma, { basePrisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { config } from "@/utils/config";

function resolveTrustedOrigins(): string[] {
  const origins = config("app.origins");
  const trusted = [...origins];

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      // Add wildcard for subdomains (e.g., http://*.veylo.local:3000)
      trusted.push(
        `${url.protocol}//*.${url.hostname}${url.port ? `:${url.port}` : ""}`,
      );
    } catch {
      // ignore invalid origins
    }
  }

  if (trusted.length === 0) {
    trusted.push(new URL(config("app.url")).origin);
  }

  return trusted;
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
  debug: true,
  appName: config("app.name"),
  baseURL: config("auth.betterAuth.url"),
  basePath: "/api/v1/auth",
  secret: config("auth.betterAuth.secret"),

  trustedOrigins: resolveTrustedOrigins(),
  database: prismaAdapter(basePrisma, {
    provider: "postgresql",
  }),
  secondaryStorage: buildSecondaryStorage(),
  advanced: {
    useSecureCookies: config("app.env") === "production",
    crossSubDomainCookies: {
      enabled: true,
      domain: config("app.domain"),
    },
    database: {
      generateId: "uuid",
    },
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: true },
      lastName: { type: "string", required: true },
      notificationPreferences: {
        type: "string",
        required: false,
        defaultValue: "[]",
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
      lastLoginAt: { type: "date", required: false, input: false },
      passwordChangedAt: { type: "date", required: false, input: false },
      failedLoginAttempts: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
      },
      lockedUntil: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Check if the user is being invited
          const invitation = await prisma.invitation.findFirst({
            where: {
              email: user.email,
              status: "pending",
            },
          });

          if (invitation) {
            return {
              data: {
                ...user,
                emailVerified: true,
              },
            };
          }

          return { data: user };
        },
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
              logger.error(
                { error, userId: user.id },
                "[AUTH][welcome] enqueue failed for verified signup",
              );
            }
          }

          // Auto-accept pending invitations
          try {
            const invitations = await prisma.invitation.findMany({
              where: { email: user.email, status: "pending" },
            });

            for (const inv of invitations) {
              // Create the member record
              await prisma.member.create({
                data: {
                  organizationId: inv.organizationId,
                  userId: user.id,
                  role: inv.role || "member",
                },
              });

              // Assign org role via UserRoleAssignment
              const roleName = (inv.role || "member").toLowerCase();
              const orgRole = await prisma.role.findFirst({
                where: { organizationId: inv.organizationId, name: roleName },
              });
              if (orgRole) {
                await prisma.userRoleAssignment.create({
                  data: {
                    userId: user.id,
                    roleId: orgRole.id,
                    scopeType: "ORGANIZATION",
                    scopeId: inv.organizationId,
                    organizationId: inv.organizationId,
                  },
                });
              }

              // If projectIds scope is defined, add user to those projects
              if (inv.projectIds && Array.isArray(inv.projectIds)) {
                for (const projectId of inv.projectIds) {
                  if (typeof projectId === "string") {
                    try {
                      await prisma.projectMember.create({
                        data: {
                          projectId,
                          userId: user.id,
                          organizationId: inv.organizationId,
                        },
                      });

                      const projectRole = await prisma.role.findFirst({
                        where: {
                          organizationId: inv.organizationId,
                          name: "member",
                        },
                      });
                      if (projectRole) {
                        await prisma.userRoleAssignment.create({
                          data: {
                            userId: user.id,
                            roleId: projectRole.id,
                            scopeType: "PROJECT",
                            scopeId: projectId,
                            organizationId: inv.organizationId,
                          },
                        });
                      }
                    } catch (err) {
                      logger.error(
                        { err, projectId, userId: user.id },
                        "[AUTH][invite] Failed to auto-assign project",
                      );
                    }
                  }
                }
              }

              // Mark invitation as accepted
              await prisma.invitation.update({
                where: { id: inv.id },
                data: { status: "accepted" },
              });
            }
          } catch (error) {
            logger.error(
              { error, userId: user.id },
              "[AUTH][invite] auto-accept failed",
            );
          }
        },
      },
    },
  },
  session: {
    storeSessionInDatabase: true,
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
    additionalFields: {
      activeOrganizationId: { type: "string", required: false },
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
      mapProfileToUser: (profile: {
        name?: string | null;
        email?: string | null;
        picture?: string | null;
        given_name?: string | null;
        family_name?: string | null;
      }) => {
        return {
          name: profile.name || undefined,
          email: profile.email || undefined,
          image: profile.picture || undefined,
          firstName:
            profile.given_name || profile.name?.split(" ")[0] || "User",
          lastName:
            profile.family_name ||
            profile.name?.split(" ").slice(1).join(" ") ||
            "Name",
        };
      },
    },
    github: {
      clientId: config("auth.social.github.clientId"),
      clientSecret: config("auth.social.github.clientSecret"),
      mapProfileToUser: (profile: {
        name?: string | null;
        login?: string | null;
        email?: string | null;
        avatar_url?: string | null;
      }) => {
        const parts = (profile.name || profile.login || "").split(" ");
        return {
          name: profile.name || profile.login || undefined,
          email: profile.email || undefined,
          image: profile.avatar_url || undefined,
          firstName: parts[0] || "User",
          lastName: parts.slice(1).join(" ") || "Name",
        };
      },
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, token }, _request) => {
      const origin =
        _request?.headers.get("origin") ||
        (_request?.headers.get("referer")
          ? new URL(_request.headers.get("referer")!).origin
          : null) ||
        config("auth.betterAuth.emailVerificationRedirectURL").replace(
          /\/verify-email$/,
          "",
        );

      const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;

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
    minPasswordLength: 6,
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

      const origin =
        _request?.headers.get("origin") ||
        (_request?.headers.get("referer")
          ? new URL(_request.headers.get("referer")!).origin
          : null) ||
        config("auth.betterAuth.resetPasswordRedirectURL").replace(
          /\/reset-password$/,
          "",
        );

      const resetUrl = token
        ? `${origin}/reset-password?token=${encodeURIComponent(token)}`
        : `${origin}/reset-password`;

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
        logger.error(
          { error },
          "[AUTH][reset-password-success] enqueue failed",
        );
      }
    },
  },
  plugins: [
    lastLoginMethod(),
    admin(),
    organization({
      creatorRole: "owner",
      sendInvitationEmail: async (data) => {
        const organization = await prisma.organization.findUnique({
          where: { id: data.organization.id },
          select: { slug: true, name: true },
        });

        const frontendUrl = new URL(config("app.frontendUrl"));
        if (organization?.slug) {
          frontendUrl.hostname = `${organization.slug}.${frontendUrl.hostname}`;
        }

        const inviteUrl = `${frontendUrl.origin}/accept-invite?id=${data.id}`;
        try {
          void mailService
            .to(data.email)
            .view("invite", {
              inviteUrl,
              organizationName: organization?.name || data.organization.name,
              role: data.role,
            })
            .queue();
        } catch (error) {
          logger.error(
            { error, email: data.email },
            "[AUTH][invite] enqueue failed",
          );
        }
      },
    }),
    twoFactor({
      issuer: config("app.name"),
      allowPasswordless: true,
    }),
  ],
});
