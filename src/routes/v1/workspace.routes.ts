import { Router } from "express";

import { auditLogController } from "@/app/http/controllers/audit-log.controller";
import { workspaceController } from "@/app/http/controllers/workspace.controller";
import { kpiController } from "@/app/http/controllers/kpi.controller";
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

workspaceRoutes.get(
  "/:id/audit-logs",
  requireAuth,
  auditLogController.getLogs,
);

workspaceRoutes.post(
  "/:id/audit-logs/export",
  requireAuth,
  auditLogController.exportLogs,
);

workspaceRoutes.get(
  "/:id/kpi/leaderboard",
  requireAuth,
  kpiController.getLeaderboard,
);

workspaceRoutes.get(
  "/:id/kpi/transactions",
  requireAuth,
  kpiController.getTransactions,
);

workspaceRoutes.get(
  "/:id/kpi/stats",
  requireAuth,
  kpiController.getUserStats,
);

workspaceRoutes.get(
  "/:id/kpi/accessible-projects",
  requireAuth,
  kpiController.getAccessibleProjects,
);

workspaceRoutes.get(
  "/:id/kpi/all-projects",
  requireAuth,
  kpiController.getAllProjects,
);
