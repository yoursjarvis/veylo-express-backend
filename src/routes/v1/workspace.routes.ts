import { requirePermission } from "@/app/http/middlewares/rbac.middleware";
import { Router, Request } from "express";

import { auditLogController } from "@/app/http/controllers/audit-log.controller";
import { workspaceController } from "@/app/http/controllers/workspace.controller";
import { kpiController } from "@/app/http/controllers/kpi.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";

export const workspaceRoutes = Router();

const extractContext = (req: Request) => ({
  workspaceId: req.params.workspaceId || req.params.id,
  projectId: req.params.projectId || (req.baseUrl.includes('projects') ? req.params.id : undefined),
  taskId: req.params.taskId || (req.baseUrl.includes('tasks') ? req.params.id : undefined),
  organizationId: req.params.organizationId
});


workspaceRoutes.get("\/", requireAuth, requirePermission("workspace:read", extractContext), requirePermission("workspace:read", extractContext), workspaceController.getWorkspaces);

workspaceRoutes.post("\/", requireAuth, requirePermission("workspace:create", extractContext), requirePermission("workspace:create", extractContext), workspaceController.createWorkspace);

workspaceRoutes.patch("\/:id", requireAuth, requirePermission("workspace:update", extractContext), requirePermission("workspace:update", extractContext), workspaceController.updateWorkspace);

workspaceRoutes.delete("\/:id",
  requireAuth, requirePermission("workspace:delete", extractContext),
  workspaceController.deleteWorkspace,
);

workspaceRoutes.post("\/:id\/restore",
  requireAuth, requirePermission("workspace:restore", extractContext),
  workspaceController.restoreWorkspace,
);

workspaceRoutes.delete("\/:id\/force",
  requireAuth, requirePermission("workspace:force-delete", extractContext),
  workspaceController.forceDeleteWorkspace,
);

workspaceRoutes.get("\/:id\/members",
  requireAuth, requirePermission("workspace:read", extractContext),
  workspaceController.getWorkspaceMembers,
);

workspaceRoutes.post("\/:id\/members",
  requireAuth, requirePermission("workspace:invite-members", extractContext),
  workspaceController.addWorkspaceMembers,
);

workspaceRoutes.delete("\/:id\/members\/:userId",
  requireAuth, requirePermission("workspace:remove-members", extractContext),
  workspaceController.removeWorkspaceMember,
);

workspaceRoutes.get("\/:id\/audit-logs",
  requireAuth, requirePermission("audit-log:read", extractContext),
  auditLogController.getLogs,
);

workspaceRoutes.post("\/:id\/audit-logs\/export",
  requireAuth, requirePermission("audit-log:export", extractContext),
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
