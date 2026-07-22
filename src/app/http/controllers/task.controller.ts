import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import {
  verifyProjectAccess,
  resolveSession,
} from "@/app/http/middlewares/project-access.middleware";
import {
  taskCreateSchema,
  taskUpdateSchema,
} from "@/app/http/validators/task.validator";
import { taskRepository } from "@/app/repositories/task.repository";
import { taskService } from "@/app/services/task.service";
import { mediaService } from "@/core/media";
import { BadRequestException, NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const taskController = {
  createTask: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { userId, project } = await verifyProjectAccess(req, projectId, "task:create");
    const { organizationId } = project;

    const validatedData = taskCreateSchema.parse(req.body);

    const task = await taskService.createTask(
      projectId,
      userId,
      organizationId,
      validatedData,
    );

    return ok(res, "Task created successfully", task);
  }),

  getTasks: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { userId } = await verifyProjectAccess(req, projectId, "task:read");

    const tasks = await taskService.getTasks(projectId, req.query, userId);

    return ok(res, "Tasks fetched successfully", tasks);
  }),

  getTask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.id as string;
    const { userId } = await resolveSession(req);
    const task = await taskService.getTask(taskId, userId);

    // Verify project access
    await verifyProjectAccess(req, task.projectId, "task:read");

    return ok(res, "Task details fetched successfully", task);
  }),

  updateTask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.id as string;
    const { userId } = await resolveSession(req);
    const task = await taskService.getTask(taskId, userId);

    await verifyProjectAccess(req, task.projectId, "task:update");
    const validatedData = taskUpdateSchema.parse(req.body);

    const updatedTask = await taskService.updateTask(
      taskId,
      userId,
      validatedData,
    );

    return ok(res, "Task updated successfully", updatedTask);
  }),

  deleteTask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.id as string;
    const { userId } = await resolveSession(req);
    const task = await taskService.getTask(taskId, userId);

    await verifyProjectAccess(req, task.projectId, "task:delete");

    await taskService.deleteTask(taskId, userId);

    return ok(res, "Task deleted successfully");
  }),

  uploadAttachment: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const { userId } = await resolveSession(req);

    if (!req.file) {
      throw new BadRequestException("No file uploaded");
    }

    const task = await taskService.getTask(taskId, userId);
    await verifyProjectAccess(req, task.projectId, "task:update");

    const media = await mediaService.addMedia(
      "Task",
      taskId,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      "task_attachments",
      false,
    );

    const url = mediaService.generateUrl(media);

    return ok(res, "Attachment uploaded successfully", {
      id: media.id,
      name: media.name,
      fileName: media.fileName,
      mimeType: media.mimeType,
      size: media.size,
      url,
      createdAt: media.createdAt,
    });
  }),

  deleteAttachment: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const attachmentId = req.params.attachmentId as string;
    const { userId } = await resolveSession(req);

    const task = await taskService.getTask(taskId, userId);
    await verifyProjectAccess(req, task.projectId, "task:update");

    await mediaService.deleteMedia(attachmentId);

    return ok(res, "Attachment deleted successfully");
  }),

  restoreTask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.id as string;
    const { userId } = await resolveSession(req);
    const task = await taskRepository.findTaskByIdWithTrashed(taskId);

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await verifyProjectAccess(req, task.projectId, "task:restore");

    await taskService.restoreTask(taskId, userId);

    return ok(res, "Task restored successfully");
  }),

  forceDeleteTask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.id as string;
    const { userId } = await resolveSession(req);
    const task = await taskRepository.findTaskByIdWithTrashed(taskId);

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await verifyProjectAccess(req, task.projectId, "task:force-delete");

    await taskService.forceDeleteTask(taskId, userId);

    return ok(res, "Task permanently deleted");
  }),
};
