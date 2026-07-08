import { Router } from "express";

import { objectiveController } from "@/app/http/controllers/objective.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";

export const objectiveRoutes = Router();

objectiveRoutes.get(
  "/workspaces/:workspaceId/objectives",
  requireAuth,
  objectiveController.getObjectives,
);
objectiveRoutes.post(
  "/objectives",
  requireAuth,
  objectiveController.createObjective,
);
objectiveRoutes.delete(
  "/objectives/:id",
  requireAuth,
  objectiveController.deleteObjective,
);
objectiveRoutes.post(
  "/objectives/:id/restore",
  requireAuth,
  objectiveController.restoreObjective,
);
objectiveRoutes.delete(
  "/objectives/:id/force",
  requireAuth,
  objectiveController.forceDeleteObjective,
);
objectiveRoutes.put(
  "/objectives/:id",
  requireAuth,
  objectiveController.updateObjective,
);
