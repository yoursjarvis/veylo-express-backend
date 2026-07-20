import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { authServiceMock, configMock } = vi.hoisted(() => ({
  authServiceMock: {
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
  },
  configMock: vi.fn(),
}));

vi.mock("../src/app/services/auth.service", () => ({
  authService: authServiceMock,
}));
vi.mock("../src/utils/config", () => ({ config: configMock }));

import { authController } from "../src/app/http/controllers/auth.controller";

function createRes() {
  const res: unknown = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("authController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMock.mockReset();
  });

  it("signup: validates input, calls service, and returns ok", async () => {
    authServiceMock.signUp.mockResolvedValueOnce(undefined);

    const req: unknown = {
      body: {
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
        password: "secure-password",
      },
    };
    const res = createRes();

    await (authController.signup as unknown)(req, res);

    expect(authServiceMock.signUp).toHaveBeenCalledWith(req, res, {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      password: "secure-password",
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message:
        "If the email is valid, you will receive verification instructions shortly.",
      data: {},
    });
  });

  it("login: validates input, calls service, and returns ok", async () => {
    authServiceMock.login.mockResolvedValueOnce(undefined);

    const req: unknown = {
      body: { email: "jane@example.com", password: "password" },
    };
    const res = createRes();

    await (authController.login as unknown)(req, res);

    expect(authServiceMock.login).toHaveBeenCalledWith(req, res, {
      email: "jane@example.com",
      password: "password",
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Login successful",
      data: {},
    });
  });

  it("logout: calls service and returns ok", async () => {
    authServiceMock.logout.mockResolvedValueOnce(undefined);
    const req: unknown = {};
    const res = createRes();

    await (authController.logout as unknown)(req, res);

    expect(authServiceMock.logout).toHaveBeenCalledWith(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Logout successful",
      data: {},
    });
  });

  it("logoutAll: calls service and returns ok", async () => {
    authServiceMock.logoutAll.mockResolvedValueOnce(undefined);
    const req: unknown = {};
    const res = createRes();

    await (authController.logoutAll as unknown)(req, res);

    expect(authServiceMock.logoutAll).toHaveBeenCalledWith(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Logout successful",
      data: {},
    });
  });

  it("me: returns user and session when present", async () => {
    authServiceMock.me.mockResolvedValueOnce({
      user: { id: 1 },
      session: { id: "s1" },
    });

    const req: unknown = {};
    const res = createRes();

    await (authController.me as unknown)(req, res);

    expect(authServiceMock.me).toHaveBeenCalledWith(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "OK",
      data: { user: { id: 1 }, session: { id: "s1" } },
    });
  });

  it("me: returns nulls when service returns nothing", async () => {
    authServiceMock.me.mockResolvedValueOnce(undefined);
    const req: unknown = {};
    const res = createRes();

    await (authController.me as unknown)(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "OK",
      data: { user: null, session: null },
    });
  });

  it("refresh: returns user and session when present", async () => {
    authServiceMock.me.mockResolvedValueOnce({
      user: { id: 2 },
      session: { id: "s2" },
    });

    const req: unknown = {};
    const res = createRes();

    await (authController.refresh as unknown)(req, res);

    expect(authServiceMock.me).toHaveBeenCalledWith(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "OK",
      data: { user: { id: 2 }, session: { id: "s2" } },
    });
  });

  it("refresh: returns nulls when service returns nothing", async () => {
    authServiceMock.me.mockResolvedValueOnce(undefined);
    const req: unknown = {};
    const res = createRes();

    await (authController.refresh as unknown)(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "OK",
      data: { user: null, session: null },
    });
  });

  it("forgotPassword: uses provided redirect_to without reading config", async () => {
    authServiceMock.requestPasswordReset.mockResolvedValueOnce(undefined);

    const req: unknown = {
      body: { email: "jane@example.com", redirect_to: "https://acme.com/r" },
    };
    const res = createRes();

    await (authController.forgotPassword as unknown)(req, res);

    expect(configMock).not.toHaveBeenCalled();
    expect(authServiceMock.requestPasswordReset).toHaveBeenCalledWith(req, {
      email: "jane@example.com",
      redirectTo: "https://acme.com/r",
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message:
        "If the email is valid, you will receive password reset instructions shortly.",
      data: {},
    });
  });

  it("forgotPassword: builds redirectTo from app.origins[0] when redirect_to is absent", async () => {
    authServiceMock.requestPasswordReset.mockResolvedValueOnce(undefined);
    configMock.mockImplementation((key: string) => {
      if (key === "app.origins") return ["https://origin.example"];
      if (key === "app.url") return "https://fallback.example/app";
      throw new Error(`unexpected config key: ${key}`);
    });

    const req: unknown = { body: { email: "jane@example.com" } };
    const res = createRes();

    await (authController.forgotPassword as unknown)(req, res);

    expect(authServiceMock.requestPasswordReset).toHaveBeenCalledWith(req, {
      email: "jane@example.com",
      redirectTo: "https://origin.example/reset-password",
    });
  });

  it("forgotPassword: builds redirectTo from app.url origin when app.origins[0] is missing", async () => {
    authServiceMock.requestPasswordReset.mockResolvedValueOnce(undefined);
    configMock.mockImplementation((key: string) => {
      if (key === "app.origins") return [];
      if (key === "app.url") return "https://fallback.example/some/path";
      throw new Error(`unexpected config key: ${key}`);
    });

    const req: unknown = { body: { email: "jane@example.com" } };
    const res = createRes();

    await (authController.forgotPassword as unknown)(req, res);

    expect(authServiceMock.requestPasswordReset).toHaveBeenCalledWith(req, {
      email: "jane@example.com",
      redirectTo: "https://fallback.example/reset-password",
    });
  });

  it("resetPassword: validates input, calls service, and returns ok", async () => {
    authServiceMock.resetPassword.mockResolvedValueOnce(undefined);
    const req: unknown = {
      body: {
        token: "0123456789TOKEN",
        new_password: "secure-password",
      },
    };
    const res = createRes();

    await (authController.resetPassword as unknown)(req, res);

    expect(authServiceMock.resetPassword).toHaveBeenCalledWith(req, res, {
      token: "0123456789TOKEN",
      newPassword: "secure-password",
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Password reset successful",
      data: {},
    });
  });

  it("verifyEmail: validates query, calls service, and returns ok", async () => {
    authServiceMock.verifyEmail.mockResolvedValueOnce(undefined);
    const req: unknown = { query: { token: "0123456789" } };
    const res = createRes();

    await (authController.verifyEmail as unknown)(req, res);

    expect(authServiceMock.verifyEmail).toHaveBeenCalledWith(
      req,
      res,
      "0123456789",
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Email verified",
      data: {},
    });
  });

  it("changePassword: validates input, calls service, and returns ok", async () => {
    authServiceMock.changePassword.mockResolvedValueOnce(undefined);
    const req: unknown = {
      body: { current_password: "current", new_password: "secure-password" },
    };
    const res = createRes();

    await (authController.changePassword as unknown)(req, res);

    expect(authServiceMock.changePassword).toHaveBeenCalledWith(req, res, {
      currentPassword: "current",
      newPassword: "secure-password",
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Password changed successfully",
      data: {},
    });
  });

  it("sessions: returns sessions and current session id when present", async () => {
    authServiceMock.listSessions.mockResolvedValueOnce([{ id: 1 }]);
    const req: unknown = { auth: { session: { id: "abc" } } };
    const res = createRes();

    await (authController.sessions as unknown)(req, res);

    expect(authServiceMock.listSessions).toHaveBeenCalledWith(req);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "OK",
      data: { sessions: [{ id: 1 }], current_session_id: "abc" },
    });
  });

  it("sessions: returns undefined current session id when missing", async () => {
    authServiceMock.listSessions.mockResolvedValueOnce([]);
    const req: unknown = {};
    const res = createRes();

    await (authController.sessions as unknown)(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "OK",
      data: { sessions: [], current_session_id: undefined },
    });
  });

  it("revokeSession: converts param id to number, calls service, and returns ok", async () => {
    authServiceMock.revokeSession.mockResolvedValueOnce(undefined);
    const req: unknown = { params: { id: "42" } };
    const res = createRes();

    await (authController.revokeSession as unknown)(req, res);

    expect(authServiceMock.revokeSession).toHaveBeenCalledWith(req, "42");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Session revoked",
      data: {},
    });
  });
});
