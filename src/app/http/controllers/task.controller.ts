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
import { notificationService } from "@/app/services/notification.service";

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

// Helper to log task activity
async function logActivity(taskId: string, userId: string, action: string, oldValue?: string | null, newValue?: string | null) {
  await prisma.taskActivity.create({
    data: {
      taskId,
      userId,
      action,
      oldValue: oldValue || null,
      newValue: newValue || null,
    },
  });
}

const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  statusId: z.string().uuid("Invalid status ID"),
  sprintId: z.string().uuid().optional().nullable(),
  type: z.enum(["task", "bug", "feature"]).optional().default("task"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  estimate: z.number().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  customFields: z.record(z.string(), z.any()).optional().default({}),
});

const taskUpdateSchema = taskCreateSchema.partial();

export const taskController = {
  createTask: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { userId } = await verifyProjectAccess(req, projectId);

    const validatedData = taskCreateSchema.parse(req.body);

    // Verify status belongs to project
    const status = await prisma.taskStatus.findFirst({
      where: { id: validatedData.statusId, projectId },
    });
    if (!status) {
      throw new BadRequestException("Selected status does not belong to this project");
    }

    // Verify sprint belongs to project
    if (validatedData.sprintId) {
      const sprint = await prisma.sprint.findFirst({
        where: { id: validatedData.sprintId, projectId },
      });
      if (!sprint) {
        throw new BadRequestException("Selected sprint does not belong to this project");
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        statusId: validatedData.statusId,
        projectId,
        sprintId: validatedData.sprintId || null,
        type: validatedData.type,
        priority: validatedData.priority,
        estimate: validatedData.estimate,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        creatorId: userId,
        assigneeId: validatedData.assigneeId || null,
        customFields: validatedData.customFields,
      },
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
    });

    // Log creation
    await logActivity(task.id, userId, "created", null, task.title);

    // Trigger notification in background
    notificationService.handleTaskCreated(task.id, userId);

    return ok(res, "Task created successfully", task);
  }),

  getTasks: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const { sprintId, assigneeId, statusId, priority, type, search } = req.query;

    const whereClause: any = {
      projectId,
      deletedAt: null,
    };

    if (sprintId === "null") {
      whereClause.sprintId = null;
    } else if (sprintId) {
      whereClause.sprintId = sprintId as string;
    }

    if (assigneeId === "null") {
      whereClause.assigneeId = null;
    } else if (assigneeId) {
      whereClause.assigneeId = assigneeId as string;
    }

    if (statusId) {
      whereClause.statusId = statusId as string;
    }

    if (priority) {
      whereClause.priority = priority as string;
    }

    if (type) {
      whereClause.type = type as string;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, image: true, email: true },
        },
        _count: {
          select: { subtasks: true, comments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(res, "Tasks fetched successfully", tasks);
  }),

  getTask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.id as string;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, image: true, email: true },
        },
        creator: {
          select: { id: true, name: true, image: true, email: true },
        },
        subtasks: {
          include: {
            assignee: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        comments: {
          include: {
            user: { select: { id: true, name: true, image: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        activityLogs: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    // Verify project access
    await verifyProjectAccess(req, task.projectId);

    return ok(res, "Task details fetched successfully", task);
  }),

  updateTask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.id as string;

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { status: true, assignee: true, sprint: true },
    });

    if (!existingTask) {
      throw new NotFoundException("Task not found");
    }

    const { userId } = await verifyProjectAccess(req, existingTask.projectId);
    const validatedData = taskUpdateSchema.parse(req.body);

    const oldTaskInfo = {
      statusId: existingTask.statusId,
      statusName: existingTask.status.name,
      assigneeId: existingTask.assigneeId,
      assigneeName: existingTask.assignee?.name,
    };

    const updateData: any = {};

    // Validate and audit status change
    if (validatedData.statusId && validatedData.statusId !== existingTask.statusId) {
      const newStatus = await prisma.taskStatus.findFirst({
        where: { id: validatedData.statusId, projectId: existingTask.projectId },
      });
      if (!newStatus) {
        throw new BadRequestException("Selected status does not belong to this project");
      }

      // Advanced transition validation: Cannot move to Done if there are incomplete subtasks
      if (newStatus.category === "done") {
        const incompleteCount = await prisma.subtask.count({
          where: { taskId, isCompleted: false },
        });
        if (incompleteCount > 0) {
          throw new BadRequestException(
            "Cannot transition to Done while there are incomplete subtasks. Complete all subtasks first."
          );
        }
      }

      updateData.statusId = validatedData.statusId;
      await logActivity(taskId, userId, "status_changed", existingTask.status.name, newStatus.name);
    }

    // Validate and audit sprint change
    if (validatedData.sprintId !== undefined && validatedData.sprintId !== existingTask.sprintId) {
      let sprintName = "Backlog";
      if (validatedData.sprintId) {
        const sprint = await prisma.sprint.findFirst({
          where: { id: validatedData.sprintId, projectId: existingTask.projectId },
        });
        if (!sprint) {
          throw new BadRequestException("Selected sprint does not belong to this project");
        }
        updateData.sprintId = validatedData.sprintId;
        sprintName = sprint.name;
      } else {
        updateData.sprintId = null;
      }
      await logActivity(
        taskId,
        userId,
        "sprint_changed",
        existingTask.sprint?.name || "Backlog",
        sprintName
      );
    }

    // Validate and audit assignee change
    if (validatedData.assigneeId !== undefined && validatedData.assigneeId !== existingTask.assigneeId) {
      let assigneeName = "Unassigned";
      if (validatedData.assigneeId) {
        const newAssignee = await prisma.user.findUnique({
          where: { id: validatedData.assigneeId },
        });
        if (!newAssignee) {
          throw new BadRequestException("Assignee not found");
        }
        updateData.assigneeId = validatedData.assigneeId;
        assigneeName = newAssignee.name;
      } else {
        updateData.assigneeId = null;
      }
      await logActivity(
        taskId,
        userId,
        "assignee_changed",
        existingTask.assignee?.name || "Unassigned",
        assigneeName
      );
    }

    // Audit priority change
    if (validatedData.priority && validatedData.priority !== existingTask.priority) {
      updateData.priority = validatedData.priority;
      await logActivity(taskId, userId, "priority_changed", existingTask.priority, validatedData.priority);
    }

    // Audit estimate change
    if (validatedData.estimate !== undefined && validatedData.estimate !== existingTask.estimate) {
      updateData.estimate = validatedData.estimate;
      await logActivity(
        taskId,
        userId,
        "estimate_changed",
        existingTask.estimate?.toString() || "No Estimate",
        validatedData.estimate?.toString() || "No Estimate"
      );
    }

    // Rest of fields
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null;
    }
    if (validatedData.customFields !== undefined) updateData.customFields = validatedData.customFields;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
    });

    // Trigger notification
    notificationService.handleTaskUpdated(taskId, userId, oldTaskInfo);

    return ok(res, "Task updated successfully", updatedTask);
  }),

  deleteTask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.id as string;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const { userId } = await verifyProjectAccess(req, task.projectId);

    // Soft delete is automated via middleware, but we invoke delete
    await prisma.task.delete({
      where: { id: taskId },
    });

    await logActivity(taskId, userId, "deleted", task.title, null);

    return ok(res, "Task deleted successfully");
  }),
};
