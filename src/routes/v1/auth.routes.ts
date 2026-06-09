import { authController } from "@/app/http/controllers/auth.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { rateLimit } from "@/app/http/middlewares/rate-limit.middleware";
import { Router } from "express";

export const authRoutes = Router();

authRoutes.post(
  "/signup",
  rateLimit({
    keyPrefix: "auth:signup",
    windowMs: 60_000,
    max: 10,
    key: (req) => `${req.ip}:${String(req.body?.email ?? "")}`.toLowerCase(),
    message: "Too many signup attempts",
  }),
  authController.signup
);

authRoutes.post(
  "/login",
  rateLimit({
    keyPrefix: "auth:login",
    windowMs: 60_000,
    max: 10,
    key: (req) => `${req.ip}:${String(req.body?.email ?? "")}`.toLowerCase(),
    message: "Too many login attempts",
  }),
  authController.login
);

authRoutes.post("/logout", requireAuth, authController.logout);
authRoutes.post("/logout-all", requireAuth, authController.logoutAll);
authRoutes.post("/refresh", requireAuth, authController.refresh);
authRoutes.get("/me", requireAuth, authController.me);

authRoutes.post(
  "/forgot-password",
  rateLimit({
    keyPrefix: "auth:forgot",
    windowMs: 60_000,
    max: 5,
    key: (req) => `${req.ip}:${String(req.body?.email ?? "")}`.toLowerCase(),
    message: "Too many requests",
  }),
  authController.forgotPassword
);

authRoutes.post(
  "/reset-password",
  rateLimit({
    keyPrefix: "auth:reset",
    windowMs: 60_000,
    max: 10,
    key: (req) => `${req.ip}:${String(req.body?.token ?? "")}`,
    message: "Too many requests",
  }),
  authController.resetPassword
);
authRoutes.post("/change-password", requireAuth, authController.changePassword);

authRoutes.get("/sessions", requireAuth, authController.sessions);
authRoutes.delete("/sessions/:id", requireAuth, authController.revokeSession);

authRoutes.post("/update-user", requireAuth, authController.updateUser);

authRoutes.get("/verify-email", authController.verifyEmail);

authRoutes.post("/two-factor/send-otp", requireAuth, authController.sendTwoFactorOtp);
authRoutes.post("/two-factor/enable-social", requireAuth, authController.enableTwoFactorSocial);

