import { taskExtrasRepository } from "@/app/repositories/task-extras.repository";
import { taskRepository } from "@/app/repositories/task.repository";
import { notificationService } from "@/app/services/notification.service";
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@/utils/app-error";
import { getDefaultStatusColorAndWeight } from "@/utils/status-defaults";

export const taskExtrasService = {
  // --- STATUS CODES ---
  async createStatus(
    projectId: string,
    organizationId: string,
    validatedData: {
      name: string;
      category: "backlog" | "todo" | "in_progress" | "done";
      order: number;
      color?: string;
      progressWeight?: number;
    },
  ) {
    const existing = await taskExtrasRepository.findStatusByNameAndProjectId(
      validatedData.name,
      projectId,
    );
    if (existing) {
      throw new BadRequestException(
        "Status name already exists in this project",
      );
    }

    const defaults = getDefaultStatusColorAndWeight(validatedData.name, validatedData.category);
    const color = validatedData.color || defaults.color;
    const progressWeight = validatedData.progressWeight !== undefined ? validatedData.progressWeight : defaults.progressWeight;

    return taskExtrasRepository.createStatus({
      name: validatedData.name,
      category: validatedData.category,
      order: validatedData.order,
      color,
      progressWeight,
      projectId,
      organizationId,
    });
  },

  async getStatuses(projectId: string) {
    return taskExtrasRepository.findStatusesByProjectId(projectId);
  },

  async updateStatus(statusId: string, validatedData: Record<string, unknown>) {
    return taskExtrasRepository.updateStatus(statusId, validatedData);
  },

  async deleteStatus(statusId: string) {
    const tasksCount =
      await taskExtrasRepository.countTasksWithStatus(statusId);
    if (tasksCount > 0) {
      throw new BadRequestException(
        "Cannot delete status: active tasks are currently mapped to this column. Reassign them first.",
      );
    }

    await taskExtrasRepository.deleteStatus(statusId);
  },

  async restoreStatus(statusId: string) {
    const status =
      await taskExtrasRepository.findStatusByIdWithTrashed(statusId);
    if (!status) {
      throw new NotFoundException("Status not found");
    }
    return taskExtrasRepository.restoreStatus(statusId);
  },

  async forceDeleteStatus(statusId: string) {
    const status =
      await taskExtrasRepository.findStatusByIdWithTrashed(statusId);
    if (!status) {
      throw new NotFoundException("Status not found");
    }
    return taskExtrasRepository.forceDeleteStatus(statusId);
  },

  // --- SUBTASKS ---
  async createSubtask(
    taskId: string,
    organizationId: string,
    validatedData: { title: string; assigneeId?: string | null },
    userId: string,
  ) {
    const parentTask = await taskExtrasRepository.findTaskById(taskId);
    if (!parentTask) {
      throw new NotFoundException("Parent task not found");
    }
    const statuses = await taskExtrasRepository.findStatusesByProjectId(
      parentTask.projectId,
    );
    const statusId = statuses.length > 0 ? statuses[0].id : undefined;
    if (!statusId) {
      throw new BadRequestException("No statuses found in project");
    }

    const projectData = await taskRepository.incrementTaskSequence(
      parentTask.projectId,
    );
    const taskKey = `${projectData.projectKey}-${projectData.taskSequence}`;

    const subtask = await taskExtrasRepository.createSubtask({
      title: validatedData.title,
      taskKey,
      parentTaskId: taskId,
      organizationId,
      projectId: parentTask.projectId,
      statusId: statusId,
      creatorId: userId,
      assigneeId: validatedData.assigneeId ?? null,
    });

    await taskExtrasRepository.createTaskActivity({
      taskId,
      userId,
      organizationId,
      action: "subtask_added",
      newValue: subtask.title,
    });

    return subtask;
  },

  async updateSubtask(
    subtask: {
      id: string;
      taskId: string;
      isCompleted: boolean;
      statusId: string;
      title: string;
      organizationId: string;
    },
    validatedData: Record<string, unknown>,
    userId: string,
  ) {
    const updated = await taskExtrasRepository.updateSubtask(
      subtask.id,
      validatedData,
    );

    if (
      validatedData.statusId !== undefined &&
      validatedData.statusId !== subtask.statusId
    ) {
      await taskExtrasRepository.createTaskActivity({
        taskId: subtask.taskId,
        userId,
        organizationId: subtask.organizationId,
        action: "subtask_status_changed",
        newValue: subtask.title,
      });
    }

    return updated;
  },

  async deleteSubtask(
    subtask: {
      id: string;
      taskId: string;
      title: string;
      organizationId: string;
    },
    userId: string,
  ) {
    await taskExtrasRepository.deleteSubtask(subtask.id);

    await taskExtrasRepository.createTaskActivity({
      taskId: subtask.taskId,
      userId,
      organizationId: subtask.organizationId,
      action: "subtask_deleted",
      oldValue: subtask.title,
    });
  },

  // --- COMMENTS ---
  async createComment(
    taskId: string,
    organizationId: string,
    validatedData: { content: string; parentId?: string | null },
    userId: string,
  ) {
    const comment = await taskExtrasRepository.createComment({
      content: validatedData.content,
      taskId,
      userId,
      organizationId,
      parentId: validatedData.parentId ?? null,
    });

    await taskExtrasRepository.createTaskActivity({
      taskId,
      userId,
      organizationId,
      action: "comment_added",
      newValue: "Added a comment",
    });

    // Trigger comment added notifications (fire-and-forget)
    notificationService.handleCommentAdded(comment.id, userId);

    return comment;
  },

  async deleteComment(
    comment: { id: string; userId: string; task: { projectId: string } },
    userId: string,
    activeOrgId: string,
  ) {
    const isAuthor = comment.userId === userId;

    if (!isAuthor) {
      const { rbacService } = await import("@/app/services/rbac.service");
      const { taskRepository } =
        await import("@/app/repositories/task.repository");

      const project = await taskRepository.findProjectById(
        comment.task.projectId,
      );
      const isAllowed = await rbacService.authorize(userId, "task:update", {
        organizationId: activeOrgId,
        workspaceId: project?.workspaceId,
        projectId: comment.task.projectId,
        taskId: comment.id,
      });

      if (!isAllowed) {
        throw new ForbiddenException(
          "Forbidden: You can only delete your own comments",
        );
      }
    }

    await taskExtrasRepository.deleteComment(comment.id);
  },

  async restoreComment(commentId: string) {
    const comment =
      await taskExtrasRepository.findCommentByIdWithTrashed(commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }
    return taskExtrasRepository.restoreComment(commentId);
  },

  async forceDeleteComment(commentId: string) {
    const comment =
      await taskExtrasRepository.findCommentByIdWithTrashed(commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }
    return taskExtrasRepository.forceDeleteComment(commentId);
  },

  async updateComment(
    commentId: string,
    validatedData: { content: string },
    userId: string,
  ) {
    const comment = await taskExtrasRepository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException(
        "Forbidden: You can only edit your own comments",
      );
    }

    return taskExtrasRepository.updateComment(commentId, validatedData.content);
  },

  // --- CUSTOM FIELDS ---
  async createCustomField(
    projectId: string,
    organizationId: string,
    validatedData: {
      name: string;
      type: "text" | "number" | "date" | "select" | "checkbox";
      options?: string[] | null;
    },
  ) {
    const existing = await taskExtrasRepository.findCustomFieldByName(
      validatedData.name,
      projectId,
    );
    if (existing) {
      throw new BadRequestException(
        "Custom field with this name already exists in this project",
      );
    }

    return taskExtrasRepository.createCustomField({
      name: validatedData.name,
      type: validatedData.type,
      options: validatedData.options ?? undefined,
      projectId,
      organizationId,
    });
  },

  async getCustomFields(projectId: string) {
    return taskExtrasRepository.findCustomFieldsByProjectId(projectId);
  },

  async deleteCustomField(fieldId: string) {
    await taskExtrasRepository.deleteCustomField(fieldId);
  },

  async restoreCustomField(fieldId: string) {
    const field =
      await taskExtrasRepository.findCustomFieldByIdWithTrashed(fieldId);
    if (!field) {
      throw new NotFoundException("Custom field not found");
    }
    return taskExtrasRepository.restoreCustomField(fieldId);
  },

  async forceDeleteCustomField(fieldId: string) {
    const field =
      await taskExtrasRepository.findCustomFieldByIdWithTrashed(fieldId);
    if (!field) {
      throw new NotFoundException("Custom field not found");
    }
    return taskExtrasRepository.forceDeleteCustomField(fieldId);
  },

  // --- REACTION USERS & TOGGLING ---
  async getReactionUsers(commentId: string, emoji: string) {
    return taskExtrasRepository.findCommentReactions(commentId, emoji);
  },

  async toggleCommentReaction(
    commentId: string,
    emoji: string,
    userId: string,
  ) {
    const existing = await taskExtrasRepository.findCommentReaction(
      commentId,
      userId,
      emoji,
    );

    if (existing) {
      await taskExtrasRepository.deleteCommentReaction(existing.id);
      return { toggledOn: false };
    }

    const reaction = await taskExtrasRepository.createCommentReaction(
      commentId,
      userId,
      emoji,
    );

    // Trigger notification (fire-and-forget)
    notificationService.handleCommentReaction(reaction.id);

    return { toggledOn: true, reaction };
  },
};
