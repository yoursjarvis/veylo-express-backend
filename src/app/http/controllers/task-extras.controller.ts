import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";
import { notificationService } from "@/app/services/notification.service";

// Validation schemas
const statusSchema = z.object({
  name: z.string().min(1, "Status name is required"),
  category: z.enum(["backlog", "todo", "in_progress", "done"]),
  order: z.number().int().optional().default(0),
});

const statusUpdateSchema = z.object({
  name: z.string().min(1, "Status name is required").optional(),
  category: z.enum(["backlog", "todo", "in_progress", "done"]).optional(),
  order: z.number().int().optional(),
});

const subtaskSchema = z.object({
  title: z.string().min(1, "Subtask title is required"),
  assigneeId: z.string().uuid().optional().nullable(),
  isCompleted: z.boolean().optional(),
});

const commentSchema = z.object({
  content: z.string().min(1, "Comment content cannot be empty"),
  parentId: z.string().uuid().optional().nullable(),
});

const customFieldSchema = z.object({
  name: z.string().min(1, "Field name is required"),
  type: z.enum(["text", "number", "date", "select", "checkbox"]),
  options: z.array(z.string()).optional().nullable(),
});

export const taskExtrasController = {
  // --- TASK STATUS CODES ---
  createStatus: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId);
    const { organizationId } = project;

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
        organizationId,
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

    const validatedData = statusUpdateSchema.parse(req.body);

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

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException("Parent task not found");
    }

    const { userId, project } = await verifyProjectAccess(req, task.projectId);
    const { organizationId } = project;
    const validatedData = subtaskSchema.parse(req.body);

    const subtask = await prisma.subtask.create({
      data: {
        title: validatedData.title,
        taskId,
        organizationId,
        assigneeId: validatedData.assigneeId ?? null,
        isCompleted: false,
      },
    });

    await prisma.taskActivity.create({
      data: { taskId, userId, organizationId, action: "subtask_added", newValue: subtask.title },
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

    const { userId, project } = await verifyProjectAccess(req, subtask.task.projectId);
    const { organizationId } = project;
    const validatedData = subtaskSchema.partial().parse(req.body);

    const updated = await prisma.subtask.update({
      where: { id: subtaskId },
      data: validatedData,
    });

    if (validatedData.isCompleted !== undefined && validatedData.isCompleted !== subtask.isCompleted) {
      await prisma.taskActivity.create({
        data: {
          taskId: subtask.taskId,
          userId,
          organizationId,
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

    const { userId, project } = await verifyProjectAccess(req, subtask.task.projectId);
    const { organizationId } = project;

    await prisma.subtask.delete({ where: { id: subtaskId } });

    await prisma.taskActivity.create({
      data: { taskId: subtask.taskId, userId, organizationId, action: "subtask_deleted", oldValue: subtask.title },
    });

    return ok(res, "Subtask deleted successfully");
  }),

  // --- COMMENTS ---
  createComment: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const { userId, project } = await verifyProjectAccess(req, task.projectId);
    const { organizationId } = project;
    const validatedData = commentSchema.parse(req.body);

    const comment = await prisma.comment.create({
      data: {
        content: validatedData.content,
        taskId,
        userId,
        organizationId,
        parentId: validatedData.parentId ?? null,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    await prisma.taskActivity.create({
      data: { taskId, userId, organizationId, action: "comment_added", newValue: "Added a comment" },
    });

    // Trigger comment added notifications (fire-and-forget)
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

    const { userId, activeOrgId } = await verifyProjectAccess(req, comment.task.projectId);

    const isAuthor = comment.userId === userId;

    if (!isAuthor) {
      // Only org/workspace admins can delete others' comments
      const callerOrgMember = await prisma.member.findFirst({
        where: { organizationId: activeOrgId, userId, role: { in: ["owner", "admin"] } },
      });

      const callerWorkspaceMember = !callerOrgMember
        ? await prisma.workspaceMember.findFirst({
            where: {
              workspaceId: comment.task.projectId,
              userId,
              role: "admin",
            },
          })
        : null;

      if (!callerOrgMember && !callerWorkspaceMember) {
        throw new ForbiddenException("Forbidden: You can only delete your own comments");
      }
    }

    await prisma.comment.delete({ where: { id: commentId } });

    return ok(res, "Comment deleted successfully");
  }),

  updateComment: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.id as string;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { task: true },
    });
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    const { userId } = await verifyProjectAccess(req, comment.task.projectId);

    if (comment.userId !== userId) {
      throw new ForbiddenException("Forbidden: You can only edit your own comments");
    }

    const validatedData = commentSchema.parse(req.body);

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content: validatedData.content, isEdited: true },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
      },
    });

    return ok(res, "Comment updated successfully", updatedComment);
  }),

  // --- CUSTOM FIELDS ---
  createCustomField: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId);
    const { organizationId } = project;

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
        options: validatedData.options ?? undefined,
        projectId,
        organizationId,
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

    const field = await prisma.customFieldDefinition.findUnique({ where: { id: fieldId } });
    if (!field) {
      throw new NotFoundException("Custom field not found");
    }

    await verifyProjectAccess(req, field.projectId);

    await prisma.customFieldDefinition.delete({ where: { id: fieldId } });

    return ok(res, "Custom field deleted successfully");
  }),

  getReactionUsers: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const emoji = decodeURIComponent(req.params.emoji as string);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { task: true },
    });
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    await verifyProjectAccess(req, comment.task.projectId);

    const reactions = await prisma.commentReaction.findMany({
      where: { commentId, emoji },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok(res, "Users fetched successfully", reactions.map((r) => r.user));
  }),

  toggleCommentReaction: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const { emoji: rawEmoji } = z
      .object({ emoji: z.string().min(1, "Emoji is required") })
      .parse(req.body);
    const emoji = rawEmoji.trim();

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { task: true },
    });
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    const { userId } = await verifyProjectAccess(req, comment.task.projectId);

    const existing = await prisma.commentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId, emoji } },
    });

    if (existing) {
      await prisma.commentReaction.delete({ where: { id: existing.id } });
      return ok(res, "Reaction removed successfully", { toggledOn: false });
    }

    const reaction = await prisma.commentReaction.create({
      data: { commentId, userId, emoji },
    });
    return ok(res, "Reaction added successfully", { toggledOn: true, reaction });
  }),
};
