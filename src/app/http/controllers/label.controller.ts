import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import { labelCreateSchema } from "@/app/http/validators/label.validator";
import { labelRepository } from "@/app/repositories/label.repository";
import { labelService } from "@/app/services/label.service";
import { NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const labelController = {
  createLabel: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId, "project-label:create");
    const { organizationId } = project;

    const validatedData = labelCreateSchema.parse(req.body);

    const label = await labelService.createLabel(
      projectId,
      organizationId,
      validatedData,
    );

    return ok(res, "Label created successfully", label);
  }),

  getLabels: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId, "project-label:read");

    const labels = await labelService.getLabels(projectId);

    return ok(res, "Labels fetched successfully", labels);
  }),

  updateLabel: asyncHandler(async (req: Request, res: Response) => {
    const labelId = req.params.id as string;

    const label = await labelRepository.findById(labelId);
    if (!label) {
      throw new NotFoundException("Label not found");
    }

    await verifyProjectAccess(req, label.projectId, "project-label:update");

    const validatedData = labelCreateSchema.partial().parse(req.body);

    const updated = await labelService.updateLabel(label, validatedData);

    return ok(res, "Label updated successfully", updated);
  }),

  deleteLabel: asyncHandler(async (req: Request, res: Response) => {
    const labelId = req.params.id as string;

    const label = await labelRepository.findById(labelId);
    if (!label) {
      throw new NotFoundException("Label not found");
    }

    await verifyProjectAccess(req, label.projectId, "project-label:delete");

    await labelService.deleteLabel(labelId);

    return ok(res, "Label deleted successfully");
  }),

  restoreLabel: asyncHandler(async (req: Request, res: Response) => {
    const labelId = req.params.id as string;

    const label = await labelRepository.findByIdWithTrashed(labelId);
    if (!label) {
      throw new NotFoundException("Label not found");
    }

    await verifyProjectAccess(req, label.projectId, "project-label:restore");

    await labelService.restoreLabel(labelId);

    return ok(res, "Label restored successfully");
  }),

  forceDeleteLabel: asyncHandler(async (req: Request, res: Response) => {
    const labelId = req.params.id as string;

    const label = await labelRepository.findByIdWithTrashed(labelId);
    if (!label) {
      throw new NotFoundException("Label not found");
    }

    await verifyProjectAccess(req, label.projectId, "project-label:force-delete");

    await labelService.forceDeleteLabel(labelId);

    return ok(res, "Label permanently deleted");
  }),
};
