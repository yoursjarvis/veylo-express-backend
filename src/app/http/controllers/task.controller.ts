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
import { notificationService } from "@/app/services/notification.service";

async function logActivity(
  taskId: string,
  userId: string,
  organizationIdOrAction: string,
  actionOrOldValue?: string | null,
  oldValueOrNewValue?: string | null,
  newValue?: string | null
) {
  let organizationId = organizationIdOrAction;
  let action = actionOrOldValue as string;
  let oldValue = oldValueOrNewValue;
  let valNew = newValue;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(organizationId)) {
    action = organizationIdOrAction;
    oldValue = actionOrOldValue;
    valNew = oldValueOrNewValue;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { organizationId: true },
    });
    organizationId = task?.organizationId || "";
  }

  await prisma.taskActivity.create({
    data: {
      taskId,
      userId,
      organizationId,
      action,
      oldValue: oldValue ?? null,
      newValue: valNew ?? null,
    },
  });
}

const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  statusId: z.string().uuid("Invalid status ID"),
  sprintId: z.string().uuid().optional().nullable(),
  epicId: z.string().uuid().optional().nullable(),
  milestoneId: z.string().uuid().optional().nullable(),
  type: z.enum(["task", "bug", "feature"]).optional().default("task"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  estimate: z.number().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  customFields: z.record(z.string(), z.any()).optional().default({}),
  labelIds: z.array(z.string().uuid()).optional(),
});

const taskUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional().nullable(),
  statusId: z.string().uuid("Invalid status ID").optional(),
  sprintId: z.string().uuid().optional().nullable(),
  epicId: z.string().uuid().optional().nullable(),
  milestoneId: z.string().uuid().optional().nullable(),
  type: z.enum(["task", "bug", "feature"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  estimate: z.number().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  customFields: z.record(z.string(), z.any()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
});

export const taskController = {
  createTask: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { userId, project } = await verifyProjectAccess(req, projectId);
    const { organizationId } = project;

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

    // Verify epic belongs to project
    if (validatedData.epicId) {
      const epic = await prisma.epic.findFirst({
        where: { id: validatedData.epicId, projectId },
      });
      if (!epic) {
        throw new BadRequestException("Selected epic does not belong to this project");
      }
    }

    // Verify milestone belongs to project
    if (validatedData.milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: { id: validatedData.milestoneId, projectId },
      });
      if (!milestone) {
        throw new BadRequestException("Selected milestone does not belong to this project");
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        statusId: validatedData.statusId,
        projectId,
        organizationId,
        sprintId: validatedData.sprintId ?? null,
        epicId: validatedData.epicId ?? null,
        milestoneId: validatedData.milestoneId ?? null,
        type: validatedData.type,
        priority: validatedData.priority,
        estimate: validatedData.estimate,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        creatorId: userId,
        assigneeId: validatedData.assigneeId ?? null,
        customFields: validatedData.customFields,
        labels: validatedData.labelIds && validatedData.labelIds.length > 0 ? {
          create: validatedData.labelIds.map((labelId) => ({ labelId })),
        } : undefined,
      },
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, image: true, email: true },
        },
        epic: true,
        milestone: true,
        labels: {
          include: {
            label: true,
          },
        },
      },
    });

    // Log creation
    await logActivity(task.id, userId, organizationId, "created", null, task.title);

    // Trigger notification in background
    notificationService.handleTaskCreated(task.id, userId);

    return ok(res, "Task created successfully", task);
  }),

  getTasks: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const { sprintId, assigneeId, statusId, priority, type, search, epicId, milestoneId, labelId } = req.query;

    const whereClause: any = {
      projectId,
      deletedAt: null,
    };

    if (sprintId === "null") {
      whereClause.sprintId = null;
    } else if (sprintId) {
      whereClause.sprintId = sprintId as string;
    }

    if (epicId === "null") {
      whereClause.epicId = null;
    } else if (epicId) {
      whereClause.epicId = epicId as string;
    }

    if (milestoneId === "null") {
      whereClause.milestoneId = null;
    } else if (milestoneId) {
      whereClause.milestoneId = milestoneId as string;
    }

    if (labelId) {
      const labelIds = (labelId as string).split(",");
      whereClause.labels = {
        some: {
          labelId: { in: labelIds },
        },
      };
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
        epic: true,
        milestone: true,
        labels: {
          include: {
            label: true,
          },
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
        epic: true,
        milestone: true,
        labels: {
          include: {
            label: true,
          },
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
            reactions: {
              select: {
                id: true,
                emoji: true,
                userId: true,
              },
            },
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
      include: { status: true, assignee: true, sprint: true, epic: true, milestone: true },
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

    // Validate and audit epic change
    if (validatedData.epicId !== undefined && validatedData.epicId !== existingTask.epicId) {
      let epicName = "None";
      if (validatedData.epicId) {
        const epic = await prisma.epic.findFirst({
          where: { id: validatedData.epicId, projectId: existingTask.projectId },
        });
        if (!epic) {
          throw new BadRequestException("Selected epic does not belong to this project");
        }
        updateData.epicId = validatedData.epicId;
        epicName = epic.title;
      } else {
        updateData.epicId = null;
      }
      await logActivity(
        taskId,
        userId,
        "epic_changed",
        existingTask.epic?.title || "None",
        epicName
      );
    }

    // Validate and audit milestone change
    if (validatedData.milestoneId !== undefined && validatedData.milestoneId !== existingTask.milestoneId) {
      let milestoneName = "None";
      if (validatedData.milestoneId) {
        const milestone = await prisma.milestone.findFirst({
          where: { id: validatedData.milestoneId, projectId: existingTask.projectId },
        });
        if (!milestone) {
          throw new BadRequestException("Selected milestone does not belong to this project");
        }
        updateData.milestoneId = validatedData.milestoneId;
        milestoneName = milestone.title;
      } else {
        updateData.milestoneId = null;
      }
      await logActivity(
        taskId,
        userId,
        "milestone_changed",
        existingTask.milestone?.title || "None",
        milestoneName
      );
    }

    // Handle labelIds changes
    if (validatedData.labelIds !== undefined) {
      updateData.labels = {
        deleteMany: {},
        create: validatedData.labelIds.map((labelId) => ({ labelId })),
      };
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
        epic: true,
        milestone: true,
        labels: {
          include: {
            label: true,
          },
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
