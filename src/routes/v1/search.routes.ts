import { requirePermission } from "@/app/http/middlewares/rbac.middleware";
import { Router, Request } from "express";

import { searchController } from "@/app/http/controllers/search.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";

export const searchRoutes = Router();

const extractContext = (req: Request) => ({
  workspaceId: req.params.workspaceId || req.params.id,
  projectId: req.params.projectId || (req.baseUrl.includes('projects') ? req.params.id : undefined),
  taskId: req.params.taskId || (req.baseUrl.includes('tasks') ? req.params.id : undefined),
  organizationId: req.params.organizationId
});


searchRoutes.get("/", requireAuth, searchController.globalSearch);
