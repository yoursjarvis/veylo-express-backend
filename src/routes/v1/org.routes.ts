import { orgController } from "@/app/http/controllers/org.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { upload } from "@/app/http/middlewares/upload.middleware";
import { Router } from "express";

export const orgRoutes = Router();

orgRoutes.post(
  "/setup",
  requireAuth,
  upload.single("logo"),
  orgController.setupOrganization
);
