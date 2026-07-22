import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import {
  objectiveCreateSchema,
  objectiveUpdateSchema,
} from "@/app/http/validators/objective.validator";
import { objectiveService } from "@/app/services/objective.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import prisma from "@/lib/prisma";
import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const objectiveController = {
  getObjectives: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "goal-okrs:read",
      {
        organizationId: workspace.organizationId,
        workspaceId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to view objectives.",
      );
    }

    const withTrashed = req.query.withTrashed === "true";

    if (withTrashed) {
      const canRestore = await rbacService.authorize(
        session.user.id,
        "goal-okrs:restore",
        {
          organizationId: workspace.organizationId,
          workspaceId,
        },
      );
      if (!canRestore) {
        throw new ForbiddenException(
          "Forbidden: You do not have permission to view deleted objectives.",
        );
      }
    }

    const objectives = await objectiveService.getObjectives(
      workspaceId,
      withTrashed,
    );

    return ok(res, "Objectives fetched successfully", objectives);
  }),

  createObjective: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const validatedData = objectiveCreateSchema.parse(req.body);
    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      throw new UnauthorizedException("No active organization session");
    }

    const project = await prisma.project.findUnique({
      where: { id: validatedData.projectId },
      select: { workspaceId: true, organizationId: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "goal-okrs:create",
      {
        organizationId: project.organizationId,
        workspaceId: project.workspaceId,
        projectId: validatedData.projectId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to create objectives.",
      );
    }

    const objective = await objectiveService.createObjective(
      activeOrgId,
      validatedData,
    );

    return ok(res, "Objective created successfully", objective);
  }),

  deleteObjective: asyncHandler(async (req: Request, res: Response) => {
    const objectiveId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const objective = await prisma.objective.findFirstWithTrashed({
      where: { id: objectiveId },
      include: {
        project: {
          select: { workspaceId: true, organizationId: true },
        },
      },
    });
    if (!objective) {
      throw new NotFoundException("Objective not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "goal-okrs:delete",
      {
        organizationId: objective.project.organizationId,
        workspaceId: objective.project.workspaceId,
        projectId: objective.projectId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to delete objectives.",
      );
    }

    await objectiveService.deleteObjective(objectiveId);

    return ok(res, "Objective deleted successfully");
  }),

  restoreObjective: asyncHandler(async (req: Request, res: Response) => {
    const objectiveId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const objective = await prisma.objective.findFirstWithTrashed({
      where: { id: objectiveId },
      include: {
        project: {
          select: { workspaceId: true, organizationId: true },
        },
      },
    });
    if (!objective) {
      throw new NotFoundException("Objective not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "goal-okrs:restore",
      {
        organizationId: objective.project.organizationId,
        workspaceId: objective.project.workspaceId,
        projectId: objective.projectId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to restore objectives.",
      );
    }

    await objectiveService.restoreObjective(objectiveId);

    return ok(res, "Objective restored successfully");
  }),

  forceDeleteObjective: asyncHandler(async (req: Request, res: Response) => {
    const objectiveId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const objective = await prisma.objective.findFirstWithTrashed({
      where: { id: objectiveId },
      include: {
        project: {
          select: { workspaceId: true, organizationId: true },
        },
      },
    });
    if (!objective) {
      throw new NotFoundException("Objective not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "goal-okrs:force-delete",
      {
        organizationId: objective.project.organizationId,
        workspaceId: objective.project.workspaceId,
        projectId: objective.projectId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to permanently delete objectives.",
      );
    }

    await objectiveService.forceDeleteObjective(objectiveId);

    return ok(res, "Objective permanently deleted");
  }),

  updateObjective: asyncHandler(async (req: Request, res: Response) => {
    const objectiveId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const objective = await prisma.objective.findFirstWithTrashed({
      where: { id: objectiveId },
      include: {
        project: {
          select: { workspaceId: true, organizationId: true },
        },
      },
    });
    if (!objective) {
      throw new NotFoundException("Objective not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "goal-okrs:update",
      {
        organizationId: objective.project.organizationId,
        workspaceId: objective.project.workspaceId,
        projectId: objective.projectId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to update objectives.",
      );
    }

    const validatedData = objectiveUpdateSchema.parse(req.body);
    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      throw new UnauthorizedException("No active organization session");
    }

    const updatedObjective = await objectiveService.updateObjective(
      objectiveId,
      activeOrgId,
      validatedData,
    );

    return ok(res, "Objective updated successfully", updatedObjective);
  }),
};
