import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { objectiveCreateSchema } from "@/app/http/validators/objective.validator";
import { objectiveService } from "@/app/services/objective.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { UnauthorizedException } from "@/utils/app-error";
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

    const objectives = await objectiveService.getObjectives(workspaceId);

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

    const objective = await objectiveService.createObjective(
      activeOrgId,
      validatedData
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

    await objectiveService.forceDeleteObjective(objectiveId);

    return ok(res, "Objective permanently deleted");
  }),
};
