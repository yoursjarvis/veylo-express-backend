import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import { epicRepository } from "@/app/repositories/epic.repository";
import { epicService } from "@/app/services/epic.service";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { NotFoundException } from "@/utils/app-error";
import { epicCreateSchema, epicUpdateSchema } from "@/app/http/validators/epic.validator";

export const epicController = {
  createEpic: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId);
    const { organizationId } = project;

    const validatedData = epicCreateSchema.parse(req.body);

    const epic = await epicService.createEpic(projectId, organizationId, validatedData);

    return ok(res, "Epic created successfully", epic);
  }),

  getEpics: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const epics = await epicService.getEpics(projectId);

    return ok(res, "Epics fetched successfully", epics);
  }),

  getEpic: asyncHandler(async (req: Request, res: Response) => {
    const epicId = req.params.id as string;

    const epic = await epicRepository.findByIdWithTasks(epicId);
    if (!epic) {
      throw new NotFoundException("Epic not found");
    }

    await verifyProjectAccess(req, epic.projectId);

    return ok(res, "Epic details fetched successfully", epic);
  }),

  updateEpic: asyncHandler(async (req: Request, res: Response) => {
    const epicId = req.params.id as string;

    const existingEpic = await epicRepository.findById(epicId);
    if (!existingEpic) {
      throw new NotFoundException("Epic not found");
    }

    await verifyProjectAccess(req, existingEpic.projectId);
    const validatedData = epicUpdateSchema.parse(req.body);

    const updatedEpic = await epicService.updateEpic(epicId, validatedData);

    return ok(res, "Epic updated successfully", updatedEpic);
  }),

  deleteEpic: asyncHandler(async (req: Request, res: Response) => {
    const epicId = req.params.id as string;

    const epic = await epicRepository.findById(epicId);
    if (!epic) {
      throw new NotFoundException("Epic not found");
    }

    await verifyProjectAccess(req, epic.projectId);

    await epicService.deleteEpic(epicId);

    return ok(res, "Epic deleted successfully");
  }),
};
