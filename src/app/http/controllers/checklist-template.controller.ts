import { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { resolveSession } from "@/app/http/middlewares/project-access.middleware";
import {
  checklistTemplateCreateSchema,
  checklistTemplateUpdateSchema,
} from "@/app/http/validators/checklist-template.validator";
import { checklistTemplateService } from "@/app/services/checklist-template.service";

export const checklistTemplateController = {
  getTemplates: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res
        .status(400)
        .json({ success: false, message: "workspaceId is required" });
    }
    const templates = await checklistTemplateService.getTemplates(workspaceId);
    return res.status(200).json({ success: true, data: templates });
  }),

  createTemplate: asyncHandler(async (req: Request, res: Response) => {
    const validated = checklistTemplateCreateSchema.parse(req.body);
    const template = await checklistTemplateService.createTemplate(validated);
    return res.status(201).json({
      success: true,
      message: "Checklist template created successfully",
      data: template,
    });
  }),

  updateTemplate: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const validated = checklistTemplateUpdateSchema.parse(req.body);
    const template = await checklistTemplateService.updateTemplate(
      id,
      validated,
    );
    return res.status(200).json({
      success: true,
      message: "Checklist template updated successfully",
      data: template,
    });
  }),

  deleteTemplate: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await checklistTemplateService.deleteTemplate(id);
    return res.status(200).json({
      success: true,
      message: "Checklist template deleted successfully",
    });
  }),

  applyTemplate: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const templateId = req.body.templateId as string;
    if (!templateId) {
      return res
        .status(400)
        .json({ success: false, message: "templateId is required" });
    }
    const { userId } = await resolveSession(req);
    const subtasks = await checklistTemplateService.applyTemplateToTask(
      taskId,
      templateId,
      userId,
    );
    return res.status(200).json({
      success: true,
      message: "Checklist template applied successfully",
      data: subtasks,
    });
  }),
};
