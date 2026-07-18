import { describe, expect, it, vi, beforeEach } from "vitest";
import { taskExtrasService } from "../../src/app/services/task-extras.service";

const { taskExtrasRepositoryMock } = vi.hoisted(() => ({
  taskExtrasRepositoryMock: {
    findStatusByNameAndProjectId: vi.fn(),
    createStatus: vi.fn(),
    findStatusesByProjectId: vi.fn(),
    updateStatus: vi.fn(),
    countTasksWithStatus: vi.fn(),
    deleteStatus: vi.fn(),
    findStatusByIdWithTrashed: vi.fn(),
    restoreStatus: vi.fn(),
    forceDeleteStatus: vi.fn(),
    findTaskById: vi.fn(),
    createSubtask: vi.fn(),
    createTaskActivity: vi.fn(),
    updateSubtask: vi.fn(),
    deleteSubtask: vi.fn(),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    findCommentByIdWithTrashed: vi.fn(),
    restoreComment: vi.fn(),
    forceDeleteComment: vi.fn(),
    findCommentById: vi.fn(),
    updateComment: vi.fn(),
    findCustomFieldByName: vi.fn(),
    createCustomField: vi.fn(),
    findCustomFieldsByProjectId: vi.fn(),
    deleteCustomField: vi.fn(),
    findCustomFieldByIdWithTrashed: vi.fn(),
    restoreCustomField: vi.fn(),
    forceDeleteCustomField: vi.fn(),
    findCommentReactions: vi.fn(),
    findCommentReaction: vi.fn(),
    deleteCommentReaction: vi.fn(),
    createCommentReaction: vi.fn(),
  },
}));

const { taskRepositoryMock } = vi.hoisted(() => ({
  taskRepositoryMock: {
    incrementTaskSequence: vi.fn(),
    findProjectById: vi.fn(),
  },
}));

const { notificationServiceMock } = vi.hoisted(() => ({
  notificationServiceMock: {
    handleCommentAdded: vi.fn(),
    handleCommentReaction: vi.fn(),
  },
}));

const { rbacServiceMock } = vi.hoisted(() => ({
  rbacServiceMock: {
    authorize: vi.fn(),
  },
}));

vi.mock("@/app/repositories/task-extras.repository", () => ({
  taskExtrasRepository: taskExtrasRepositoryMock,
}));

vi.mock("@/app/repositories/task.repository", () => ({
  taskRepository: taskRepositoryMock,
}));

vi.mock("@/app/services/notification.service", () => ({
  notificationService: notificationServiceMock,
}));

vi.mock("@/app/services/rbac.service", () => ({
  rbacService: rbacServiceMock,
}));

describe("TaskExtrasService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- STATUS TESTS ---
  describe("createStatus", () => {
    it("throws BadRequestException if status name exists", async () => {
      taskExtrasRepositoryMock.findStatusByNameAndProjectId.mockResolvedValueOnce({ id: "s-existing" });
      await expect(
        taskExtrasService.createStatus("proj-1", "org-1", { name: "Todo", category: "todo", order: 0 })
      ).rejects.toThrow("Status name already exists in this project");
      expect(taskExtrasRepositoryMock.createStatus).not.toHaveBeenCalled();
    });

    it("creates status with defaults", async () => {
      taskExtrasRepositoryMock.findStatusByNameAndProjectId.mockResolvedValueOnce(null);
      taskExtrasRepositoryMock.createStatus.mockResolvedValueOnce({ id: "s-1" });

      const result = await taskExtrasService.createStatus("proj-1", "org-1", {
        name: "In Progress", category: "in_progress", order: 1,
      });
      expect(taskExtrasRepositoryMock.createStatus).toHaveBeenCalled();
      expect(result).toEqual({ id: "s-1" });
    });

    it("creates status with explicit color and progressWeight", async () => {
      taskExtrasRepositoryMock.findStatusByNameAndProjectId.mockResolvedValueOnce(null);
      taskExtrasRepositoryMock.createStatus.mockResolvedValueOnce({ id: "s-2" });

      await taskExtrasService.createStatus("proj-1", "org-1", {
        name: "Done", category: "done", order: 3, color: "#00ff00", progressWeight: 100,
      });
      expect(taskExtrasRepositoryMock.createStatus).toHaveBeenCalledWith(
        expect.objectContaining({ color: "#00ff00", progressWeight: 100 })
      );
    });
  });

  describe("getStatuses", () => {
    it("returns statuses by project", async () => {
      taskExtrasRepositoryMock.findStatusesByProjectId.mockResolvedValueOnce([{ id: "s-1" }]);
      const result = await taskExtrasService.getStatuses("proj-1");
      expect(result).toHaveLength(1);
    });
  });

  describe("updateStatus", () => {
    it("updates status", async () => {
      taskExtrasRepositoryMock.updateStatus.mockResolvedValueOnce({ id: "s-1" });
      const result = await taskExtrasService.updateStatus("s-1", { name: "New Name" });
      expect(result).toEqual({ id: "s-1" });
    });
  });

  describe("deleteStatus", () => {
    it("throws if tasks are using the status", async () => {
      taskExtrasRepositoryMock.countTasksWithStatus.mockResolvedValueOnce(5);
      await expect(taskExtrasService.deleteStatus("s-1")).rejects.toThrow("Cannot delete status");
      expect(taskExtrasRepositoryMock.deleteStatus).not.toHaveBeenCalled();
    });

    it("deletes status when no tasks use it", async () => {
      taskExtrasRepositoryMock.countTasksWithStatus.mockResolvedValueOnce(0);
      taskExtrasRepositoryMock.deleteStatus.mockResolvedValueOnce(undefined);
      await taskExtrasService.deleteStatus("s-1");
      expect(taskExtrasRepositoryMock.deleteStatus).toHaveBeenCalledWith("s-1");
    });
  });

  describe("restoreStatus / forceDeleteStatus", () => {
    it("throws NotFoundException if status not found for restore", async () => {
      taskExtrasRepositoryMock.findStatusByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(taskExtrasService.restoreStatus("s-missing")).rejects.toThrow("Status not found");
    });

    it("restores a deleted status", async () => {
      taskExtrasRepositoryMock.findStatusByIdWithTrashed.mockResolvedValueOnce({ id: "s-1" });
      taskExtrasRepositoryMock.restoreStatus.mockResolvedValueOnce({ id: "s-1" });
      const result = await taskExtrasService.restoreStatus("s-1");
      expect(result).toEqual({ id: "s-1" });
    });

    it("throws NotFoundException if status not found for force delete", async () => {
      taskExtrasRepositoryMock.findStatusByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(taskExtrasService.forceDeleteStatus("s-missing")).rejects.toThrow("Status not found");
    });

    it("force deletes a status", async () => {
      taskExtrasRepositoryMock.findStatusByIdWithTrashed.mockResolvedValueOnce({ id: "s-1" });
      taskExtrasRepositoryMock.forceDeleteStatus.mockResolvedValueOnce({ id: "s-1" });
      const result = await taskExtrasService.forceDeleteStatus("s-1");
      expect(result).toEqual({ id: "s-1" });
    });
  });

  // --- SUBTASKS ---
  describe("createSubtask", () => {
    it("throws NotFoundException if parent task not found", async () => {
      taskExtrasRepositoryMock.findTaskById.mockResolvedValueOnce(null);
      await expect(
        taskExtrasService.createSubtask("task-missing", "org-1", { title: "Sub" }, "user-1")
      ).rejects.toThrow("Parent task not found");
    });

    it("throws BadRequestException if no statuses in project", async () => {
      taskExtrasRepositoryMock.findTaskById.mockResolvedValueOnce({ id: "task-1", projectId: "proj-1" });
      taskExtrasRepositoryMock.findStatusesByProjectId.mockResolvedValueOnce([]);
      await expect(
        taskExtrasService.createSubtask("task-1", "org-1", { title: "Sub" }, "user-1")
      ).rejects.toThrow("No statuses found in project");
    });

    it("creates a subtask successfully", async () => {
      taskExtrasRepositoryMock.findTaskById.mockResolvedValueOnce({ id: "task-1", projectId: "proj-1" });
      taskExtrasRepositoryMock.findStatusesByProjectId.mockResolvedValueOnce([{ id: "status-1" }]);
      taskRepositoryMock.incrementTaskSequence.mockResolvedValueOnce({ projectKey: "PROJ", taskSequence: 5 });
      taskExtrasRepositoryMock.createSubtask.mockResolvedValueOnce({ id: "sub-1", title: "Sub" });
      taskExtrasRepositoryMock.createTaskActivity.mockResolvedValueOnce(undefined);

      const result = await taskExtrasService.createSubtask("task-1", "org-1", { title: "Sub" }, "user-1");

      expect(result).toEqual({ id: "sub-1", title: "Sub" });
      expect(taskExtrasRepositoryMock.createSubtask).toHaveBeenCalledWith(
        expect.objectContaining({ taskKey: "PROJ-5", title: "Sub" })
      );
    });
  });

  describe("updateSubtask", () => {
    const subtask = {
      id: "sub-1", taskId: "task-1", isCompleted: false,
      statusId: "status-old", title: "Sub", organizationId: "org-1",
    };

    it("updates subtask without status change (no activity logged for status)", async () => {
      taskExtrasRepositoryMock.updateSubtask.mockResolvedValueOnce({ id: "sub-1" });

      await taskExtrasService.updateSubtask(subtask, { title: "Updated" }, "user-1");

      expect(taskExtrasRepositoryMock.updateSubtask).toHaveBeenCalled();
      expect(taskExtrasRepositoryMock.createTaskActivity).not.toHaveBeenCalled();
    });

    it("logs activity when statusId changes", async () => {
      taskExtrasRepositoryMock.updateSubtask.mockResolvedValueOnce({ id: "sub-1" });
      taskExtrasRepositoryMock.createTaskActivity.mockResolvedValueOnce(undefined);

      await taskExtrasService.updateSubtask(subtask, { statusId: "status-new" }, "user-1");

      expect(taskExtrasRepositoryMock.createTaskActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "subtask_status_changed" })
      );
    });
  });

  describe("deleteSubtask", () => {
    it("deletes subtask and logs activity", async () => {
      taskExtrasRepositoryMock.deleteSubtask.mockResolvedValueOnce(undefined);
      taskExtrasRepositoryMock.createTaskActivity.mockResolvedValueOnce(undefined);

      const subtask = { id: "sub-1", taskId: "task-1", title: "Sub", organizationId: "org-1" };
      await taskExtrasService.deleteSubtask(subtask, "user-1");

      expect(taskExtrasRepositoryMock.deleteSubtask).toHaveBeenCalledWith("sub-1");
      expect(taskExtrasRepositoryMock.createTaskActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "subtask_deleted", oldValue: "Sub" })
      );
    });
  });

  // --- COMMENTS ---
  describe("createComment", () => {
    it("creates comment and triggers notification", async () => {
      taskExtrasRepositoryMock.createComment.mockResolvedValueOnce({ id: "comment-1" });
      taskExtrasRepositoryMock.createTaskActivity.mockResolvedValueOnce(undefined);
      notificationServiceMock.handleCommentAdded.mockResolvedValueOnce(undefined);

      const result = await taskExtrasService.createComment("task-1", "org-1", { content: "Hello!" }, "user-1");

      expect(result).toEqual({ id: "comment-1" });
      expect(notificationServiceMock.handleCommentAdded).toHaveBeenCalledWith("comment-1", "user-1");
    });
  });

  describe("deleteComment", () => {
    it("deletes comment when user is the author", async () => {
      taskExtrasRepositoryMock.deleteComment.mockResolvedValueOnce(undefined);
      const comment = { id: "comment-1", userId: "user-1", task: { projectId: "proj-1" } };

      await taskExtrasService.deleteComment(comment, "user-1", "org-1");

      expect(taskExtrasRepositoryMock.deleteComment).toHaveBeenCalledWith("comment-1");
      expect(rbacServiceMock.authorize).not.toHaveBeenCalled();
    });

    it("throws ForbiddenException when non-author lacks permission", async () => {
      taskRepositoryMock.findProjectById.mockResolvedValueOnce({ id: "proj-1", workspaceId: "ws-1" });
      rbacServiceMock.authorize.mockResolvedValueOnce(false);

      const comment = { id: "comment-1", userId: "user-author", task: { projectId: "proj-1" } };
      await expect(
        taskExtrasService.deleteComment(comment, "user-other", "org-1")
      ).rejects.toThrow("Forbidden: You can only delete your own comments");
    });

    it("allows deletion when non-author has permission", async () => {
      taskRepositoryMock.findProjectById.mockResolvedValueOnce({ id: "proj-1", workspaceId: "ws-1" });
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      taskExtrasRepositoryMock.deleteComment.mockResolvedValueOnce(undefined);

      const comment = { id: "comment-1", userId: "user-author", task: { projectId: "proj-1" } };
      await taskExtrasService.deleteComment(comment, "user-moderator", "org-1");

      expect(taskExtrasRepositoryMock.deleteComment).toHaveBeenCalledWith("comment-1");
    });
  });

  describe("restoreComment / forceDeleteComment", () => {
    it("throws NotFoundException if comment not found for restore", async () => {
      taskExtrasRepositoryMock.findCommentByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(taskExtrasService.restoreComment("c-missing")).rejects.toThrow("Comment not found");
    });

    it("restores a comment", async () => {
      taskExtrasRepositoryMock.findCommentByIdWithTrashed.mockResolvedValueOnce({ id: "c-1" });
      taskExtrasRepositoryMock.restoreComment.mockResolvedValueOnce({ id: "c-1" });
      const result = await taskExtrasService.restoreComment("c-1");
      expect(result).toEqual({ id: "c-1" });
    });

    it("throws NotFoundException if comment not found for force delete", async () => {
      taskExtrasRepositoryMock.findCommentByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(taskExtrasService.forceDeleteComment("c-missing")).rejects.toThrow("Comment not found");
    });

    it("force deletes a comment", async () => {
      taskExtrasRepositoryMock.findCommentByIdWithTrashed.mockResolvedValueOnce({ id: "c-1" });
      taskExtrasRepositoryMock.forceDeleteComment.mockResolvedValueOnce({ id: "c-1" });
      const result = await taskExtrasService.forceDeleteComment("c-1");
      expect(result).toEqual({ id: "c-1" });
    });
  });

  describe("updateComment", () => {
    it("throws NotFoundException if comment not found", async () => {
      taskExtrasRepositoryMock.findCommentById.mockResolvedValueOnce(null);
      await expect(
        taskExtrasService.updateComment("c-missing", { content: "Updated" }, "user-1")
      ).rejects.toThrow("Comment not found");
    });

    it("throws ForbiddenException if user is not the author", async () => {
      taskExtrasRepositoryMock.findCommentById.mockResolvedValueOnce({ id: "c-1", userId: "user-author" });
      await expect(
        taskExtrasService.updateComment("c-1", { content: "Updated" }, "user-other")
      ).rejects.toThrow("Forbidden: You can only edit your own comments");
    });

    it("updates comment when user is the author", async () => {
      taskExtrasRepositoryMock.findCommentById.mockResolvedValueOnce({ id: "c-1", userId: "user-1" });
      taskExtrasRepositoryMock.updateComment.mockResolvedValueOnce({ id: "c-1", content: "Updated" });

      const result = await taskExtrasService.updateComment("c-1", { content: "Updated" }, "user-1");
      expect(result).toEqual({ id: "c-1", content: "Updated" });
    });
  });

  // --- CUSTOM FIELDS ---
  describe("createCustomField", () => {
    it("throws BadRequestException if field name exists", async () => {
      taskExtrasRepositoryMock.findCustomFieldByName.mockResolvedValueOnce({ id: "cf-existing" });
      await expect(
        taskExtrasService.createCustomField("proj-1", "org-1", { name: "Priority", type: "text" })
      ).rejects.toThrow("Custom field with this name already exists in this project");
    });

    it("creates custom field with options", async () => {
      taskExtrasRepositoryMock.findCustomFieldByName.mockResolvedValueOnce(null);
      taskExtrasRepositoryMock.createCustomField.mockResolvedValueOnce({ id: "cf-1" });

      const result = await taskExtrasService.createCustomField("proj-1", "org-1", {
        name: "Size", type: "select", options: ["Small", "Medium", "Large"],
      });
      expect(result).toEqual({ id: "cf-1" });
    });
  });

  describe("getCustomFields", () => {
    it("returns custom fields for a project", async () => {
      taskExtrasRepositoryMock.findCustomFieldsByProjectId.mockResolvedValueOnce([{ id: "cf-1" }]);
      const result = await taskExtrasService.getCustomFields("proj-1");
      expect(result).toHaveLength(1);
    });
  });

  describe("deleteCustomField", () => {
    it("deletes a custom field", async () => {
      taskExtrasRepositoryMock.deleteCustomField.mockResolvedValueOnce(undefined);
      await taskExtrasService.deleteCustomField("cf-1");
      expect(taskExtrasRepositoryMock.deleteCustomField).toHaveBeenCalledWith("cf-1");
    });
  });

  describe("restoreCustomField / forceDeleteCustomField", () => {
    it("throws NotFoundException for restore if field not found", async () => {
      taskExtrasRepositoryMock.findCustomFieldByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(taskExtrasService.restoreCustomField("cf-missing")).rejects.toThrow("Custom field not found");
    });

    it("restores a custom field", async () => {
      taskExtrasRepositoryMock.findCustomFieldByIdWithTrashed.mockResolvedValueOnce({ id: "cf-1" });
      taskExtrasRepositoryMock.restoreCustomField.mockResolvedValueOnce({ id: "cf-1" });
      const result = await taskExtrasService.restoreCustomField("cf-1");
      expect(result).toEqual({ id: "cf-1" });
    });

    it("throws NotFoundException for force delete if field not found", async () => {
      taskExtrasRepositoryMock.findCustomFieldByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(taskExtrasService.forceDeleteCustomField("cf-missing")).rejects.toThrow("Custom field not found");
    });

    it("force deletes a custom field", async () => {
      taskExtrasRepositoryMock.findCustomFieldByIdWithTrashed.mockResolvedValueOnce({ id: "cf-1" });
      taskExtrasRepositoryMock.forceDeleteCustomField.mockResolvedValueOnce({ id: "cf-1" });
      const result = await taskExtrasService.forceDeleteCustomField("cf-1");
      expect(result).toEqual({ id: "cf-1" });
    });
  });

  // --- REACTIONS ---
  describe("getReactionUsers", () => {
    it("returns reaction users for a comment and emoji", async () => {
      taskExtrasRepositoryMock.findCommentReactions.mockResolvedValueOnce([{ id: "r-1" }]);
      const result = await taskExtrasService.getReactionUsers("comment-1", "👍");
      expect(result).toHaveLength(1);
    });
  });

  describe("toggleCommentReaction", () => {
    it("removes existing reaction (toggle off)", async () => {
      taskExtrasRepositoryMock.findCommentReaction.mockResolvedValueOnce({ id: "r-1" });
      taskExtrasRepositoryMock.deleteCommentReaction.mockResolvedValueOnce(undefined);

      const result = await taskExtrasService.toggleCommentReaction("comment-1", "👍", "user-1");
      expect(result).toEqual({ toggledOn: false });
      expect(taskExtrasRepositoryMock.deleteCommentReaction).toHaveBeenCalledWith("r-1");
    });

    it("creates new reaction (toggle on) and triggers notification", async () => {
      taskExtrasRepositoryMock.findCommentReaction.mockResolvedValueOnce(null);
      taskExtrasRepositoryMock.createCommentReaction.mockResolvedValueOnce({ id: "r-new" });
      notificationServiceMock.handleCommentReaction.mockResolvedValueOnce(undefined);

      const result = await taskExtrasService.toggleCommentReaction("comment-1", "👍", "user-1");
      expect(result).toEqual({ toggledOn: true, reaction: { id: "r-new" } });
      expect(notificationServiceMock.handleCommentReaction).toHaveBeenCalledWith("r-new");
    });
  });
});
