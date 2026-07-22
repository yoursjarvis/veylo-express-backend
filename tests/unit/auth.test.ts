import { describe, expect, it, vi, beforeEach } from "vitest";

const { mocks } = vi.hoisted(() => {
  const mockMailQueue = vi.fn();
  const mockMailView = vi.fn().mockReturnValue({ queue: mockMailQueue });
  const mockMailTo = vi.fn().mockReturnValue({ view: mockMailView });
  
  const mockPrisma = {
    invitation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    member: {
      create: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
    },
    userRoleAssignment: {
      create: vi.fn(),
    },
    projectMember: {
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
  };
  
  return {
    mocks: {
      mockMailQueue,
      mockMailView,
      mockMailTo,
      mockPrisma,
    }
  };
});

vi.mock("@/core/mail", () => ({
  mailService: {
    to: mocks.mockMailTo,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: mocks.mockPrisma,
  basePrisma: {},
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("@/utils/config", () => ({
  config: vi.fn((key: string) => {
    const configs: Record<string, any> = {
      "app.name": "Veylo",
      "app.origins": ["http://localhost:3000", "invalid-url"],
      "app.url": "http://localhost:3000",
      "app.env": "development",
      "app.domain": "localhost",
      "auth.betterAuth.url": "http://localhost:4000",
      "auth.betterAuth.secret": "secret",
      "auth.betterAuth.secondaryStorageEnabled": true,
      "auth.betterAuth.emailVerificationRedirectURL": "http://localhost:3000/verify-email",
      "auth.betterAuth.resetPasswordRedirectURL": "http://localhost:3000/reset-password",
      "auth.social.google.clientId": "google-client",
      "auth.social.google.clientSecret": "google-secret",
      "auth.social.github.clientId": "github-client",
      "auth.social.github.clientSecret": "github-secret",
      "app.frontendUrl": "http://localhost:3000",
    };
    return configs[key];
  }),
}));

vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({})),
}));
vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: vi.fn(),
}));
vi.mock("better-auth/plugins", () => ({
  admin: vi.fn(),
  lastLoginMethod: vi.fn(),
  organization: vi.fn((config) => config),
  twoFactor: vi.fn(),
}));

import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import "@/lib/auth/auth"; // Imports and executes the file

describe("auth.ts configuration", () => {
  let config: any;
  let orgConfig: any;

  beforeAll(() => {
    config = vi.mocked(betterAuth).mock.calls[0]?.[0];
    orgConfig = vi.mocked(organization).mock.calls[0]?.[0];
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveTrustedOrigins", () => {
    it("should resolve valid origins and subdomains", () => {
      expect(config.trustedOrigins).toContain("http://*.localhost:3000");
    });
  });

  describe("SecondaryStorage", () => {
    it("should handle get", async () => {
      const storage = config.secondaryStorage;
      expect(storage).toBeDefined();
      await storage.get("key");
      const { redis } = await import("@/lib/redis");
      expect(redis.get).toHaveBeenCalledWith("key");
    });

    it("should handle set with ttl", async () => {
      const storage = config.secondaryStorage;
      await storage.set("key", "value", 3600);
      const { redis } = await import("@/lib/redis");
      expect(redis.set).toHaveBeenCalledWith("key", "value", "EX", 3600);
    });
    
    it("should handle set without ttl", async () => {
      const storage = config.secondaryStorage;
      await storage.set("key", "value");
      const { redis } = await import("@/lib/redis");
      expect(redis.set).toHaveBeenCalledWith("key", "value");
    });

    it("should handle delete", async () => {
      const storage = config.secondaryStorage;
      await storage.delete("key");
      const { redis } = await import("@/lib/redis");
      expect(redis.del).toHaveBeenCalledWith("key");
    });
  });

  describe("databaseHooks", () => {
    describe("user.create.before", () => {
      it("should set emailVerified true if pending invitation exists", async () => {
        mocks.mockPrisma.invitation.findFirst.mockResolvedValueOnce({ id: "inv-1" });
        const res = await config.databaseHooks.user.create.before({ email: "test@test.com" });
        expect(res.data.emailVerified).toBe(true);
      });
      it("should return user if no pending invitation", async () => {
        mocks.mockPrisma.invitation.findFirst.mockResolvedValueOnce(null);
        const res = await config.databaseHooks.user.create.before({ email: "test@test.com" });
        expect(res.data.emailVerified).toBeUndefined();
      });
    });

    describe("user.create.after", () => {
      it("should send welcome email if emailVerified and auto-accept invitations", async () => {
        const user = { id: "u1", email: "test@test.com", emailVerified: true, firstName: "John" };
        mocks.mockPrisma.invitation.findMany.mockResolvedValueOnce([
          { id: "inv1", organizationId: "org1", role: "admin", projectIds: ["p1"] }
        ]);
        mocks.mockPrisma.role.findFirst.mockResolvedValue({ id: "role1" }); // mock both org and project role

        await config.databaseHooks.user.create.after(user);
        
        expect(mocks.mockMailTo).toHaveBeenCalledWith("test@test.com", undefined);
        expect(mocks.mockMailView).toHaveBeenCalledWith("welcome", { firstName: "John" });
        expect(mocks.mockMailQueue).toHaveBeenCalled();

        expect(mocks.mockPrisma.member.create).toHaveBeenCalled();
        expect(mocks.mockPrisma.userRoleAssignment.create).toHaveBeenCalledTimes(2);
        expect(mocks.mockPrisma.projectMember.create).toHaveBeenCalled();
        expect(mocks.mockPrisma.invitation.update).toHaveBeenCalledWith({ where: { id: "inv1" }, data: { status: "accepted" }});
      });
      
      it("should handle errors in welcome email silently", async () => {
         mocks.mockMailQueue.mockImplementationOnce(() => { throw new Error("queue error"); });
         const user = { id: "u2", email: "err@test.com", emailVerified: true, firstName: "Jane" };
         mocks.mockPrisma.invitation.findMany.mockResolvedValueOnce([]);
         
         await config.databaseHooks.user.create.after(user);
         const { logger } = await import("@/lib/logger");
         expect(logger.error).toHaveBeenCalled();
      });
    });
  });

  describe("socialProviders mapProfileToUser", () => {
    it("google maps profile", () => {
      const googleMapper = config.socialProviders.google.mapProfileToUser;
      const res = googleMapper({ name: "John Doe", email: "john@test.com" });
      expect(res.firstName).toBe("John");
      expect(res.lastName).toBe("Doe");
    });
    
    it("github maps profile", () => {
      const githubMapper = config.socialProviders.github.mapProfileToUser;
      const res = githubMapper({ login: "johndoe", email: "john@test.com" });
      expect(res.firstName).toBe("johndoe");
      expect(res.lastName).toBe("Name");
    });
  });

  describe("Emails", () => {
    it("sendVerificationEmail", async () => {
      const mockRequest = { headers: new Map([["origin", "http://localhost:3000"]]) };
      await config.emailVerification.sendVerificationEmail({ user: { email: "a@a.com", firstName: "A" }, token: "t1" }, mockRequest);
      expect(mocks.mockMailTo).toHaveBeenCalled();
      expect(mocks.mockMailView).toHaveBeenCalledWith("verify-email", expect.any(Object));
    });

    it("sendResetPassword", async () => {
      const mockRequest = { headers: new Map([["origin", "http://localhost:3000"]]) };
      await config.emailAndPassword.sendResetPassword({ user: { email: "a@a.com" }, url: "http://localhost?token=t2" }, mockRequest);
      expect(mocks.mockMailTo).toHaveBeenCalled();
      expect(mocks.mockMailView).toHaveBeenCalledWith("forgot-password", expect.any(Object));
    });
    
    it("onPasswordReset", async () => {
      await config.emailAndPassword.onPasswordReset({ user: { email: "a@a.com" } });
      expect(mocks.mockMailTo).toHaveBeenCalled();
      expect(mocks.mockMailView).toHaveBeenCalledWith("reset-password-success", expect.any(Object));
    });
  });

  describe("Organization Plugin", () => {
    it("sendInvitationEmail", async () => {
      mocks.mockPrisma.organization.findUnique.mockResolvedValueOnce({ slug: "org1", name: "Org 1" });
      await orgConfig.sendInvitationEmail({ email: "test@test.com", organization: { id: "o1", name: "O1" }, role: "member", id: "inv1" });
      expect(mocks.mockMailTo).toHaveBeenCalledWith("test@test.com");
      expect(mocks.mockMailView).toHaveBeenCalledWith("invite", expect.any(Object));
    });
  });
});
