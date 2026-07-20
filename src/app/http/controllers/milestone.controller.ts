import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import {
  milestoneCreateSchema,
  milestoneUpdateSchema,
} from "@/app/http/validators/milestone.validator";
import { milestoneRepository } from "@/app/repositories/milestone.repository";
import { milestoneService } from "@/app/services/milestone.service";
import { NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const milestoneController = {
  createMilestone: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId, "project-milestone:create");
    const { organizationId } = project;

    const validatedData = milestoneCreateSchema.parse(req.body);

    const milestone = await milestoneService.createMilestone(
      projectId,
      organizationId,
      validatedData,
    );

    return ok(res, "Milestone created successfully", milestone);
  }),

  getMilestones: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId, "project-milestone:read");

    const milestones = await milestoneService.getMilestones(projectId);

    return ok(res, "Milestones fetched successfully", milestones);
  }),

  updateMilestone: asyncHandler(async (req: Request, res: Response) => {
    const milestoneId = req.params.id as string;

    const milestone = await milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new NotFoundException("Milestone not found");
    }

    await verifyProjectAccess(req, milestone.projectId, "project-milestone:update");

    const validatedData = milestoneUpdateSchema.parse(req.body);

    const updated = await milestoneService.updateMilestone(
      milestoneId,
      validatedData,
    );

    return ok(res, "Milestone updated successfully", updated);
  }),

  deleteMilestone: asyncHandler(async (req: Request, res: Response) => {
    const milestoneId = req.params.id as string;

    const milestone = await milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new NotFoundException("Milestone not found");
    }

    await verifyProjectAccess(req, milestone.projectId, "project-milestone:delete");

    await milestoneService.deleteMilestone(milestoneId);

    return ok(res, "Milestone deleted successfully");
  }),

  restoreMilestone: asyncHandler(async (req: Request, res: Response) => {
    const milestoneId = req.params.id as string;

    const milestone =
      await milestoneRepository.findByIdWithTrashed(milestoneId);
    if (!milestone) {
      throw new NotFoundException("Milestone not found");
    }

    await verifyProjectAccess(req, milestone.projectId, "project-milestone:restore");

    await milestoneService.restoreMilestone(milestoneId);

    return ok(res, "Milestone restored successfully");
  }),

  forceDeleteMilestone: asyncHandler(async (req: Request, res: Response) => {
    const milestoneId = req.params.id as string;

    const milestone =
      await milestoneRepository.findByIdWithTrashed(milestoneId);
    if (!milestone) {
      throw new NotFoundException("Milestone not found");
    }

    await verifyProjectAccess(req, milestone.projectId, "project-milestone:force-delete");

    await milestoneService.forceDeleteMilestone(milestoneId);

    return ok(res, "Milestone permanently deleted");
  }),
};
