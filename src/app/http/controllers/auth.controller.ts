import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { authService } from "@/app/services/auth.service";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyEmailQuerySchema,
} from "@/app/http/validators/auth.validation";
import { config } from "@/utils/config";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";

export const authController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const parsed = signUpSchema.parse(req.body);

    await authService.signUp(req, res, {
      firstName: parsed.first_name,
      lastName: parsed.last_name,
      email: parsed.email,
      password: parsed.password,
    });

    return ok(
      res,
      "If the email is valid, you will receive verification instructions shortly."
    );
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const parsed = loginSchema.parse(req.body);

    await authService.login(req, res, {
      email: parsed.email,
      password: parsed.password,
    });

    return ok(res, "Login successful");
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req, res);
    return ok(res, "Logout successful");
  }),

  logoutAll: asyncHandler(async (req: Request, res: Response) => {
    await authService.logoutAll(req, res);
    return ok(res, "Logout successful");
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.me(req, res);

    return ok(res, "OK", {
      user: data?.user ?? null,
      session: data?.session ?? null,
    });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    // Best practice: refresh is effectively a no-op unless session updateAge is due.
    const data = await authService.me(req, res);
    return ok(res, "OK", {
      user: data?.user ?? null,
      session: data?.session ?? null,
    });
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const parsed = forgotPasswordSchema.parse(req.body);

    const redirectTo =
      parsed.redirect_to ??
      `${config("app.origins")[0] ?? new URL(config("app.url")).origin}/reset-password`;

    await authService.requestPasswordReset(req, {
      email: parsed.email,
      redirectTo,
    });

    return ok(
      res,
      "If the email is valid, you will receive password reset instructions shortly."
    );
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const parsed = resetPasswordSchema.parse(req.body);

    await authService.resetPassword(req, res, {
      token: parsed.token,
      newPassword: parsed.new_password,
    });

    return ok(res, "Password reset successful");
  }),

  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    const parsed = verifyEmailQuerySchema.parse(req.query);
    await authService.verifyEmail(req, res, parsed.token);
    return ok(res, "Email verified");
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const parsed = changePasswordSchema.parse(req.body);

    await authService.changePassword(req, res, {
      currentPassword: parsed.current_password,
      newPassword: parsed.new_password,
    });

    return ok(res, "Password changed successfully");
  }),

  sessions: asyncHandler(async (req: Request, res: Response) => {
    const sessions = await authService.listSessions(req);
    return ok(res, "OK", {
      sessions,
      current_session_id: req.auth?.session?.id,
    });
  }),

  revokeSession: asyncHandler(async (req: Request, res: Response) => {
    const sessionId = Number(req.params.id);
    await authService.revokeSession(req, sessionId);
    return ok(res, "Session revoked");
  }),
};

