import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import app from "@/app";

vi.mock("../../src/lib/auth/auth", async () => {
  const { getSessionMock } = await import("../helpers/auth");
  return {
    auth: {
      api: {
        getSession: getSessionMock,
      },
    },
  };
});

vi.mock("../../src/lib/prisma", async () => {
  const { prismaMock } = await import("../helpers/db");
  return {
    default: prismaMock,
    basePrisma: prismaMock,
  };
});

vi.mock("../../src/app/http/middlewares/rate-limit.middleware", () => ({
  rateLimit: () => (req: any, res: any, next: any) => next(),
}));

const { mockAuthService } = vi.hoisted(() => ({
  mockAuthService: {
    signUp: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    me: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    verifyEmail: vi.fn(),
    changePassword: vi.fn(),
    listSessions: vi.fn(),
    revokeSession: vi.fn(),
    updateUser: vi.fn(),
    sendTwoFactorOtp: vi.fn(),
    enableTwoFactorSocial: vi.fn(),
  },
}));

vi.mock("../../src/app/services/auth.service", () => ({
  authService: mockAuthService,
}));

vi.mock("../../src/utils/config", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/utils/config")>();
  return {
    ...original,
    config: vi.fn((key: string) => {
      if (key === "app.origins") return ["http://localhost"];
      if (key === "app.vaultEncryptionKey") return "dummy-vault-key-min-32-chars-long-here";
      return original.config(key as any);
    }),
  };
});

import { setMockUser } from "../helpers/auth";
import { createUser } from "../helpers/factories";

describe("Auth API Endpoint Integration Tests (/api/v1/auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }));
  });

  describe("POST /api/v1/auth/signup", () => {
    it("signs up a user successfully", async () => {
      mockAuthService.signUp.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          first_name: "Jane",
          last_name: "Doe",
          email: "jane@example.com",
          password: "secure-password",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockAuthService.signUp).toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("logs in user successfully", async () => {
      mockAuthService.login.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "jane@example.com", password: "password" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockAuthService.login).toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("returns user session info when logged in", async () => {
      mockAuthService.me.mockResolvedValueOnce({
        user: { id: "user-123" },
        session: { id: "session-123" },
      });

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe("user-123");
    });
  });
});
