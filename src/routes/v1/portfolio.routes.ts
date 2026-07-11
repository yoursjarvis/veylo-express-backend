import { Router } from "express";

import { portfolioController } from "@/app/http/controllers/portfolio.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";

export const portfolioRoutes = Router();

portfolioRoutes.get(
  "/workspaces/:workspaceId/portfolios",
  requireAuth,
  portfolioController.getPortfolios,
);

portfolioRoutes.post(
  "/workspaces/:workspaceId/portfolios",
  requireAuth,
  portfolioController.createPortfolio,
);

portfolioRoutes.get(
  "/portfolios/:id",
  requireAuth,
  portfolioController.getPortfolio,
);

portfolioRoutes.patch(
  "/portfolios/:id",
  requireAuth,
  portfolioController.updatePortfolio,
);

portfolioRoutes.delete(
  "/portfolios/:id",
  requireAuth,
  portfolioController.deletePortfolio,
);

portfolioRoutes.post(
  "/portfolios/:id/restore",
  requireAuth,
  portfolioController.restorePortfolio,
);

portfolioRoutes.delete(
  "/portfolios/:id/force",
  requireAuth,
  portfolioController.forceDeletePortfolio,
);
