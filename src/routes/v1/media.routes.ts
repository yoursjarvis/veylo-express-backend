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

mediaRoutes.post(
  "/org/logo",
  requireAuth,
  upload.single("logo"),
  mediaController.uploadOrgLogo
);

mediaRoutes.post(
  "/workspace/:id/icon",
  requireAuth,
  upload.single("icon"),
  mediaController.uploadWorkspaceIcon
);

mediaRoutes.post(
  "/project/:id/icon",
  requireAuth,
  upload.single("icon"),
  mediaController.uploadProjectIcon
);

mediaRoutes.post(
  "/upload",
  requireAuth,
  upload.single("file"),
  mediaController.uploadFile
);

