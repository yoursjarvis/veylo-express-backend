import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockVerifyProjectAccess, prismaMock } = vi.hoisted(() => ({
  mockVerifyProjectAccess: vi.fn().mockResolvedValue({ userId: "user-123" }),
  prismaMock: {
    task: {
      findUnique: vi.fn(),
    },
    taskDependency: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    taskActivity: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
}));

vi.mock("../src/lib/prisma", () => ({ default: prismaMock }));

import { dependencyController } from "../src/app/http/controllers/dependency.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("dependencyController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDependencies", () => {
    it("returns dependencies successfully", async () => {
      const mockTask = { id: "t1", projectId: "proj-1" };
      prismaMock.task.findUnique.mockResolvedValueOnce(mockTask);
      prismaMock.taskDependency.findMany
        .mockResolvedValueOnce([{ id: "d1", blockingTaskId: "t2", blockedTaskId: "t1", blockingTask: { id: "t2" } }])
        .mockResolvedValueOnce([{ id: "d2", blockingTaskId: "t1", blockedTaskId: "t3", blockedTask: { id: "t3" } }]);

      const req: any = { params: { taskId: "t1" } };
      const res = createRes();

      await (dependencyController.getDependencies as any)(req, res);

      expect(prismaMock.task.findUnique).toHaveBeenCalledWith({ where: { id: "t1" } });
      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "proj-1");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Task dependencies fetched successfully",
        data: {
          blockedBy: [{ dependencyId: "d1", task: { id: "t2" } }],
          blocking: [{ dependencyId: "d2", task: { id: "t3" } }],
        },
      });
    });

    it("throws NotFoundException if task not found", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { taskId: "t1" } };
      const res = createRes();

      await expect((dependencyController.getDependencies as any)(req, res)).rejects.toThrow("Task not found");
    });
  });

  describe("createDependency", () => {
    it("throws BadRequestException if depending on self", async () => {
      const req: any = {
        params: { taskId: "550e8400-e29b-41d4-a716-446655440000" },
        body: { dependencyTaskId: "550e8400-e29b-41d4-a716-446655440000", direction: "blocks" },
      };
      const res = createRes();

      await expect((dependencyController.createDependency as any)(req, res)).rejects.toThrow("A task cannot depend on itself");
    });

    it("throws NotFoundException if tasks not found", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce(null);
      const req: any = {
        params: { taskId: "550e8400-e29b-41d4-a716-446655440000" },
        body: { dependencyTaskId: "550e8400-e29b-41d4-a716-446655440001", direction: "blocks" },
      };
      const res = createRes();

      await expect((dependencyController.createDependency as any)(req, res)).rejects.toThrow("One or both tasks not found");
    });

    it("creates blocks dependency and logs activity", async () => {
      const mockTask = { id: "t1", projectId: "proj-1", organizationId: "org-1" };
      const mockDepTask = { id: "t2", projectId: "proj-1", title: "Dep Task" };
      prismaMock.task.findUnique
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockDepTask);
      prismaMock.taskDependency.findFirst.mockResolvedValue(null);
      prismaMock.taskDependency.create.mockResolvedValueOnce({ id: "d1" });

      const req: any = {
        params: { taskId: "t1" },
        body: { dependencyTaskId: "550e8400-e29b-41d4-a716-446655440001", direction: "blocks" },
      };
      const res = createRes();

      await (dependencyController.createDependency as any)(req, res);

      expect(prismaMock.taskDependency.create).toHaveBeenCalledWith({
        data: { blockingTaskId: "t1", blockedTaskId: "t2", dependencyType: "blocks" },
      });
      expect(prismaMock.taskActivity.create).toHaveBeenCalled();
    });

    it("throws circular dependency error if circular dependency is detected", async () => {
      const mockTask = { id: "t1", projectId: "proj-1", organizationId: "org-1" };
      const mockDepTask = { id: "t2", projectId: "proj-1", title: "Dep Task" };
      prismaMock.task.findUnique
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockDepTask);
      prismaMock.taskDependency.findFirst.mockResolvedValueOnce({ id: "d-circ" });

      const req: any = {
        params: { taskId: "t1" },
        body: { dependencyTaskId: "550e8400-e29b-41d4-a716-446655440001", direction: "blocks" },
      };
      const res = createRes();

      await expect((dependencyController.createDependency as any)(req, res)).rejects.toThrow("Circular dependency detected!");
    });

    it("throws duplicate dependency error if duplicate is detected", async () => {
      const mockTask = { id: "t1", projectId: "proj-1", organizationId: "org-1" };
      const mockDepTask = { id: "t2", projectId: "proj-1", title: "Dep Task" };
      prismaMock.task.findUnique
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockDepTask);
      prismaMock.taskDependency.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "d-existing" });

      const req: any = {
        params: { taskId: "t1" },
        body: { dependencyTaskId: "550e8400-e29b-41d4-a716-446655440001", direction: "blocks" },
      };
      const res = createRes();

      await expect((dependencyController.createDependency as any)(req, res)).rejects.toThrow("This dependency already exists");
    });
  });

  describe("deleteDependency", () => {
    it("deletes dependency successfully", async () => {
      const mockDependency = {
        id: "d1",
        blockingTaskId: "t1",
        blockingTask: { projectId: "proj-1", organizationId: "org-1" },
        blockedTask: { projectId: "proj-1", title: "Blocked Task" },
      };
      prismaMock.taskDependency.findUnique.mockResolvedValueOnce(mockDependency);

      const req: any = { params: { id: "d1" } };
      const res = createRes();

      await (dependencyController.deleteDependency as any)(req, res);

      expect(prismaMock.taskDependency.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
      expect(prismaMock.taskActivity.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Task dependency deleted successfully",
        data: {},
      });
    });

    it("throws NotFoundException if dependency not found", async () => {
      prismaMock.taskDependency.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "d1" } };
      const res = createRes();

      await expect((dependencyController.deleteDependency as any)(req, res)).rejects.toThrow("Dependency not found");
    });
  });
});
