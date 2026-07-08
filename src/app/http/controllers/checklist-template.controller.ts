import { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { resolveSession } from "@/app/http/middlewares/project-access.middleware";
import {
  checklistTemplateCreateSchema,
  checklistTemplateUpdateSchema,
} from "@/app/http/validators/checklist-template.validator";
import { checklistTemplateService } from "@/app/services/checklist-template.service";
import prisma from "@/lib/prisma";
import { ForbiddenException, NotFoundException } from "@/utils/app-error";

export const checklistTemplateController = {
  getTemplates: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res
        .status(400)
        .json({ success: false, message: "workspaceId is required" });
    }

    const { userId } = await resolveSession(req);
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      userId,
      "checklist-template:read",
      {
        organizationId: workspace.organizationId,
        workspaceId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to view checklist templates.",
      );
    }

    const templates = await checklistTemplateService.getTemplates(workspaceId);
    return res.status(200).json({ success: true, data: templates });
  }),

  createTemplate: asyncHandler(async (req: Request, res: Response) => {
    const validated = checklistTemplateCreateSchema.parse(req.body);
    const { userId } = await resolveSession(req);

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      userId,
      "checklist-template:create",
      {
        organizationId: validated.organizationId,
        workspaceId: validated.workspaceId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to create checklist templates.",
      );
    }

    const template = await checklistTemplateService.createTemplate(validated);
    return res.status(201).json({
      success: true,
      message: "Checklist template created successfully",
      data: template,
    });
  }),

  updateTemplate: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { userId } = await resolveSession(req);

    const templateRecord = await prisma.checklistTemplate.findUnique({
      where: { id },
    });
    if (!templateRecord) {
      throw new NotFoundException("Checklist template not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      userId,
      "checklist-template:update",
      {
        organizationId: templateRecord.organizationId,
        workspaceId: templateRecord.workspaceId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to update checklist templates.",
      );
    }

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
    const { userId } = await resolveSession(req);

    const templateRecord = await prisma.checklistTemplate.findUnique({
      where: { id },
    });
    if (!templateRecord) {
      throw new NotFoundException("Checklist template not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      userId,
      "checklist-template:delete",
      {
        organizationId: templateRecord.organizationId,
        workspaceId: templateRecord.workspaceId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to delete checklist templates.",
      );
    }

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
    const parentTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true, organizationId: true },
    });
    if (!parentTask) {
      throw new NotFoundException("Parent task not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(userId, "task:create", {
      organizationId: parentTask.organizationId,
      projectId: parentTask.projectId,
      taskId,
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to modify this task.",
      );
    }

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
