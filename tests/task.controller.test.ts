import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockVerifyProjectAccess, prismaMock, mockNotificationService } = vi.hoisted(() => ({
  mockVerifyProjectAccess: vi.fn().mockResolvedValue({
    userId: "user-123",
    project: { organizationId: "org-123" }
  }),
  prismaMock: {
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    taskStatus: {
      findFirst: vi.fn(),
    },
    sprint: {
      findFirst: vi.fn(),
    },
    epic: {
      findFirst: vi.fn(),
    },
    milestone: {
      findFirst: vi.fn(),
    },
    taskActivity: {
      create: vi.fn(),
    },
    subtask: {
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
  mockNotificationService: {
    handleTaskCreated: vi.fn(),
    handleTaskUpdated: vi.fn(),
  },
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
}));

vi.mock("../src/lib/prisma", () => ({ default: prismaMock }));

vi.mock("../src/app/services/notification.service", () => ({
  notificationService: mockNotificationService,
}));

import { taskController } from "../src/app/http/controllers/task.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("taskController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    it("creates task successfully", async () => {
      prismaMock.taskStatus.findFirst.mockResolvedValueOnce({ id: "status-1" });
      prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: "sprint-1" });
      prismaMock.epic.findFirst.mockResolvedValueOnce({ id: "epic-1" });
      prismaMock.milestone.findFirst.mockResolvedValueOnce({ id: "milestone-1" });

      const createdTask = { id: "task-1", title: "New Task", organizationId: "org-123" };
      prismaMock.task.create.mockResolvedValueOnce(createdTask);

      const req: any = {
        params: { projectId: "p1" },
        body: {
          title: "New Task",
          statusId: "550e8400-e29b-41d4-a716-446655440001",
          sprintId: "550e8400-e29b-41d4-a716-446655440002",
          epicId: "550e8400-e29b-41d4-a716-446655440003",
          milestoneId: "550e8400-e29b-41d4-a716-446655440004",
        },
      };
      const res = createRes();

      await (taskController.createTask as any)(req, res);

      expect(prismaMock.task.create).toHaveBeenCalled();
      expect(mockNotificationService.handleTaskCreated).toHaveBeenCalledWith("task-1", "user-123");
    });
  });

  describe("getTasks", () => {
    it("fetches tasks successfully", async () => {
      prismaMock.task.findMany.mockResolvedValueOnce([{ id: "task-1" }]);

      const req: any = { params: { projectId: "p1" }, query: { search: "test" } };
      const res = createRes();

      await (taskController.getTasks as any)(req, res);

      expect(prismaMock.task.findMany).toHaveBeenCalled();
    });
  });

  describe("getTask", () => {
    it("fetches single task details", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce({ id: "task-1", projectId: "p1" });

      const req: any = { params: { id: "task-1" } };
      const res = createRes();

      await (taskController.getTask as any)(req, res);

      expect(prismaMock.task.findUnique).toHaveBeenCalled();
    });

    it("throws NotFoundException if task not found", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "task-1" } };
      const res = createRes();

      await expect((taskController.getTask as any)(req, res)).rejects.toThrow("Task not found");
    });
  });

  describe("updateTask", () => {
    it("updates task details and handles status transitions", async () => {
      const existing = {
        id: "task-1",
        projectId: "p1",
        statusId: "status-1",
        status: { name: "To Do" },
        assigneeId: null,
      };
      prismaMock.task.findUnique.mockResolvedValueOnce(existing);
      prismaMock.taskStatus.findFirst.mockResolvedValueOnce({ id: "status-done", category: "done" });
      prismaMock.subtask.count.mockResolvedValueOnce(0); // no incomplete subtasks
      prismaMock.task.update.mockResolvedValueOnce({ id: "task-1" });

      const req: any = {
        params: { id: "task-1" },
        body: { statusId: "550e8400-e29b-41d4-a716-446655440002" },
      };
      const res = createRes();

      await (taskController.updateTask as any)(req, res);

      expect(prismaMock.task.update).toHaveBeenCalled();
      expect(mockNotificationService.handleTaskUpdated).toHaveBeenCalled();
    });

    it("throws BadRequestException if Done status transition fails due to incomplete subtasks", async () => {
      const existing = {
        id: "task-1",
        projectId: "p1",
        statusId: "status-1",
        status: { name: "To Do" },
      };
      prismaMock.task.findUnique.mockResolvedValueOnce(existing);
      prismaMock.taskStatus.findFirst.mockResolvedValueOnce({ id: "status-done", category: "done" });
      prismaMock.subtask.count.mockResolvedValueOnce(5); // 5 incomplete subtasks

      const req: any = {
        params: { id: "task-1" },
        body: { statusId: "550e8400-e29b-41d4-a716-446655440002" },
      };
      const res = createRes();

      await expect((taskController.updateTask as any)(req, res)).rejects.toThrow(
        "Cannot transition to Done while there are incomplete subtasks"
      );
    });
  });

  describe("deleteTask", () => {
    it("deletes task successfully", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce({ id: "task-1", projectId: "p1", title: "Task 1" });

      const req: any = { params: { id: "task-1" } };
      const res = createRes();

      await (taskController.deleteTask as any)(req, res);

      expect(prismaMock.task.delete).toHaveBeenCalled();
    });
  });
});
