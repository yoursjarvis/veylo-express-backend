import { describe, it, expect, vi, beforeEach } from "vitest";
import { taskService } from "@/app/services/task.service";
import { taskRepository } from "@/app/repositories/task.repository";
import { automationService } from "@/app/services/automation.service";
import { notificationService } from "@/app/services/notification.service";
import { workflowService } from "@/app/services/workflow.service";
import { mediaService } from "@/core/media";
import { rbacService } from "@/app/services/rbac.service";

vi.mock("@/app/repositories/task.repository", () => ({
  taskRepository: {
    findTaskById: vi.fn(),
    findTaskStatusById: vi.fn(),
    findSprintById: vi.fn(),
    findEpicById: vi.fn(),
    findMilestoneById: vi.fn(),
    incrementTaskSequence: vi.fn(),
    createTask: vi.fn(),
    createTaskActivity: vi.fn(),
    getTasks: vi.fn(),
    findProjectById: vi.fn(),
    findMember: vi.fn(),
    findWorkspaceMember: vi.fn(),
    findTaskDetails: vi.fn(),
    findTaskWithRelations: vi.fn(),
    completeAllSubtasks: vi.fn(),
    findUserById: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    findTaskByIdWithTrashed: vi.fn(),
    restoreTask: vi.fn(),
    forceDeleteTask: vi.fn(),
  },
}));

vi.mock("@/app/services/automation.service", () => ({
  automationService: {
    handleTaskCreated: vi.fn().mockResolvedValue(undefined),
    handleTaskStatusChanged: vi.fn().mockResolvedValue(undefined),
    handlePriorityChanged: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/services/notification.service", () => ({
  notificationService: {
    handleTaskCreated: vi.fn().mockResolvedValue(undefined),
    handleTaskUpdated: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/services/workflow.service", () => ({
  workflowService: {
    validateTransition: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/core/media", () => ({
  mediaService: {
    getMedia: vi.fn(),
    generateUrl: vi.fn(),
  },
}));

vi.mock("@/app/services/rbac.service", () => ({
  rbacService: {
    authorize: vi.fn().mockResolvedValue(true),
  },
}));

describe("TaskService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    it("should throw BadRequestException if status, sprint, epic, or milestone do not belong to project", async () => {
      // Case 1: Status mismatch
      vi.mocked(taskRepository.findTaskStatusById).mockResolvedValueOnce(null);
      await expect(
        taskService.createTask("proj-1", "user-1", "org-1", {
          title: "T1",
          statusId: "status-1",
          type: "task",
          priority: "medium",
        }),
      ).rejects.toThrow("Selected status does not belong to this project");

      // Case 2: Sprint mismatch
      vi.mocked(taskRepository.findTaskStatusById).mockResolvedValueOnce({
        id: "status-1",
      } as unknown);
      vi.mocked(taskRepository.findSprintById).mockResolvedValueOnce(null);
      await expect(
        taskService.createTask("proj-1", "user-1", "org-1", {
          title: "T1",
          statusId: "status-1",
          type: "task",
          priority: "medium",
          sprintId: "sprint-1",
        }),
      ).rejects.toThrow("Selected sprint does not belong to this project");

      // Case 3: Epic mismatch
      vi.mocked(taskRepository.findTaskStatusById).mockResolvedValueOnce({
        id: "status-1",
      } as unknown);
      vi.mocked(taskRepository.findEpicById).mockResolvedValueOnce(null);
      await expect(
        taskService.createTask("proj-1", "user-1", "org-1", {
          title: "T1",
          statusId: "status-1",
          type: "task",
          priority: "medium",
          epicId: "epic-1",
        }),
      ).rejects.toThrow("Selected epic does not belong to this project");

      // Case 4: Milestone mismatch
      vi.mocked(taskRepository.findTaskStatusById).mockResolvedValueOnce({
        id: "status-1",
      } as unknown);
      vi.mocked(taskRepository.findMilestoneById).mockResolvedValueOnce(null);
      await expect(
        taskService.createTask("proj-1", "user-1", "org-1", {
          title: "T1",
          statusId: "status-1",
          type: "task",
          priority: "medium",
          milestoneId: "milestone-1",
        }),
      ).rejects.toThrow("Selected milestone does not belong to this project");
    });

    it("should create a task successfully", async () => {
      vi.mocked(taskRepository.findTaskStatusById).mockResolvedValueOnce({
        id: "status-1",
      } as unknown);
      vi.mocked(taskRepository.incrementTaskSequence).mockResolvedValueOnce({
        projectKey: "PROJ",
        taskSequence: 1,
      } as unknown);
      vi.mocked(taskRepository.createTask).mockResolvedValueOnce({
        id: "task-1",
        title: "Task 1",
        organizationId: "org-1",
      } as unknown);

      const result = await taskService.createTask("proj-1", "user-1", "org-1", {
        title: "Task 1",
        statusId: "status-1",
        type: "task",
        priority: "medium",
        startDate: "2026-07-18",
        dueDate: "2026-07-19",
        labelIds: ["label-1"],
      });

      expect(taskRepository.createTask).toHaveBeenCalled();
      expect(result.id).toBe("task-1");
    });
  });

  describe("getTasks", () => {
    it("should throw NotFoundException if project not found", async () => {
      vi.mocked(taskRepository.findProjectById).mockResolvedValueOnce(null);
      await expect(taskService.getTasks("proj-1", {})).rejects.toThrow(
        "Project not found",
      );
    });

    it("should fetch tasks with multiple search and filters options", async () => {
      vi.mocked(taskRepository.findProjectById).mockResolvedValueOnce({
        id: "proj-1",
        organizationId: "org-1",
        workspaceId: "ws-1",
      } as unknown);
      vi.mocked(taskRepository.findMember).mockResolvedValueOnce(null); // not admin
      vi.mocked(taskRepository.findWorkspaceMember).mockResolvedValueOnce(null);

      const query = {
        sprintId: "sprint-1",
        epicId: "null",
        milestoneId: "milestone-1",
        labelId: "label-1,label-2",
        assigneeId: "null",
        statusId: "status-1",
        priority: "high",
        type: "task",
        search: "text",
        filters: JSON.stringify([
          { field: "search", values: ["test"] },
          { field: "labelId", operator: "empty" },
          { field: "labelId", operator: "not_empty" },
          { field: "labelId", operator: "is", values: ["label-1"] },
          { field: "labelId", operator: "is_not", values: ["label-1"] },
          {
            field: "labelId",
            operator: "includes_all",
            values: ["label-1", "label-2"],
          },
          { field: "assignee", operator: "equals", values: ["user-1"] },
          {
            field: "priority",
            operator: "is_any_of",
            values: ["high", "medium"],
          },
          { field: "priority", operator: "is_not_any_of", values: ["low"] },
        ]),
      };

      await taskService.getTasks("proj-1", query, "user-1");
      expect(taskRepository.getTasks).toHaveBeenCalled();
    });

    it("should apply empty, not_empty, contains, and not_contains filter operators", async () => {
      vi.mocked(taskRepository.findProjectById).mockResolvedValueOnce({
        id: "proj-1",
        organizationId: "org-1",
        workspaceId: "ws-1",
      } as unknown);
      vi.mocked(taskRepository.findMember).mockResolvedValueOnce(null);
      vi.mocked(taskRepository.findWorkspaceMember).mockResolvedValueOnce(null);

      const query = {
        filters: JSON.stringify([
          { field: "assigneeId", operator: "empty", values: [] },
          { field: "priority", operator: "not_empty", values: [] },
          { field: "title", operator: "contains", values: ["bug"] },
          {
            field: "description",
            operator: "not_contains",
            values: ["deprecated"],
          },
          { field: "assignee", operator: "is", values: ["null"] }, // maps to assigneeId, val=null
          { field: "assignee", operator: "is_not", values: ["null"] }, // val=null branch
          { field: "noValues", operator: "is", values: [] }, // val=null, condition stays empty → skipped
          { field: "search", values: [] }, // search with empty val → skipped
          { field: "noField", operator: "is" }, // no field → continue
        ]),
      };

      await taskService.getTasks("proj-1", query, "user-1");
      expect(taskRepository.getTasks).toHaveBeenCalled();
    });

    it("should catch and suppress invalid JSON in filters", async () => {
      vi.mocked(taskRepository.findProjectById).mockResolvedValueOnce({
        id: "proj-1",
        organizationId: "org-1",
        workspaceId: "ws-1",
      } as unknown);
      vi.mocked(taskRepository.findMember).mockResolvedValueOnce(null);
      vi.mocked(taskRepository.findWorkspaceMember).mockResolvedValueOnce(null);

      const query = { filters: "not-valid-json" };

      // Should not throw - error is caught
      await taskService.getTasks("proj-1", query, "user-1");
      expect(taskRepository.getTasks).toHaveBeenCalled();
    });
  });

  describe("getTask", () => {
    it("should throw NotFoundException if task not found", async () => {
      vi.mocked(taskRepository.findTaskDetails).mockResolvedValueOnce(null);
      await expect(taskService.getTask("task-1", "user-1")).rejects.toThrow(
        "Task not found",
      );
    });

    it("should throw ForbiddenException if task is private and unauthorized", async () => {
      const task = {
        id: "task-1",
        isPrivate: true,
        projectId: "proj-1",
        organizationId: "org-1",
      };
      vi.mocked(taskRepository.findTaskDetails).mockResolvedValueOnce(
        task as unknown,
      );
      vi.mocked(taskRepository.findProjectById).mockResolvedValueOnce({
        id: "proj-1",
        workspaceId: "ws-1",
      } as unknown);
      vi.mocked(rbacService.authorize).mockResolvedValueOnce(false);

      await expect(taskService.getTask("task-1", "user-1")).rejects.toThrow(
        "Forbidden: This task is private",
      );
    });

    it("should return task details with attachments", async () => {
      const task = { id: "task-1", isPrivate: false };
      vi.mocked(taskRepository.findTaskDetails).mockResolvedValueOnce(
        task as unknown,
      );
      vi.mocked(mediaService.getMedia).mockResolvedValueOnce([
        { id: "m-1" },
      ] as unknown);
      vi.mocked(mediaService.generateUrl).mockReturnValueOnce(
        "https://url.com",
      );

      const result = await taskService.getTask("task-1");
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].url).toBe("https://url.com");
    });
  });

  describe("updateTask", () => {
    it("should throw NotFoundException if task not found during update", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        null,
      );
      await expect(
        taskService.updateTask("task-1", "user-1", {}),
      ).rejects.toThrow("Task not found");
    });

    it("should audit status, sprint, assignee, reporter, priority, estimate, epic, milestone, and private changes", async () => {
      const task = {
        id: "task-1",
        projectId: "proj-1",
        statusId: "status-1",
        status: { name: "Todo", category: "todo" },
        sprintId: "sprint-1",
        sprint: { name: "Sprint 1" },
        assigneeId: "user-2",
        assignee: { name: "Alice" },
        reporterId: "user-3",
        reporter: { name: "Bob" },
        priority: "medium",
        estimate: 5,
        epicId: "epic-1",
        epic: { title: "Epic 1" },
        milestoneId: "milestone-1",
        milestone: { title: "Milestone 1" },
        isPrivate: false,
        organizationId: "org-1",
      };
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        task as unknown,
      );
      vi.mocked(taskRepository.findTaskStatusById).mockResolvedValue({
        id: "status-done",
        name: "Done",
        category: "done",
      } as unknown);
      vi.mocked(taskRepository.findSprintById).mockResolvedValue({
        id: "sprint-2",
        name: "Sprint 2",
      } as unknown);
      vi.mocked(taskRepository.findUserById).mockResolvedValue({
        id: "user-4",
        name: "John",
      } as unknown);
      vi.mocked(taskRepository.findEpicById).mockResolvedValue({
        id: "epic-2",
        title: "Epic 2",
      } as unknown);
      vi.mocked(taskRepository.findMilestoneById).mockResolvedValue({
        id: "milestone-2",
        title: "Milestone 2",
      } as unknown);
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      const updateData = {
        statusId: "status-done",
        sprintId: "sprint-2",
        assigneeId: "user-4",
        reporterId: "user-4",
        priority: "high" as const,
        estimate: 10,
        epicId: "epic-2",
        milestoneId: "milestone-2",
        labelIds: ["label-1"],
        isPrivate: true,
      };

      await taskService.updateTask("task-1", "user-1", updateData);

      expect(taskRepository.updateTask).toHaveBeenCalled();
      expect(taskRepository.completeAllSubtasks).toHaveBeenCalledWith(
        "task-1",
        "proj-1",
      );
      expect(automationService.handleTaskStatusChanged).toHaveBeenCalled();
      expect(automationService.handlePriorityChanged).toHaveBeenCalled();
      expect(notificationService.handleTaskUpdated).toHaveBeenCalled();
    });
  });

  describe("delete, restore, forceDelete", () => {
    it("should delete, restore, and forceDelete tasks", async () => {
      const task = { id: "task-1", title: "T1", organizationId: "org-1" };
      vi.mocked(taskRepository.findTaskById).mockResolvedValueOnce(
        task as unknown,
      );
      vi.mocked(taskRepository.findTaskByIdWithTrashed).mockResolvedValue(
        task as unknown,
      );

      await taskService.deleteTask("task-1", "user-1");
      expect(taskRepository.deleteTask).toHaveBeenCalledWith("task-1");

      await taskService.restoreTask("task-1", "user-1");
      expect(taskRepository.restoreTask).toHaveBeenCalledWith("task-1");

      await taskService.forceDeleteTask("task-1", "user-1");
      expect(taskRepository.forceDeleteTask).toHaveBeenCalledWith("task-1");
    });

    it("should throw NotFoundException on delete, restore, or forceDelete if task doesn't exist", async () => {
      vi.mocked(taskRepository.findTaskById).mockResolvedValueOnce(null);
      await expect(
        taskService.deleteTask("task-missing", "user-1"),
      ).rejects.toThrow("Task not found");

      vi.mocked(taskRepository.findTaskByIdWithTrashed).mockResolvedValue(null);
      await expect(
        taskService.restoreTask("task-missing", "user-1"),
      ).rejects.toThrow("Task not found");
      await expect(
        taskService.forceDeleteTask("task-missing", "user-1"),
      ).rejects.toThrow("Task not found");
    });
  });

  describe("updateTask edge cases", () => {
    const baseTask = {
      id: "task-1",
      projectId: "proj-1",
      statusId: "status-1",
      status: { name: "Todo", category: "todo" },
      sprintId: null,
      sprint: null,
      assigneeId: null,
      assignee: null,
      reporterId: null,
      reporter: null,
      priority: "medium",
      estimate: null,
      epicId: null,
      epic: null,
      milestoneId: null,
      milestone: null,
      isPrivate: false,
      organizationId: "org-1",
      labelIds: [],
    };

    it("should throw BadRequestException if new status doesn't belong to project", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        baseTask as unknown,
      );
      vi.mocked(taskRepository.findTaskStatusById).mockResolvedValueOnce(null);

      await expect(
        taskService.updateTask("task-1", "user-1", {
          statusId: "status-invalid",
        }),
      ).rejects.toThrow("Selected status does not belong to this project");
    });

    it("should set null startDate when startDate is explicitly null", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        baseTask as unknown,
      );
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      await taskService.updateTask("task-1", "user-1", { startDate: null });

      const call = vi.mocked(taskRepository.updateTask).mock.calls[0]?.[1];
      expect(call?.startDate).toBeNull();
    });

    it("should set null dueDate when dueDate is explicitly null", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        baseTask as unknown,
      );
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      await taskService.updateTask("task-1", "user-1", { dueDate: null });

      const call = vi.mocked(taskRepository.updateTask).mock.calls[0]?.[1];
      expect(call?.dueDate).toBeNull();
    });

    it("should mark task private and log activity", async () => {
      const taskWithPrivate = { ...baseTask, isPrivate: false };
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        taskWithPrivate as unknown,
      );
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      await taskService.updateTask("task-1", "user-1", { isPrivate: true });

      expect(taskRepository.updateTask).toHaveBeenCalled();
    });

    it("should suppress automation error for status change", async () => {
      const taskWithDoneStatus = {
        ...baseTask,
        statusId: "status-1",
        status: { name: "Todo", category: "todo" },
        priority: "medium",
      };
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        taskWithDoneStatus as unknown,
      );
      vi.mocked(taskRepository.findTaskStatusById).mockResolvedValueOnce({
        id: "status-done",
        name: "Done",
        category: "done",
      } as unknown);
      vi.mocked(workflowService.validateTransition).mockResolvedValueOnce(
        undefined,
      );
      vi.mocked(taskRepository.completeAllSubtasks).mockResolvedValueOnce(
        undefined,
      );
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);
      // Make automation.handleTaskStatusChanged throw (caught internally)
      vi.mocked(
        automationService.handleTaskStatusChanged,
      ).mockRejectedValueOnce(new Error("automation error"));

      // Should not throw
      await taskService.updateTask("task-1", "user-1", {
        statusId: "status-done",
      });

      expect(taskRepository.updateTask).toHaveBeenCalled();
    });

    it("should suppress automation error for priority change", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce({
        ...baseTask,
        priority: "medium",
      } as unknown);
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);
      vi.mocked(automationService.handlePriorityChanged).mockRejectedValueOnce(
        new Error("priority error"),
      );

      // Should not throw
      await taskService.updateTask("task-1", "user-1", { priority: "high" });

      expect(taskRepository.updateTask).toHaveBeenCalled();
    });

    it("should throw BadRequestException when epic doesn't belong to project", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce({
        ...baseTask,
        epicId: null,
      } as unknown);
      vi.mocked(taskRepository.findEpicById).mockResolvedValueOnce(null);

      await expect(
        taskService.updateTask("task-1", "user-1", { epicId: "epic-invalid" }),
      ).rejects.toThrow("Selected epic does not belong to this project");
    });

    it("should throw BadRequestException when milestone doesn't belong to project", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce({
        ...baseTask,
        milestoneId: null,
      } as unknown);
      vi.mocked(taskRepository.findMilestoneById).mockResolvedValueOnce(null);

      await expect(
        taskService.updateTask("task-1", "user-1", {
          milestoneId: "milestone-invalid",
        }),
      ).rejects.toThrow("Selected milestone does not belong to this project");
    });

    it("should clear epicId and milestoneId to null", async () => {
      const taskWithEpicAndMilestone = {
        ...baseTask,
        epicId: "epic-1",
        epic: { title: "Epic 1" },
        milestoneId: "milestone-1",
        milestone: { title: "Milestone 1" },
      };
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        taskWithEpicAndMilestone as unknown,
      );
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      await taskService.updateTask("task-1", "user-1", {
        epicId: null,
        milestoneId: null,
      });

      const call = vi.mocked(taskRepository.updateTask).mock.calls[0]?.[1];
      expect(call?.epicId).toBeNull();
      expect(call?.milestoneId).toBeNull();
    });

    it("should throw BadRequestException when sprint doesn't belong to project", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce({
        ...baseTask,
        sprintId: null,
      } as unknown);
      vi.mocked(taskRepository.findSprintById).mockResolvedValueOnce(null);

      await expect(
        taskService.updateTask("task-1", "user-1", {
          sprintId: "sprint-invalid",
        }),
      ).rejects.toThrow("Selected sprint does not belong to this project");
    });

    it("should clear sprintId to null", async () => {
      const taskWithSprint = {
        ...baseTask,
        sprintId: "sprint-1",
        sprint: { name: "Sprint 1" },
      };
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        taskWithSprint as unknown,
      );
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      await taskService.updateTask("task-1", "user-1", { sprintId: null });

      const call = vi.mocked(taskRepository.updateTask).mock.calls[0]?.[1];
      expect(call?.sprintId).toBeNull();
    });

    it("should change labels (add and remove)", async () => {
      const taskWithLabel = { ...baseTask, labelIds: ["label-old"] };
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        taskWithLabel as unknown,
      );
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      await taskService.updateTask("task-1", "user-1", {
        labelIds: ["label-new"],
      });

      expect(taskRepository.updateTask).toHaveBeenCalled();
    });

    it("should log estimate change", async () => {
      const taskWithEstimate = { ...baseTask, estimate: 3 };
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce(
        taskWithEstimate as unknown,
      );
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      await taskService.updateTask("task-1", "user-1", { estimate: 5 });

      expect(taskRepository.updateTask).toHaveBeenCalled();
    });

    it("should throw BadRequestException when assignee not found", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce({
        ...baseTask,
        assigneeId: null,
      } as unknown);
      vi.mocked(taskRepository.findUserById).mockResolvedValueOnce(null);

      await expect(
        taskService.updateTask("task-1", "user-1", {
          assigneeId: "user-missing",
        }),
      ).rejects.toThrow("Assignee not found");
    });

    it("should clear assigneeId to null", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce({
        ...baseTask,
        assigneeId: "user-existing",
        assignee: { name: "Alice" },
      } as unknown);
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      await taskService.updateTask("task-1", "user-1", { assigneeId: null });

      const call = vi.mocked(taskRepository.updateTask).mock.calls[0]?.[1];
      expect(call?.assigneeId).toBeNull();
    });

    it("should throw BadRequestException when reporter not found", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce({
        ...baseTask,
        reporterId: null,
      } as unknown);
      vi.mocked(taskRepository.findUserById).mockResolvedValueOnce(null);

      await expect(
        taskService.updateTask("task-1", "user-1", {
          reporterId: "user-missing",
        }),
      ).rejects.toThrow("Reporter not found");
    });

    it("should clear reporterId to null", async () => {
      vi.mocked(taskRepository.findTaskWithRelations).mockResolvedValueOnce({
        ...baseTask,
        reporterId: "user-existing",
        reporter: { name: "Bob" },
      } as unknown);
      vi.mocked(taskRepository.updateTask).mockResolvedValueOnce({
        id: "task-1",
      } as unknown);

      await taskService.updateTask("task-1", "user-1", { reporterId: null });

      const call = vi.mocked(taskRepository.updateTask).mock.calls[0]?.[1];
      expect(call?.reporterId).toBeNull();
    });
  });
});
