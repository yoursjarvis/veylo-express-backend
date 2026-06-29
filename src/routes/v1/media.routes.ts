import { Router } from "express";

import { mediaController } from "@/app/http/controllers/media.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { upload } from "@/app/http/middlewares/upload.middleware";

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

// Versioning & Annotations
mediaRoutes.post(
  "/media/:parentMediaId/version",
  requireAuth,
  upload.single("file"),
  mediaController.uploadVersion
);

mediaRoutes.post(
  "/media/:mediaId/annotations",
  requireAuth,
  mediaController.createAnnotation
);

mediaRoutes.get(
  "/media/:mediaId/annotations",
  requireAuth,
  mediaController.getAnnotations
);

mediaRoutes.delete(
  "/annotations/:id",
  requireAuth,
  mediaController.deleteAnnotation
);


