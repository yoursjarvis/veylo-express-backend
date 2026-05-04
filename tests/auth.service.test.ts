import { beforeEach, describe, expect, it, vi } from "vitest";

const { authApiMock, authRepositoryMock, configMock, loggerMock, betterAuthHeadersMock } =
  vi.hoisted(() => ({
    authApiMock: {
      signUpEmail: vi.fn(),
      signInEmail: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      verifyEmail: vi.fn(),
      changePassword: vi.fn(),
      listSessions: vi.fn(),
      revokeSessions: vi.fn(),
      revokeSession: vi.fn(),
    },
    authRepositoryMock: {
      findUserByEmail: vi.fn(),
      markLoginSuccess: vi.fn(),
      markLoginFailure: vi.fn(),
      updateSessionMetadataByToken: vi.fn(),
      revokeSessionByIdForUser: vi.fn(),
    },
    configMock: vi.fn(),
    loggerMock: {
      error: vi.fn(),
      warn: vi.fn(),
    },
    betterAuthHeadersMock: vi.fn(),
  }));

vi.mock("../src/lib/auth/auth", () => ({ auth: { api: authApiMock } }));
vi.mock("../src/app/repositories/auth.repository", () => ({ authRepository: authRepositoryMock }));
vi.mock("../src/lib/logger", () => ({ logger: loggerMock }));
vi.mock("../src/utils/config", () => ({ config: configMock }));
vi.mock("../src/lib/auth/node-headers", () => ({ betterAuthHeaders: betterAuthHeadersMock }));
vi.mock("../src/app/services/mail", () => ({
  mailService: {
    to: vi.fn().mockReturnValue({
      view: vi.fn().mockReturnValue({
        queue: vi.fn(),
      }),
    }),
  },
}));
vi.mock("../src/lib/prisma", () => ({ default: { user: { update: vi.fn() }, session: { findFirst: vi.fn() } } }));

import { authService } from "../src/app/services/auth.service";

function createRes() {
  const res: any = {};
  res.setHeader = vi.fn();
  return res;
}

describe("authService.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    betterAuthHeadersMock.mockReturnValue(new Headers());
  });

  it("normalizes the email before authenticating and keeps login successful if post-login metadata fails", async () => {
    const headers = Object.assign(new Headers(), {
      getSetCookie: () => ["session=abc; Path=/; HttpOnly"],
    });
    betterAuthHeadersMock.mockReturnValue(headers);

    authRepositoryMock.findUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      isActive: true,
      deletedAt: null,
      lockedUntil: null,
    });
    authApiMock.signInEmail.mockResolvedValueOnce({
      headers,
      response: { token: "session-token", user: { id: "user-1" } },
    });
    authRepositoryMock.updateSessionMetadataByToken.mockRejectedValueOnce(
      new Error("metadata write failed")
    );
    authRepositoryMock.markLoginSuccess.mockResolvedValueOnce(undefined);

    const req: any = {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0" },
      ip: "127.0.0.1",
    };
    const res = createRes();

    const result = await authService.login(req, res, {
      email: "Jane.Doe@Example.com",
      password: "correct-horse-battery-staple",
    });

    expect(authRepositoryMock.findUserByEmail).toHaveBeenCalledWith("jane.doe@example.com");
    expect(authApiMock.signInEmail).toHaveBeenCalledWith({
      headers,
      returnHeaders: true,
      body: {
        email: "jane.doe@example.com",
        password: "correct-horse-battery-staple",
      },
    });
    expect(authRepositoryMock.updateSessionMetadataByToken).toHaveBeenCalledWith(
      "session-token",
      expect.objectContaining({
        browser: "Chrome",
        os: "Windows",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0",
      })
    );
    expect(authRepositoryMock.markLoginSuccess).toHaveBeenCalledWith(
      "user-1",
      expect.any(Date)
    );
    expect(res.setHeader).toHaveBeenCalledWith("set-cookie", [
      "session=abc; Path=/; HttpOnly",
    ]);
    expect(result).toEqual({ token: "session-token", user: { id: "user-1" } });
  });

  it("marks login failure with a normalized email when sign-in is rejected", async () => {
    authRepositoryMock.findUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      isActive: true,
      deletedAt: null,
      lockedUntil: null,
    });
    authApiMock.signInEmail.mockRejectedValueOnce({
      name: "APIError",
      message: "Invalid email or password",
    });
    authRepositoryMock.markLoginFailure.mockResolvedValueOnce(undefined);

    const req: any = { headers: {}, ip: "127.0.0.1" };
    const res = createRes();

    await expect(
      authService.login(req, res, {
        email: "Jane.Doe@Example.com",
        password: "wrong-password",
      })
    ).rejects.toMatchObject({ message: "Invalid credentials" });

    expect(authRepositoryMock.markLoginFailure).toHaveBeenCalledWith(
      "jane.doe@example.com",
      expect.any(Date)
    );
  });

  it("returns a verification error when Better Auth rejects an unverified email", async () => {
    authRepositoryMock.findUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      isActive: true,
      deletedAt: null,
      lockedUntil: null,
    });
    authApiMock.signInEmail.mockRejectedValueOnce({
      name: "APIError",
      code: "EMAIL_NOT_VERIFIED",
      message: "Email not verified",
    });

    const req: any = { headers: {}, ip: "127.0.0.1" };
    const res = createRes();

    await expect(
      authService.login(req, res, {
        email: "Jane.Doe@Example.com",
        password: "correct-password",
      })
    ).rejects.toMatchObject({
      message: "Email not verified",
      statusCode: 403,
    });

    expect(authRepositoryMock.markLoginFailure).not.toHaveBeenCalled();
  });
});
