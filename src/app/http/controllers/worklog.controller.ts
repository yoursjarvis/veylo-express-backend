import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess, resolveSession } from "@/app/http/middlewares/project-access.middleware";
import { workLogCreateSchema, workLogUpdateSchema } from "@/app/http/validators/worklog.validator";
import { workLogService } from "@/app/services/worklog.service";
import prisma from "@/lib/prisma";
import { NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const workLogController = {
  createWorkLog: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const { userId } = await verifyProjectAccess(req, task.projectId);
    const validatedData = workLogCreateSchema.parse(req.body);

    const workLog = await workLogService.createWorkLog(taskId, userId, validatedData);
    return ok(res, "Work log created successfully", workLog);
  }),

  getTaskWorkLogs: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await verifyProjectAccess(req, task.projectId);
    const logs = await workLogService.getTaskWorkLogs(taskId);
    return ok(res, "Task work logs fetched successfully", logs);
  }),

  getProjectWorkLogs: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const logs = await workLogService.getProjectWorkLogs(projectId);
    return ok(res, "Project work logs fetched successfully", logs);
  }),

  updateWorkLog: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { userId } = await resolveSession(req);
    const validatedData = workLogUpdateSchema.parse(req.body);

    const workLog = await workLogService.updateWorkLog(id, userId, validatedData);
    return ok(res, "Work log updated successfully", workLog);
  }),

  deleteWorkLog: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { userId } = await resolveSession(req);

    await workLogService.deleteWorkLog(id, userId);
    return ok(res, "Work log deleted successfully");
  }),
};
