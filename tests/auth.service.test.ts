import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authApiMock,
  authRepositoryMock,
  configMock,
  loggerMock,
  betterAuthHeadersMock,
  prismaMockLocal,
} = vi.hoisted(() => ({
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
    updateUser: vi.fn(),
    enableTwoFactor: vi.fn(),
  },
  authRepositoryMock: {
    findUserByEmail: vi.fn(),
    markLoginSuccess: vi.fn(),
    markLoginFailure: vi.fn(),
    updateSessionMetadataByToken: vi.fn(),
    revokeSessionByIdForUser: vi.fn(),
  },
  configMock: vi.fn().mockImplementation((key: string) => {
    if (key === "mail.queue.name") return "mail-queue";
    if (key === "database.redis.host") return "localhost";
    if (key === "database.redis.port") return 6379;
    return undefined;
  }),
  loggerMock: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  betterAuthHeadersMock: vi.fn(),
  prismaMockLocal: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    verification: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/auth/auth", () => ({ auth: { api: authApiMock } }));
vi.mock("../src/app/repositories/auth.repository", () => ({
  authRepository: authRepositoryMock,
}));
vi.mock("../src/lib/logger", () => ({ logger: loggerMock }));
vi.mock("../src/utils/config", () => ({ config: configMock }));
vi.mock("../src/lib/auth/node-headers", () => ({
  betterAuthHeaders: betterAuthHeadersMock,
}));
vi.mock("../src/app/services/mail", () => ({
  mailService: {
    to: vi.fn().mockReturnValue({
      view: vi.fn().mockReturnValue({
        queue: vi.fn(),
      }),
    }),
  },
}));
vi.mock("../src/lib/prisma", () => ({
  default: prismaMockLocal,
}));

import { authService } from "../src/app/services/auth.service";

function createRes() {
  const res: unknown = {};
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
      new Error("metadata write failed"),
    );
    authRepositoryMock.markLoginSuccess.mockResolvedValueOnce(undefined);

    const req: unknown = {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0",
      },
      ip: "127.0.0.1",
    };
    const res = createRes();

    const result = await authService.login(req, res, {
      email: "Jane.Doe@Example.com",
      password: "correct-horse-battery-staple",
    });

    expect(authRepositoryMock.findUserByEmail).toHaveBeenCalledWith(
      "jane.doe@example.com",
    );
    expect(authApiMock.signInEmail).toHaveBeenCalledWith({
      headers,
      returnHeaders: true,
      body: {
        email: "jane.doe@example.com",
        password: "correct-horse-battery-staple",
      },
    });
    expect(
      authRepositoryMock.updateSessionMetadataByToken,
    ).toHaveBeenCalledWith(
      "session-token",
      expect.objectContaining({
        browser: "Chrome",
        os: "Windows",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0",
      }),
    );
    expect(authRepositoryMock.markLoginSuccess).toHaveBeenCalledWith(
      "user-1",
      expect.any(Date),
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

    const req: unknown = { headers: {}, ip: "127.0.0.1" };
    const res = createRes();

    await expect(
      authService.login(req, res, {
        email: "Jane.Doe@Example.com",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({ message: "Invalid credentials" });

    expect(authRepositoryMock.markLoginFailure).toHaveBeenCalledWith(
      "jane.doe@example.com",
      expect.any(Date),
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

    const req: unknown = { headers: {}, ip: "127.0.0.1" };
    const res = createRes();

    await expect(
      authService.login(req, res, {
        email: "Jane.Doe@Example.com",
        password: "correct-password",
      }),
    ).rejects.toMatchObject({
      message: "Email not verified",
      statusCode: 403,
    });

    expect(authRepositoryMock.markLoginFailure).not.toHaveBeenCalled();
  });
});

describe("authService.otherMethods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    betterAuthHeadersMock.mockReturnValue(new Headers());
  });

  it("signUp: signs up a new user, auto-logs in if email is verified", async () => {
    const headers = new Headers();
    authApiMock.signUpEmail.mockResolvedValueOnce({
      headers,
      response: {
        user: {
          id: "user-1",
          email: "test@example.com",
          name: "Jane Doe",
          emailVerified: true,
        },
      },
    });
    authApiMock.signInEmail.mockResolvedValueOnce({
      headers,
      response: { token: "session-token", user: { id: "user-1" } },
    });

    const req: unknown = { headers: {}, ip: "127.0.0.1" };
    const res = createRes();

    const result = await authService.signUp(req, res, {
      firstName: "Jane",
      lastName: "Doe",
      email: "test@example.com",
      password: "password123",
    });

    expect(authApiMock.signUpEmail).toHaveBeenCalled();
    expect(authApiMock.signInEmail).toHaveBeenCalled();
    expect(result).toEqual({ token: "session-token", user: { id: "user-1" } });
  });

  it("logout and logoutAll: signs out the user", async () => {
    authApiMock.signOut.mockResolvedValueOnce({
      headers: new Headers(),
      response: { success: true },
    });
    const req: unknown = { headers: {} };
    const res = createRes();

    const resultLogout = await authService.logout(req, res);
    expect(authApiMock.signOut).toHaveBeenCalled();
    expect(resultLogout).toEqual({ success: true });

    authApiMock.revokeSessions.mockResolvedValueOnce(undefined);
    authApiMock.signOut.mockResolvedValueOnce({
      headers: new Headers(),
      response: { success: true },
    });
    const resultLogoutAll = await authService.logoutAll(req, res);
    expect(authApiMock.revokeSessions).toHaveBeenCalled();
    expect(resultLogoutAll).toEqual({ success: true });
  });

  it("me: gets the current session and checks for credential password", async () => {
    authApiMock.getSession.mockResolvedValueOnce({
      headers: new Headers(),
      response: { user: { id: "user-1" } },
    });
    prismaMockLocal.account.findFirst.mockResolvedValueOnce({ id: "acc-1" });

    const req: unknown = { headers: {} };
    const res = createRes();

    const result = await authService.me(req, res);
    expect(authApiMock.getSession).toHaveBeenCalled();
    expect(result.user.hasPassword).toBe(true);
  });

  it("requestPasswordReset & resetPassword", async () => {
    authApiMock.requestPasswordReset.mockResolvedValueOnce(undefined);
    const req: unknown = { headers: {} };

    await authService.requestPasswordReset(req, {
      email: "test@example.com",
      redirectTo: "url",
    });
    expect(authApiMock.requestPasswordReset).toHaveBeenCalled();

    authApiMock.resetPassword.mockResolvedValueOnce({
      headers: new Headers(),
      response: { success: true },
    });
    const res = createRes();
    const result = await authService.resetPassword(req, res, {
      token: "token",
      newPassword: "new",
    });
    expect(authApiMock.resetPassword).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("verifyEmail: verifies the token and sends a welcome mail if user is found", async () => {
    prismaMockLocal.verification.findFirst.mockResolvedValueOnce({
      identifier: "test@example.com",
      value: "token",
    });
    authApiMock.verifyEmail.mockResolvedValueOnce({
      headers: new Headers(),
      response: { status: true },
    });
    prismaMockLocal.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "test@example.com",
      firstName: "Jane",
    });

    const req: unknown = { headers: {} };
    const res = createRes();

    const result = await authService.verifyEmail(req, res, "token");
    expect(authApiMock.verifyEmail).toHaveBeenCalled();
    expect(result).toEqual({ status: true });
  });

  it("changePassword: changes the user password and records passwordChangedAt date", async () => {
    authApiMock.getSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    authApiMock.changePassword.mockResolvedValueOnce({
      headers: new Headers(),
      response: { success: true },
    });
    prismaMockLocal.user.update.mockResolvedValueOnce({ id: "user-1" });

    const req: unknown = { headers: {} };
    const res = createRes();

    const result = await authService.changePassword(req, res, {
      currentPassword: "old",
      newPassword: "new",
    });
    expect(authApiMock.changePassword).toHaveBeenCalled();
    expect(prismaMockLocal.user.update).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("listSessions & revokeSession", async () => {
    authApiMock.listSessions.mockResolvedValueOnce([{ id: "sess-1" }]);
    const req: unknown = { headers: {} };
    expect(await authService.listSessions(req)).toEqual([{ id: "sess-1" }]);

    authApiMock.getSession.mockResolvedValueOnce({
      response: { user: { id: "user-1" } },
    });
    authRepositoryMock.revokeSessionByIdForUser.mockResolvedValueOnce(
      undefined,
    );
    prismaMockLocal.session.findFirst.mockResolvedValueOnce({
      token: "token-123",
    });
    authApiMock.revokeSession.mockResolvedValueOnce(undefined);

    await authService.revokeSession(req, "sess-1");
    expect(authRepositoryMock.revokeSessionByIdForUser).toHaveBeenCalledWith(
      "sess-1",
      "user-1",
    );
    expect(authApiMock.revokeSession).toHaveBeenCalled();
  });

  it("updateUser", async () => {
    authApiMock.updateUser.mockResolvedValueOnce({
      headers: new Headers(),
      response: { success: true },
    });
    const req: unknown = { headers: {} };
    const res = createRes();

    const result = await authService.updateUser(req, res, {
      firstName: "Jane",
    });
    expect(authApiMock.updateUser).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("sendTwoFactorOtp & enableTwoFactorSocial", async () => {
    authApiMock.getSession.mockResolvedValueOnce({
      user: { id: "user-1", email: "test@example.com" },
    });
    prismaMockLocal.verification.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMockLocal.verification.create.mockResolvedValueOnce({ id: "ver-1" });

    const req: unknown = { headers: {} };
    await authService.sendTwoFactorOtp(req);
    expect(prismaMockLocal.verification.create).toHaveBeenCalled();

    authApiMock.getSession.mockResolvedValueOnce({
      user: { id: "user-1", email: "test@example.com" },
    });
    prismaMockLocal.verification.findFirst.mockResolvedValueOnce({
      id: "ver-1",
      expiresAt: new Date(Date.now() + 100000),
    });
    prismaMockLocal.verification.delete.mockResolvedValueOnce({ id: "ver-1" });
    authApiMock.enableTwoFactor.mockResolvedValueOnce({
      data: { success: true },
    });

    const res = createRes();
    const enableResult = await authService.enableTwoFactorSocial(req, res, {
      otp: "123456",
    });
    expect(enableResult.data).toEqual({ success: true });
  });
});

describe("authService.edgeCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    betterAuthHeadersMock.mockReturnValue(new Headers());
  });

  it("signUp: handles auto-login failure gracefully when email is verified", async () => {
    const headers = new Headers();
    authApiMock.signUpEmail.mockResolvedValueOnce({
      headers,
      response: { user: { id: "user-1", emailVerified: true } },
    });
    // auto-login fails
    authApiMock.signInEmail.mockRejectedValueOnce(
      new Error("auto-login error"),
    );

    const req: unknown = { headers: {}, ip: "127.0.0.1" };
    const res = createRes();

    // Should not throw, should fall through to return the signup result
    const result = await authService.signUp(req, res, {
      firstName: "Jane",
      lastName: "Doe",
      email: "test@example.com",
      password: "password123",
    });

    expect(loggerMock.error).toHaveBeenCalled();
    // returns the signUp response (not the login response)
    expect(result).toEqual({ user: { id: "user-1", emailVerified: true } });
  });

  it("signUp: does not auto-login if email is NOT verified", async () => {
    const headers = new Headers();
    authApiMock.signUpEmail.mockResolvedValueOnce({
      headers,
      response: { user: { id: "user-1", emailVerified: false } },
    });

    const req: unknown = { headers: {}, ip: "127.0.0.1" };
    const res = createRes();

    const result = await authService.signUp(req, res, {
      firstName: "Jane",
      lastName: "Doe",
      email: "test@example.com",
      password: "password123",
    });

    expect(authApiMock.signInEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ user: { id: "user-1", emailVerified: false } });
  });

  it("login: throws UnauthorizedException for inactive or deleted user", async () => {
    const req: unknown = { headers: {}, ip: "127.0.0.1" };
    const res = createRes();

    // Inactive user
    authRepositoryMock.findUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      isActive: false,
      deletedAt: null,
      lockedUntil: null,
    });
    await expect(
      authService.login(req, res, {
        email: "jane@example.com",
        password: "pass",
      }),
    ).rejects.toThrow("Invalid credentials");

    // Deleted user
    authRepositoryMock.findUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      isActive: true,
      deletedAt: new Date(),
      lockedUntil: null,
    });
    await expect(
      authService.login(req, res, {
        email: "jane@example.com",
        password: "pass",
      }),
    ).rejects.toThrow("Invalid credentials");

    // Locked user
    authRepositoryMock.findUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      isActive: true,
      deletedAt: null,
      lockedUntil: new Date(Date.now() + 60000),
    });
    await expect(
      authService.login(req, res, {
        email: "jane@example.com",
        password: "pass",
      }),
    ).rejects.toThrow("Invalid credentials");
  });

  it("login: handles unexpected sign-in failures", async () => {
    authRepositoryMock.findUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      isActive: true,
      deletedAt: null,
      lockedUntil: null,
    });
    // Unexpected error (not an APIError)
    authApiMock.signInEmail.mockRejectedValueOnce(
      new Error("Unexpected DB failure"),
    );

    const req: unknown = { headers: {}, ip: "127.0.0.1" };
    const res = createRes();

    await expect(
      authService.login(req, res, {
        email: "jane@example.com",
        password: "pass",
      }),
    ).rejects.toThrow("Invalid credentials");
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("sendTwoFactorOtp: throws UnauthorizedException when no session", async () => {
    authApiMock.getSession.mockResolvedValueOnce(null);
    const req: unknown = { headers: {} };
    await expect(authService.sendTwoFactorOtp(req)).rejects.toThrow();
  });

  it("enableTwoFactorSocial: throws when no session", async () => {
    authApiMock.getSession.mockResolvedValueOnce(null);
    const req: unknown = { headers: {} };
    const res = createRes();
    await expect(
      authService.enableTwoFactorSocial(req, res, { otp: "123456" }),
    ).rejects.toThrow();
  });

  it("enableTwoFactorSocial: throws UnauthorizedException for invalid OTP", async () => {
    authApiMock.getSession.mockResolvedValueOnce({
      user: { id: "user-1", email: "test@example.com" },
    });
    prismaMockLocal.verification.findFirst.mockResolvedValueOnce(null); // no matching OTP

    const req: unknown = { headers: {} };
    const res = createRes();

    await expect(
      authService.enableTwoFactorSocial(req, res, { otp: "badotp" }),
    ).rejects.toThrow("Invalid or expired OTP");
  });

  it("revokeSession: throws UnauthorizedException if no userId in session", async () => {
    authApiMock.getSession.mockResolvedValueOnce({ response: { user: null } });
    const req: unknown = { headers: {} };
    await expect(authService.revokeSession(req, "sess-1")).rejects.toThrow();
  });

  it("me: returns response without hasPassword when no user in session", async () => {
    authApiMock.getSession.mockResolvedValueOnce({
      headers: new Headers(),
      response: { session: { id: "sess-1" } }, // no user
    });

    const req: unknown = { headers: {} };
    const res = createRes();

    const result = await authService.me(req, res);
    expect(result).toEqual({ session: { id: "sess-1" } });
    expect(prismaMockLocal.account.findFirst).not.toHaveBeenCalled();
  });
});
