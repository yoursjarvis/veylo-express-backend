import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import { taskExtrasRepository } from "@/app/repositories/task-extras.repository";
import { taskExtrasService } from "@/app/services/task-extras.service";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { NotFoundException } from "@/utils/app-error";
import {
  statusSchema,
  statusUpdateSchema,
  subtaskSchema,
  commentSchema,
  customFieldSchema,
  commentReactionSchema,
} from "@/app/http/validators/task-extras.validator";

export const taskExtrasController = {
  // --- TASK STATUS CODES ---
  createStatus: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId);
    const { organizationId } = project;

    const validatedData = statusSchema.parse(req.body);

    const status = await taskExtrasService.createStatus(projectId, organizationId, validatedData);

    return ok(res, "Status created successfully", status);
  }),

  getStatuses: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const statuses = await taskExtrasService.getStatuses(projectId);

    return ok(res, "Statuses fetched successfully", statuses);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const statusId = req.params.id as string;

    const existingStatus = await taskExtrasRepository.findStatusById(statusId);
    if (!existingStatus) {
      throw new NotFoundException("Status not found");
    }

    await verifyProjectAccess(req, existingStatus.projectId);

    const validatedData = statusUpdateSchema.parse(req.body);

    const updated = await taskExtrasService.updateStatus(statusId, validatedData);

    return ok(res, "Status updated successfully", updated);
  }),

  deleteStatus: asyncHandler(async (req: Request, res: Response) => {
    const statusId = req.params.id as string;

    const existingStatus = await taskExtrasRepository.findStatusById(statusId);
    if (!existingStatus) {
      throw new NotFoundException("Status not found");
    }

    await verifyProjectAccess(req, existingStatus.projectId);

    await taskExtrasService.deleteStatus(statusId);

    return ok(res, "Status deleted successfully");
  }),

  // --- SUBTASK CHECKLIST ---
  createSubtask: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const task = await taskExtrasRepository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException("Parent task not found");
    }

    const { userId, project } = await verifyProjectAccess(req, task.projectId);
    const { organizationId } = project;
    const validatedData = subtaskSchema.parse(req.body);

    const subtask = await taskExtrasService.createSubtask(taskId, organizationId, validatedData, userId);

    return ok(res, "Subtask added successfully", subtask);
  }),

  updateSubtask: asyncHandler(async (req: Request, res: Response) => {
    const subtaskId = req.params.id as string;

    const subtask = await taskExtrasRepository.findSubtaskById(subtaskId);
    if (!subtask) {
      throw new NotFoundException("Subtask not found");
    }

    const { userId } = await verifyProjectAccess(req, subtask.task.projectId);
    const validatedData = subtaskSchema.partial().parse(req.body);

    const updated = await taskExtrasService.updateSubtask(subtask, validatedData, userId);

    return ok(res, "Subtask updated successfully", updated);
  }),

  deleteSubtask: asyncHandler(async (req: Request, res: Response) => {
    const subtaskId = req.params.id as string;

    const subtask = await taskExtrasRepository.findSubtaskById(subtaskId);
    if (!subtask) {
      throw new NotFoundException("Subtask not found");
    }

    const { userId } = await verifyProjectAccess(req, subtask.task.projectId);

    await taskExtrasService.deleteSubtask(subtask, userId);

    return ok(res, "Subtask deleted successfully");
  }),

  // --- COMMENTS ---
  createComment: asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const task = await taskExtrasRepository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const { userId, project } = await verifyProjectAccess(req, task.projectId);
    const { organizationId } = project;
    const validatedData = commentSchema.parse(req.body);

    const comment = await taskExtrasService.createComment(taskId, organizationId, validatedData, userId);

    return ok(res, "Comment added successfully", comment);
  }),

  deleteComment: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.id as string;

    const comment = await taskExtrasRepository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    const { userId, activeOrgId } = await verifyProjectAccess(req, comment.task.projectId);

    await taskExtrasService.deleteComment(comment, userId, activeOrgId);

    return ok(res, "Comment deleted successfully");
  }),

  updateComment: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.id as string;

    const comment = await taskExtrasRepository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    const { userId } = await verifyProjectAccess(req, comment.task.projectId);
    const validatedData = commentSchema.parse(req.body);

    const updatedComment = await taskExtrasService.updateComment(commentId, validatedData, userId);

    return ok(res, "Comment updated successfully", updatedComment);
  }),

  // --- CUSTOM FIELDS ---
  createCustomField: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId);
    const { organizationId } = project;

    const validatedData = customFieldSchema.parse(req.body);

    const field = await taskExtrasService.createCustomField(projectId, organizationId, validatedData);

    return ok(res, "Custom field defined successfully", field);
  }),

  getCustomFields: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const fields = await taskExtrasService.getCustomFields(projectId);

    return ok(res, "Custom fields fetched successfully", fields);
  }),

  deleteCustomField: asyncHandler(async (req: Request, res: Response) => {
    const fieldId = req.params.id as string;

    const field = await taskExtrasRepository.findCustomFieldById(fieldId);
    if (!field) {
      throw new NotFoundException("Custom field not found");
    }

    await verifyProjectAccess(req, field.projectId);

    await taskExtrasService.deleteCustomField(fieldId);

    return ok(res, "Custom field deleted successfully");
  }),

  getReactionUsers: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const emoji = decodeURIComponent(req.params.emoji as string);

    const comment = await taskExtrasRepository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    await verifyProjectAccess(req, comment.task.projectId);

    const users = await taskExtrasService.getReactionUsers(commentId, emoji);

    return ok(res, "Users fetched successfully", users.map((r) => r.user));
  }),

  toggleCommentReaction: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const { emoji: rawEmoji } = commentReactionSchema.parse(req.body);
    const emoji = rawEmoji.trim();

    const comment = await taskExtrasRepository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    const { userId } = await verifyProjectAccess(req, comment.task.projectId);

    const result = await taskExtrasService.toggleCommentReaction(commentId, emoji, userId);

    return ok(res, result.toggledOn ? "Reaction added successfully" : "Reaction removed successfully", result);
  }),
};
