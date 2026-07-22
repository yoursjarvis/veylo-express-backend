import { describe, it, expect, vi, beforeEach } from "vitest";
import { automationService } from "@/app/services/automation.service";
import { taskService } from "@/app/services/task.service";
import { prismaMock } from "../../tests/helpers/db";

// Mock taskService functions
vi.mock("@/app/services/task.service", () => ({
  taskService: {
    updateTask: vi.fn(),
  },
}));

describe("AutomationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle handleTaskCreated", async () => {
    const task = {
      id: "task-1",
      projectId: "proj-1",
      creatorId: "user-1",
      organizationId: "org-1",
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    const rule = {
      id: "rule-1",
      name: "R1",
      trigger: "task_created",
      action: "add_comment",
      actionVal: "Auto comment",
    };
    prismaMock.automationRule.findMany.mockResolvedValueOnce([rule as unknown]);
    prismaMock.comment.create.mockResolvedValueOnce({ id: "c-1" });

    await automationService.handleTaskCreated("task-1", "user-1");

    expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
      where: { id: "task-1" },
    });
    expect(prismaMock.automationRule.findMany).toHaveBeenCalled();
    expect(prismaMock.comment.create).toHaveBeenCalled();
  });

  it("should handle handleTaskStatusChanged with trigger matches", async () => {
    const task = {
      id: "task-1",
      projectId: "proj-1",
      creatorId: "user-1",
      organizationId: "org-1",
      statusId: "status-old",
      status: { name: "Todo", category: "todo" },
      parentTaskId: "parent-1",
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    // Rule 1: status name match
    // Rule 2: category match
    // Rule 3: mismatch -> skip
    const rules = [
      {
        id: "rule-1",
        name: "R1",
        trigger: "task_status_changed",
        triggerVal: "Todo",
        action: "assign_to_creator",
      },
      {
        id: "rule-2",
        name: "R2",
        trigger: "task_status_changed",
        triggerVal: "todo",
        action: "set_priority",
        actionVal: "high",
      },
      {
        id: "rule-3",
        name: "R3",
        trigger: "task_status_changed",
        triggerVal: "Done",
        action: "assign_to_creator",
      },
    ];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules as unknown);

    // Mock parent task query inside handleSubtaskCompleted
    prismaMock.task.findUnique.mockResolvedValueOnce({
      id: "parent-1",
      projectId: "proj-1",
      subtasks: [{ status: { category: "done" } }],
    } as unknown);
    prismaMock.automationRule.findMany.mockResolvedValueOnce([]); // subtasks_all_done rules list

    await automationService.handleTaskStatusChanged(
      "task-1",
      "user-1",
      "Backlog",
      "Todo",
    );

    expect(taskService.updateTask).toHaveBeenCalledTimes(2);
  });

  it("should handle handlePriorityChanged", async () => {
    const task = { id: "task-1", projectId: "proj-1", priority: "medium" };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    const rules = [
      {
        id: "rule-1",
        name: "R1",
        trigger: "priority_changed",
        triggerVal: "high",
        action: "close_parent",
      },
    ];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules as unknown);
    prismaMock.taskStatus.findMany.mockResolvedValueOnce([
      { id: "status-done", name: "Done", category: "done" },
    ] as unknown);

    await automationService.handlePriorityChanged(
      "task-1",
      "user-1",
      "medium",
      "high",
    );
    expect(taskService.updateTask).toHaveBeenCalled();
  });

  it("should handle handleSubtaskCompleted when all are done", async () => {
    const parentTask = {
      id: "parent-1",
      projectId: "proj-1",
      subtasks: [
        { id: "sub-1", status: { category: "done" } },
        { id: "sub-2", status: { category: "done" } },
      ],
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(parentTask as unknown);

    const rules = [
      {
        id: "rule-1",
        name: "R1",
        trigger: "subtasks_all_done",
        action: "assign_to_user",
        actionVal: "user-assignee",
      },
    ];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules as unknown);

    await automationService.handleSubtaskCompleted("parent-1", "user-1");

    expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
      where: { id: "parent-1" },
      include: { subtasks: { include: { status: true } } },
    });
    expect(taskService.updateTask).toHaveBeenCalledWith("parent-1", "user-1", {
      assigneeId: "user-assignee",
    });
  });

  it("should handle handleSubtaskCompleted when some are not done", async () => {
    const parentTask = {
      id: "parent-1",
      projectId: "proj-1",
      subtasks: [
        { id: "sub-1", status: { category: "done" } },
        { id: "sub-2", status: { category: "todo" } },
      ],
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(parentTask as unknown);

    await automationService.handleSubtaskCompleted("parent-1", "user-1");

    expect(prismaMock.automationRule.findMany).not.toHaveBeenCalled();
    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it("should return early if task not found in handleTaskCreated", async () => {
    prismaMock.task.findUnique.mockResolvedValueOnce(null);

    await automationService.handleTaskCreated("task-missing", "user-1");

    expect(prismaMock.automationRule.findMany).not.toHaveBeenCalled();
  });

  it("should return early if task not found in handleTaskStatusChanged", async () => {
    prismaMock.task.findUnique.mockResolvedValueOnce(null);

    await automationService.handleTaskStatusChanged(
      "task-missing",
      "user-1",
      "Todo",
      "Done",
    );

    expect(prismaMock.automationRule.findMany).not.toHaveBeenCalled();
  });

  it("should return early if task not found in handlePriorityChanged", async () => {
    prismaMock.task.findUnique.mockResolvedValueOnce(null);

    await automationService.handlePriorityChanged(
      "task-missing",
      "user-1",
      "low",
      "high",
    );

    expect(prismaMock.automationRule.findMany).not.toHaveBeenCalled();
  });

  it("should return early if parentTask not found in handleSubtaskCompleted", async () => {
    prismaMock.task.findUnique.mockResolvedValueOnce(null);

    await automationService.handleSubtaskCompleted("parent-missing", "user-1");

    expect(prismaMock.automationRule.findMany).not.toHaveBeenCalled();
  });

  it("should skip executeAction for update_status when task status already matches", async () => {
    const task = {
      id: "task-1",
      projectId: "proj-1",
      statusId: "status-done",
      title: "T1",
      creatorId: "user-1",
      organizationId: "org-1",
      priority: "medium",
      assigneeId: null,
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    const rules = [
      {
        id: "rule-1",
        name: "R1",
        trigger: "task_created",
        action: "update_status",
        actionVal: "Done",
      },
    ];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules as unknown);
    prismaMock.taskStatus.findMany.mockResolvedValueOnce([
      { id: "status-done", name: "Done", category: "done" },
    ] as unknown);

    await automationService.handleTaskCreated("task-1", "user-1");

    // Task status already matches, should NOT call updateTask
    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it("should skip assign_to_creator if already assigned", async () => {
    const task = {
      id: "task-1",
      projectId: "proj-1",
      creatorId: "user-creator",
      assigneeId: "user-creator", // already assigned to creator
      title: "T1",
      organizationId: "org-1",
      priority: "medium",
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    const rules = [
      {
        id: "rule-1",
        name: "R1",
        trigger: "task_created",
        action: "assign_to_creator",
      },
    ];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules as unknown);

    await automationService.handleTaskCreated("task-1", "user-1");

    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it("should skip set_priority if priority already matches", async () => {
    const task = {
      id: "task-1",
      projectId: "proj-1",
      priority: "high",
      title: "T1",
      organizationId: "org-1",
      creatorId: "user-1",
      assigneeId: null,
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    const rules = [
      {
        id: "rule-1",
        name: "R1",
        trigger: "task_created",
        action: "set_priority",
        actionVal: "high",
      },
    ];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules as unknown);

    await automationService.handleTaskCreated("task-1", "user-1");

    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it("should skip handlePriorityChanged if old and new priority are the same", async () => {
    const task = { id: "task-1", projectId: "proj-1", priority: "high" };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    const rules: unknown[] = [];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules);

    await automationService.handlePriorityChanged(
      "task-1",
      "user-1",
      "high",
      "high",
    );

    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it("should execute add_comment action with default content when actionVal is missing", async () => {
    const task = {
      id: "task-1",
      projectId: "proj-1",
      creatorId: "user-1",
      organizationId: "org-1",
      priority: "medium",
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    const rules = [
      {
        id: "rule-1",
        name: "R1",
        trigger: "task_created",
        action: "add_comment",
        actionVal: null,
      },
    ];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules as unknown);
    prismaMock.comment.create.mockResolvedValueOnce({ id: "c-2" });

    await automationService.handleTaskCreated("task-1", "user-1");

    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Automated action executed.",
        }),
      }),
    );
  });

  it("should catch and log errors in handleSubtaskCompleted", async () => {
    prismaMock.task.findUnique.mockRejectedValueOnce(new Error("DB error"));

    // Should not throw - error is caught and logged
    await automationService.handleSubtaskCompleted("parent-1", "user-1");

    expect(prismaMock.automationRule.findMany).not.toHaveBeenCalled();
  });

  it("should catch and log errors in executeAction", async () => {
    const task = {
      id: "task-1",
      projectId: "proj-1",
      creatorId: "user-1",
      organizationId: "org-1",
      priority: "medium",
      title: "T1",
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    // make update_status action throw via taskStatus.findMany error
    const rules = [
      {
        id: "rule-1",
        name: "R1",
        trigger: "task_created",
        action: "update_status",
        actionVal: "Done",
      },
    ];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules as unknown);
    prismaMock.taskStatus.findMany.mockRejectedValueOnce(
      new Error("DB status error"),
    );

    // Should not throw - executeAction catches errors
    await automationService.handleTaskCreated("task-1", "user-1");

    expect(prismaMock.taskStatus.findMany).toHaveBeenCalled();
  });

  it("should use category fallback when status name doesn't match but category matches done", async () => {
    const task = {
      id: "task-1",
      projectId: "proj-1",
      statusId: "status-progress",
      title: "T1",
      creatorId: "user-1",
      organizationId: "org-1",
      priority: "medium",
      assigneeId: null,
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(task as unknown);

    const rules = [
      {
        id: "rule-1",
        name: "R1",
        trigger: "task_created",
        action: "update_status",
        actionVal: "Completed",
      },
    ];
    prismaMock.automationRule.findMany.mockResolvedValueOnce(rules as unknown);
    // No status named "Completed", but one with category "done"
    prismaMock.taskStatus.findMany.mockResolvedValueOnce([
      { id: "status-done", name: "Done", category: "done" }, // name mismatch but category matches
    ] as unknown);

    await automationService.handleTaskCreated("task-1", "user-1");

    // Should use the "done" category fallback and call updateTask
    expect(taskService.updateTask).toHaveBeenCalledWith("task-1", "user-1", {
      statusId: "status-done",
    });
  });

  it("should skip subtasks_all_done rules when parentTask has no subtasks (length=0)", async () => {
    const parentTask = {
      id: "parent-1",
      projectId: "proj-1",
      subtasks: [], // no subtasks
    };
    prismaMock.task.findUnique.mockResolvedValueOnce(parentTask as unknown);

    await automationService.handleSubtaskCompleted("parent-1", "user-1");

    // Returns early because subtasks.length === 0
    expect(prismaMock.automationRule.findMany).not.toHaveBeenCalled();
  });
});
