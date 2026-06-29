import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import { dependencyCreateSchema } from "@/app/http/validators/dependency.validator";
import { dependencyRepository } from "@/app/repositories/dependency.repository";
import { dependencyService } from "@/app/services/dependency.service";
import { BadRequestException, NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const dependencyController = {
  getDependencies: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const result = await dependencyService.getDependencies(taskId);

    await verifyProjectAccess(req, result.projectId);

    return ok(res, "Task dependencies fetched successfully", result.data);
  }),

  createDependency: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const validatedData = dependencyCreateSchema.parse(req.body);

    if (taskId === validatedData.dependencyTaskId) {
      throw new BadRequestException("A task cannot depend on itself");
    }

    const [task, depTask] = await Promise.all([
      dependencyRepository.findTaskById(taskId),
      dependencyRepository.findTaskById(validatedData.dependencyTaskId),
    ]);

    if (!task || !depTask) {
      throw new NotFoundException("One or both tasks not found");
    }

    const { userId } = await verifyProjectAccess(req, task.projectId);
    await verifyProjectAccess(req, depTask.projectId);

    const dependency = await dependencyService.createDependency(task, depTask, validatedData, userId);

    return ok(res, "Task dependency added successfully", dependency);
  }),

  deleteDependency: asyncHandler(async (req: Request, res: Response) => {
    const dependencyId = req.params.id as string;

    const dependency = await dependencyRepository.findDependencyById(dependencyId);

    if (!dependency) {
      throw new NotFoundException("Dependency not found");
    }

    const { userId } = await verifyProjectAccess(req, dependency.blockingTask.projectId);
    await verifyProjectAccess(req, dependency.blockedTask.projectId);

    await dependencyService.deleteDependency(dependency, userId);

    return ok(res, "Task dependency deleted successfully");
  }),
};
