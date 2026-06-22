import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { z } from "zod";
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";

// Local helper to verify access
async function verifyProjectAccess(req: Request, projectId: string) {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    throw new BadRequestException("No active organization found");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }

  // Check Org Admin/Owner
  const callerOrgMember = await prisma.member.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: session.user.id,
      role: { in: ["owner", "admin"] },
    },
  });

  if (callerOrgMember) {
    return { activeOrgId, userId: session.user.id, project };
  }

  // Check Workspace Admin
  const callerWorkspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspaceId,
      userId: session.user.id,
      role: "admin",
      workspace: { organizationId: activeOrgId },
    },
  });

  if (callerWorkspaceMember) {
    return { activeOrgId, userId: session.user.id, project };
  }

  // Check Project Member
  const projectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: session.user.id,
      },
    },
  });

  if (!projectMember) {
    throw new ForbiddenException("Forbidden: You must be a project member or workspace/org admin");
  }

  return { activeOrgId, userId: session.user.id, project };
}

const dependencyCreateSchema = z.object({
  dependencyTaskId: z.string().uuid("Invalid dependency task ID"),
  direction: z.enum(["blocks", "blocked_by"]),
});

export const dependencyController = {
  getDependencies: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await verifyProjectAccess(req, task.projectId);

    // Get dependencies where this task is BLOCKED BY other tasks (blocking tasks)
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

    // Get dependencies where this task BLOCKS other tasks (blocked tasks)
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
      blockedBy: blockedBy.map(d => ({
        dependencyId: d.id,
        task: d.blockingTask,
      })),
      blocking: blocking.map(d => ({
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

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    const depTask = await prisma.task.findUnique({
      where: { id: validatedData.dependencyTaskId },
    });

    if (!task || !depTask) {
      throw new NotFoundException("One or both tasks not found");
    }

    const { userId } = await verifyProjectAccess(req, task.projectId);
    await verifyProjectAccess(req, depTask.projectId);

    // Determine blocking/blocked roles
    const blockingTaskId = validatedData.direction === "blocks" ? task.id : depTask.id;
    const blockedTaskId = validatedData.direction === "blocks" ? depTask.id : task.id;

    // Check circular dependency
    const circular = await prisma.taskDependency.findFirst({
      where: {
        blockingTaskId: blockedTaskId,
        blockedTaskId: blockingTaskId,
      },
    });
    if (circular) {
      throw new BadRequestException("Circular dependency detected!");
    }

    // Check duplicate
    const existing = await prisma.taskDependency.findFirst({
      where: {
        blockingTaskId,
        blockedTaskId,
      },
    });
    if (existing) {
      throw new BadRequestException("This dependency already exists");
    }

    const dependency = await prisma.taskDependency.create({
      data: {
        blockingTaskId,
        blockedTaskId,
        dependencyType: "blocks",
      },
    });

    // Log activity
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId,
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
      include: {
        blockingTask: true,
        blockedTask: true,
      },
    });

    if (!dependency) {
      throw new NotFoundException("Dependency not found");
    }

    const { userId } = await verifyProjectAccess(req, dependency.blockingTask.projectId);
    await verifyProjectAccess(req, dependency.blockedTask.projectId);

    await prisma.taskDependency.delete({
      where: { id: dependencyId },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: dependency.blockingTaskId,
        userId,
        action: "dependency_deleted",
        oldValue: `Removed dependency blocking "${dependency.blockedTask.title}"`,
      },
    });

    return ok(res, "Task dependency deleted successfully");
  }),
};
