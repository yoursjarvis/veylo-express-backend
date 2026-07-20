import { requirePermission } from "@/app/http/middlewares/rbac.middleware";
import { Router, Request } from "express";

import { portfolioController } from "@/app/http/controllers/portfolio.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";

export const portfolioRoutes = Router();

const extractContext = (req: Request) => ({
  workspaceId: req.params.workspaceId || req.params.id,
  projectId: req.params.projectId || (req.baseUrl.includes('projects') ? req.params.id : undefined),
  taskId: req.params.taskId || (req.baseUrl.includes('tasks') ? req.params.id : undefined),
  organizationId: req.params.organizationId
});


portfolioRoutes.get("\/workspaces\/:workspaceId\/portfolios",
  requireAuth, requirePermission("portfolio:read", extractContext),
  portfolioController.getPortfolios,
);

portfolioRoutes.post("\/workspaces\/:workspaceId\/portfolios",
  requireAuth, requirePermission("portfolio:create", extractContext),
  portfolioController.createPortfolio,
);

portfolioRoutes.get("\/portfolios\/:id",
  requireAuth, requirePermission("portfolio:read", extractContext),
  portfolioController.getPortfolio,
);

portfolioRoutes.patch("\/portfolios\/:id",
  requireAuth, requirePermission("portfolio:update", extractContext),
  portfolioController.updatePortfolio,
);

portfolioRoutes.delete("\/portfolios\/:id",
  requireAuth, requirePermission("portfolio:delete", extractContext),
  portfolioController.deletePortfolio,
);

portfolioRoutes.post("\/portfolios\/:id\/restore",
  requireAuth, requirePermission("portfolio:restore", extractContext),
  portfolioController.restorePortfolio,
);

portfolioRoutes.delete("\/portfolios\/:id\/force",
  requireAuth, requirePermission("portfolio:force-delete", extractContext),
  portfolioController.forceDeletePortfolio,
);
