import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";

const dependencyCreateSchema = z.object({
  dependencyTaskId: z.string().uuid("Invalid dependency task ID"),
  direction: z.enum(["blocks", "blocked_by"]),
});

export const dependencyController = {
  getDependencies: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await verifyProjectAccess(req, task.projectId);

    // Tasks that BLOCK this task (this task is blocked by them)
    const blockedBy = await prisma.taskDependency.findMany({
      where: { blockedTaskId: taskId },
      include: {
        blockingTask: {
          select: {
            id: true,
            title: true,
            type: true,
            priority: true,
            projectId: true,
            status: { select: { name: true, category: true } },
            project: { select: { title: true } },
          },
        },
      },
    });

    // Tasks that THIS task blocks
    const blocking = await prisma.taskDependency.findMany({
      where: { blockingTaskId: taskId },
      include: {
        blockedTask: {
          select: {
            id: true,
            title: true,
            type: true,
            priority: true,
            projectId: true,
            status: { select: { name: true, category: true } },
            project: { select: { title: true } },
          },
        },
      },
    });

    return ok(res, "Task dependencies fetched successfully", {
      blockedBy: blockedBy.map((d) => ({
        dependencyId: d.id,
        task: d.blockingTask,
      })),
      blocking: blocking.map((d) => ({
        dependencyId: d.id,
        task: d.blockedTask,
      })),
    });
  }),

  createDependency: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const validatedData = dependencyCreateSchema.parse(req.body);

    if (taskId === validatedData.dependencyTaskId) {
      throw new BadRequestException("A task cannot depend on itself");
    }

    const [task, depTask] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId } }),
      prisma.task.findUnique({ where: { id: validatedData.dependencyTaskId } }),
    ]);

    if (!task || !depTask) {
      throw new NotFoundException("One or both tasks not found");
    }

    const { userId } = await verifyProjectAccess(req, task.projectId);
    // Verify access to both sides of the dependency
    await verifyProjectAccess(req, depTask.projectId);

    const blockingTaskId = validatedData.direction === "blocks" ? task.id : depTask.id;
    const blockedTaskId = validatedData.direction === "blocks" ? depTask.id : task.id;

    // Check for circular dependency
    const circular = await prisma.taskDependency.findFirst({
      where: { blockingTaskId: blockedTaskId, blockedTaskId: blockingTaskId },
    });
    if (circular) {
      throw new BadRequestException("Circular dependency detected!");
    }

    // Check for duplicate
    const existing = await prisma.taskDependency.findFirst({
      where: { blockingTaskId, blockedTaskId },
    });
    if (existing) {
      throw new BadRequestException("This dependency already exists");
    }

    const dependency = await prisma.taskDependency.create({
      data: { blockingTaskId, blockedTaskId, dependencyType: "blocks" },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId,
        organizationId: task.organizationId,
        action: "dependency_added",
        newValue: `Added dependency: ${validatedData.direction === "blocks" ? "blocks" : "blocked by"} "${depTask.title}"`,
      },
    });

    return ok(res, "Task dependency added successfully", dependency);
  }),

  deleteDependency: asyncHandler(async (req: Request, res: Response) => {
    const dependencyId = req.params.id as string;

    const dependency = await prisma.taskDependency.findUnique({
      where: { id: dependencyId },
      include: { blockingTask: true, blockedTask: true },
    });

    if (!dependency) {
      throw new NotFoundException("Dependency not found");
    }

    const { userId } = await verifyProjectAccess(req, dependency.blockingTask.projectId);
    await verifyProjectAccess(req, dependency.blockedTask.projectId);

    await prisma.taskDependency.delete({ where: { id: dependencyId } });

    await prisma.taskActivity.create({
      data: {
        taskId: dependency.blockingTaskId,
        userId,
        organizationId: dependency.blockingTask.organizationId,
        action: "dependency_deleted",
        oldValue: `Removed dependency blocking "${dependency.blockedTask.title}"`,
      },
    });

    return ok(res, "Task dependency deleted successfully");
  }),
};
