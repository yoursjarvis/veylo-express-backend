import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { resolveSession } from "@/app/http/middlewares/project-access.middleware";
import {
  portfolioCreateSchema,
  portfolioUpdateSchema,
} from "@/app/http/validators/portfolio.validator";
import { portfolioService } from "@/app/services/portfolio.service";
import { rbacService } from "@/app/services/rbac.service";
import prisma from "@/lib/prisma";
import { ForbiddenException, NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const portfolioController = {
  getPortfolios: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const { activeOrgId, userId } = await resolveSession(req);

    const isAllowed = await rbacService.authorize(userId, "portfolio:read", {
      organizationId: activeOrgId,
      workspaceId,
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to view portfolios.",
      );
    }

    const withTrashed = req.query.withTrashed === "true";
    const onlyTrashed = req.query.onlyTrashed === "true";

    const portfolios = await portfolioService.getPortfolios(workspaceId, {
      withTrashed,
      onlyTrashed,
    });

    return ok(res, "Portfolios fetched successfully", portfolios);
  }),

  getPortfolio: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId, userId } = await resolveSession(req);

    const withTrashed = req.query.withTrashed === "true";
    const portfolio = await portfolioService.getPortfolioById(id, {
      withTrashed,
    });

    if (!portfolio) {
      throw new NotFoundException("Portfolio not found");
    }

    const isAllowed = await rbacService.authorize(userId, "portfolio:read", {
      organizationId: activeOrgId,
      workspaceId: portfolio.workspaceId,
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to view this portfolio.",
      );
    }

    return ok(res, "Portfolio fetched successfully", portfolio);
  }),

  createPortfolio: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const { activeOrgId, userId } = await resolveSession(req);

    const isAllowed = await rbacService.authorize(userId, "portfolio:create", {
      organizationId: activeOrgId,
      workspaceId,
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to create portfolios.",
      );
    }

    const validatedData = portfolioCreateSchema.parse(req.body);

    const portfolio = await portfolioService.createPortfolio(
      workspaceId,
      activeOrgId,
      userId,
      validatedData,
    );

    return ok(res, "Portfolio created successfully", portfolio);
  }),

  updatePortfolio: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId, userId } = await resolveSession(req);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
    });

    if (!portfolio) {
      throw new NotFoundException("Portfolio not found");
    }

    const isAllowed = await rbacService.authorize(userId, "portfolio:update", {
      organizationId: activeOrgId,
      workspaceId: portfolio.workspaceId,
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to update this portfolio.",
      );
    }

    const validatedData = portfolioUpdateSchema.parse(req.body);

    const updatedPortfolio = await portfolioService.updatePortfolio(
      id,
      validatedData,
    );

    return ok(res, "Portfolio updated successfully", updatedPortfolio);
  }),

  deletePortfolio: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId, userId } = await resolveSession(req);

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
    });

    if (!portfolio) {
      throw new NotFoundException("Portfolio not found");
    }

    const isAllowed = await rbacService.authorize(userId, "portfolio:delete", {
      organizationId: activeOrgId,
      workspaceId: portfolio.workspaceId,
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to delete this portfolio.",
      );
    }

    await portfolioService.deletePortfolio(id);

    return ok(res, "Portfolio soft-deleted successfully");
  }),

  restorePortfolio: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId, userId } = await resolveSession(req);

    const portfolio = await prisma.portfolio.findFirstWithTrashed({
      where: { id },
    });

    if (!portfolio) {
      throw new NotFoundException("Portfolio not found");
    }

    const isAllowed = await rbacService.authorize(userId, "portfolio:restore", {
      organizationId: activeOrgId,
      workspaceId: portfolio.workspaceId,
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to restore this portfolio.",
      );
    }

    const restoredPortfolio = await portfolioService.restorePortfolio(id);

    return ok(res, "Portfolio restored successfully", restoredPortfolio);
  }),

  forceDeletePortfolio: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId, userId } = await resolveSession(req);

    const portfolio = await prisma.portfolio.findFirstWithTrashed({
      where: { id },
    });

    if (!portfolio) {
      throw new NotFoundException("Portfolio not found");
    }

    const isAllowed = await rbacService.authorize(
      userId,
      "portfolio:force-delete",
      {
        organizationId: activeOrgId,
        workspaceId: portfolio.workspaceId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to permanently delete this portfolio.",
      );
    }

    await portfolioService.forceDeletePortfolio(id);

    return ok(res, "Portfolio permanently deleted successfully");
  }),
};
