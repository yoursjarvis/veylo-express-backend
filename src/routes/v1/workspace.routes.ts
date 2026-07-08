import { Router } from "express";

import { workspaceController } from "@/app/http/controllers/workspace.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";

export const workspaceRoutes = Router();

workspaceRoutes.get("/", requireAuth, workspaceController.getWorkspaces);

workspaceRoutes.post("/", requireAuth, workspaceController.createWorkspace);

workspaceRoutes.patch("/:id", requireAuth, workspaceController.updateWorkspace);

workspaceRoutes.delete(
  "/:id",
  requireAuth,
  workspaceController.deleteWorkspace,
);

workspaceRoutes.post(
  "/:id/restore",
  requireAuth,
  workspaceController.restoreWorkspace,
);

workspaceRoutes.delete(
  "/:id/force",
  requireAuth,
  workspaceController.forceDeleteWorkspace,
);

workspaceRoutes.get(
  "/:id/members",
  requireAuth,
  workspaceController.getWorkspaceMembers,
);

workspaceRoutes.post(
  "/:id/members",
  requireAuth,
  workspaceController.addWorkspaceMembers,
);

workspaceRoutes.delete(
  "/:id/members/:userId",
  requireAuth,
  workspaceController.removeWorkspaceMember,
);
