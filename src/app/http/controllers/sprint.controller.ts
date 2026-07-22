import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import {
  sprintCreateSchema,
  sprintUpdateSchema,
} from "@/app/http/validators/sprint.validator";
import { sprintRepository } from "@/app/repositories/sprint.repository";
import { sprintService } from "@/app/services/sprint.service";
import { NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const sprintController = {
  createSprint: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId, "sprint:create");
    const { organizationId } = project;

    const validatedData = sprintCreateSchema.parse(req.body);

    const sprint = await sprintService.createSprint(
      projectId,
      organizationId,
      validatedData,
    );

    return ok(res, "Sprint created successfully", sprint);
  }),

  getSprints: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId, "sprint:read");

    const sprints = await sprintService.getSprints(projectId);

    return ok(res, "Sprints fetched successfully", sprints);
  }),

  getSprint: asyncHandler(async (req: Request, res: Response) => {
    const sprintId = req.params.id as string;

    const sprint = await sprintRepository.findByIdWithTasks(sprintId);
    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    await verifyProjectAccess(req, sprint.projectId, "sprint:read");

    return ok(res, "Sprint details fetched successfully", sprint);
  }),

  updateSprint: asyncHandler(async (req: Request, res: Response) => {
    const sprintId = req.params.id as string;

    const existingSprint = await sprintRepository.findById(sprintId);
    if (!existingSprint) {
      throw new NotFoundException("Sprint not found");
    }

    const { userId } = await verifyProjectAccess(req, existingSprint.projectId, "sprint:update");
    const validatedData = sprintUpdateSchema.parse(req.body);

    const updatedSprint = await sprintService.updateSprint(
      existingSprint,
      validatedData,
      userId,
    );

    return ok(res, "Sprint updated successfully", updatedSprint);
  }),

  deleteSprint: asyncHandler(async (req: Request, res: Response) => {
    const sprintId = req.params.id as string;

    const sprint = await sprintRepository.findById(sprintId);
    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    await verifyProjectAccess(req, sprint.projectId, "sprint:delete");

    await sprintService.deleteSprint(sprintId);

    return ok(res, "Sprint deleted successfully");
  }),

  restoreSprint: asyncHandler(async (req: Request, res: Response) => {
    const sprintId = req.params.id as string;

    const sprint = await sprintRepository.findByIdWithTrashed(sprintId);
    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    await verifyProjectAccess(req, sprint.projectId, "sprint:restore");

    await sprintService.restoreSprint(sprintId);

    return ok(res, "Sprint restored successfully");
  }),

  forceDeleteSprint: asyncHandler(async (req: Request, res: Response) => {
    const sprintId = req.params.id as string;

    const sprint = await sprintRepository.findByIdWithTrashed(sprintId);
    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    await verifyProjectAccess(req, sprint.projectId, "sprint:force-delete");

    await sprintService.forceDeleteSprint(sprintId);

    return ok(res, "Sprint permanently deleted");
  }),
};
