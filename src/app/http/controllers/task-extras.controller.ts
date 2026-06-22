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

// Validation schemas
const statusSchema = z.object({
  name: z.string().min(1, "Status name is required"),
  category: z.enum(["backlog", "todo", "in_progress", "done"]),
  order: z.number().int().optional().default(0),
});

const subtaskSchema = z.object({
  title: z.string().min(1, "Subtask title is required"),
  assigneeId: z.string().uuid().optional().nullable(),
  isCompleted: z.boolean().optional(),
});

const commentSchema = z.object({
  content: z.string().min(1, "Comment content cannot be empty"),
});

const customFieldSchema = z.object({
  name: z.string().min(1, "Field name is required"),
  type: z.enum(["text", "number", "date", "select", "checkbox"]),
  options: z.array(z.string()).optional().nullable(), // For select type
});

export const taskExtrasController = {
  // --- TASK STATUS CODES ---
  createStatus: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const validatedData = statusSchema.parse(req.body);

    const existing = await prisma.taskStatus.findFirst({
      where: { projectId, name: validatedData.name },
    });
    if (existing) {
      throw new BadRequestException("Status name already exists in this project");
    }

    const status = await prisma.taskStatus.create({
      data: {
        name: validatedData.name,
        category: validatedData.category,
        order: validatedData.order,
        projectId,
      },
    });

    return ok(res, "Status created successfully", status);
  }),

  getStatuses: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const statuses = await prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });

    return ok(res, "Statuses fetched successfully", statuses);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const statusId = req.params.id as string;

    const existingStatus = await prisma.taskStatus.findUnique({
      where: { id: statusId },
    });
    if (!existingStatus) {
      throw new NotFoundException("Status not found");
    }

    await verifyProjectAccess(req, existingStatus.projectId);

    const validatedData = statusSchema.partial().parse(req.body);

    const updated = await prisma.taskStatus.update({
      where: { id: statusId },
      data: validatedData,
    });

    return ok(res, "Status updated successfully", updated);
  }),

  deleteStatus: asyncHandler(async (req: Request, res: Response) => {
    const statusId = req.params.id as string;

    const existingStatus = await prisma.taskStatus.findUnique({
      where: { id: statusId },
    });
    if (!existingStatus) {
      throw new NotFoundException("Status not found");
    }

    await verifyProjectAccess(req, existingStatus.projectId);

    // Safety check: verify if there are active tasks mapped to this status
    const tasksCount = await prisma.task.count({
      where: { statusId, deletedAt: null },
    });
    if (tasksCount > 0) {
      throw new BadRequestException(
        "Cannot delete status: active tasks are currently mapped to this column. Reassign them first."
      );
    }

    await prisma.taskStatus.delete({
      where: { id: statusId },
    });

    return ok(res, "Status deleted successfully");
  }),

  // --- SUBTASK CHECKLIST ---
  createSubtask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException("Parent task not found");
    }

    const { userId } = await verifyProjectAccess(req, task.projectId);
    const validatedData = subtaskSchema.parse(req.body);

    const subtask = await prisma.subtask.create({
      data: {
        title: validatedData.title,
        taskId,
        assigneeId: validatedData.assigneeId || null,
        isCompleted: false,
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: "subtask_added",
        newValue: subtask.title,
      },
    });

    return ok(res, "Subtask added successfully", subtask);
  }),

  updateSubtask: asyncHandler(async (req: Request, res: Response) => {
    const subtaskId = req.params.id as string;

    const subtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      include: { task: true },
    });
    if (!subtask) {
      throw new NotFoundException("Subtask not found");
    }

    const { userId } = await verifyProjectAccess(req, subtask.task.projectId);
    const validatedData = subtaskSchema.partial().parse(req.body);

    const updated = await prisma.subtask.update({
      where: { id: subtaskId },
      data: validatedData,
    });

    // Log complete toggle check
    if (validatedData.isCompleted !== undefined && validatedData.isCompleted !== subtask.isCompleted) {
      await prisma.taskActivity.create({
        data: {
          taskId: subtask.taskId,
          userId,
          action: validatedData.isCompleted ? "subtask_completed" : "subtask_reopened",
          newValue: subtask.title,
        },
      });
    }

    return ok(res, "Subtask updated successfully", updated);
  }),

  deleteSubtask: asyncHandler(async (req: Request, res: Response) => {
    const subtaskId = req.params.id as string;

    const subtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      include: { task: true },
    });
    if (!subtask) {
      throw new NotFoundException("Subtask not found");
    }

    const { userId } = await verifyProjectAccess(req, subtask.task.projectId);

    await prisma.subtask.delete({
      where: { id: subtaskId },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: subtask.taskId,
        userId,
        action: "subtask_deleted",
        oldValue: subtask.title,
      },
    });

    return ok(res, "Subtask deleted successfully");
  }),

  // --- COMMENTS ---
  createComment: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const { userId } = await verifyProjectAccess(req, task.projectId);
    const validatedData = commentSchema.parse(req.body);

    const comment = await prisma.comment.create({
      data: {
        content: validatedData.content,
        taskId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: "comment_added",
        newValue: "Added a comment",
      },
    });

    // Trigger comment added notifications
    notificationService.handleCommentAdded(comment.id, userId);

    return ok(res, "Comment added successfully", comment);
  }),

  deleteComment: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.id as string;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { task: true },
    });
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    const { userId } = await verifyProjectAccess(req, comment.task.projectId);

    // Verify if caller is either the comment author OR holds admin/owner roles in project/workspace/org
    const isAuthor = comment.userId === userId;
    let isAdmin = false;

    if (!isAuthor) {
      const session = await auth.api.getSession({
        headers: betterAuthHeaders(req),
      });
      const activeOrgId = session?.session.activeOrganizationId;
      if (activeOrgId) {
        const callerOrgMember = await prisma.member.findFirst({
          where: {
            organizationId: activeOrgId,
            userId,
            role: { in: ["owner", "admin"] },
          },
        });
        if (callerOrgMember) isAdmin = true;

        if (!isAdmin) {
          const workspaceMember = await prisma.workspaceMember.findFirst({
            where: {
              workspaceId: comment.task.projectId, // project's workspace checking needed, let's fetch it
              userId,
              role: "admin",
            },
          });
          if (workspaceMember) isAdmin = true;
        }
      }
    }

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException("Forbidden: You can only delete your own comments");
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return ok(res, "Comment deleted successfully");
  }),

  // --- CUSTOM FIELDS ---
  createCustomField: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const validatedData = customFieldSchema.parse(req.body);

    const existing = await prisma.customFieldDefinition.findFirst({
      where: { projectId, name: validatedData.name },
    });
    if (existing) {
      throw new BadRequestException("Custom field with this name already exists in this project");
    }

    const field = await prisma.customFieldDefinition.create({
      data: {
        name: validatedData.name,
        type: validatedData.type,
        options: validatedData.options ? (validatedData.options as any) : undefined,
        projectId,
      },
    });

    return ok(res, "Custom field defined successfully", field);
  }),

  getCustomFields: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const fields = await prisma.customFieldDefinition.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    return ok(res, "Custom fields fetched successfully", fields);
  }),

  deleteCustomField: asyncHandler(async (req: Request, res: Response) => {
    const fieldId = req.params.id as string;

    const field = await prisma.customFieldDefinition.findUnique({
      where: { id: fieldId },
    });
    if (!field) {
      throw new NotFoundException("Custom field not found");
    }

    await verifyProjectAccess(req, field.projectId);

    await prisma.customFieldDefinition.delete({
      where: { id: fieldId },
    });

    return ok(res, "Custom field deleted successfully");
  }),
};
