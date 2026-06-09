import { mediaController } from "@/app/http/controllers/media.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { upload } from "@/app/http/middlewares/upload.middleware";
import { Router } from "express";

export const mediaRoutes = Router();

mediaRoutes.post(
  "/avatar",
  requireAuth,
  upload.single("avatar"),
  mediaController.uploadAvatar
);
