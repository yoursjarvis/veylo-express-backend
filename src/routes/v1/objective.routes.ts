import { requirePermission } from "@/app/http/middlewares/rbac.middleware";
import { Router, Request } from "express";

import { objectiveController } from "@/app/http/controllers/objective.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";

export const objectiveRoutes = Router();

const extractContext = (req: Request) => ({
  workspaceId: req.params.workspaceId || req.params.id,
  projectId:
    req.params.projectId ||
    (req.baseUrl.includes("projects") ? req.params.id : undefined),
  taskId:
    req.params.taskId ||
    (req.baseUrl.includes("tasks") ? req.params.id : undefined),
  organizationId: req.params.organizationId,
});

objectiveRoutes.get(
  "\/workspaces\/:workspaceId\/objectives",
  requireAuth,
  requirePermission("goal-okrs:read", extractContext),
  objectiveController.getObjectives,
);
objectiveRoutes.post(
  "\/objectives",
  requireAuth,
  requirePermission("goal-okrs:create", extractContext),
  objectiveController.createObjective,
);
objectiveRoutes.delete(
  "\/objectives\/:id",
  requireAuth,
  requirePermission("goal-okrs:delete", extractContext),
  objectiveController.deleteObjective,
);
objectiveRoutes.post(
  "\/objectives\/:id\/restore",
  requireAuth,
  requirePermission("goal-okrs:restore", extractContext),
  objectiveController.restoreObjective,
);
objectiveRoutes.delete(
  "\/objectives\/:id\/force",
  requireAuth,
  requirePermission("goal-okrs:force-delete", extractContext),
  objectiveController.forceDeleteObjective,
);
objectiveRoutes.put(
  "\/objectives\/:id",
  requireAuth,
  requirePermission("goal-okrs:update", extractContext),
  objectiveController.updateObjective,
);
