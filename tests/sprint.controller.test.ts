import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockVerifyProjectAccess, prismaMock } = vi.hoisted(() => ({
  mockVerifyProjectAccess: vi.fn().mockResolvedValue({
    userId: "user-123",
    project: { organizationId: "org-123" }
  }),
  prismaMock: {
    sprint: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    taskActivity: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock, basePrisma: prismaMock }));

import { sprintController } from "../src/app/http/controllers/sprint.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("sprintController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSprint", () => {
    it("creates sprint successfully", async () => {
      const sprint = { id: "s1", name: "Sprint 1", projectId: "p1", organizationId: "org-123" };
      prismaMock.sprint.create.mockResolvedValueOnce(sprint);

      const req: any = {
        params: { projectId: "p1" },
        body: { name: "Sprint 1", goal: "Goal 1", startDate: "2026-06-25T02:00:00.000Z" }
      };
      const res = createRes();

      await (sprintController.createSprint as any)(req, res);

      expect(prismaMock.sprint.create).toHaveBeenCalledWith({
        data: {
          name: "Sprint 1",
          goal: "Goal 1",
          projectId: "p1",
          organizationId: "org-123",
          startDate: expect.any(Date),
          endDate: null,
          status: "planned",
        }
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Sprint created successfully",
        data: sprint,
      });
    });
  });

  describe("getSprints", () => {
    it("fetches sprints successfully", async () => {
      const sprints = [{ id: "s1", name: "Sprint 1" }];
      prismaMock.sprint.findMany.mockResolvedValueOnce(sprints);

      const req: any = { params: { projectId: "p1" } };
      const res = createRes();

      await (sprintController.getSprints as any)(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Sprints fetched successfully",
        data: sprints,
      });
    });
  });

  describe("getSprint", () => {
    it("fetches sprint details", async () => {
      const sprint = { id: "s1", name: "Sprint 1", projectId: "p1" };
      prismaMock.sprint.findUnique.mockResolvedValueOnce(sprint);

      const req: any = { params: { id: "s1" } };
      const res = createRes();

      await (sprintController.getSprint as any)(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Sprint details fetched successfully",
        data: sprint,
      });
    });

    it("throws NotFoundException if sprint not found", async () => {
      prismaMock.sprint.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "s1" } };
      const res = createRes();

      await expect((sprintController.getSprint as any)(req, res)).rejects.toThrow("Sprint not found");
    });
  });

  describe("updateSprint", () => {
    it("throws NotFoundException if sprint not found", async () => {
      prismaMock.sprint.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "s1" }, body: { name: "New Name" } };
      const res = createRes();

      await expect((sprintController.updateSprint as any)(req, res)).rejects.toThrow("Sprint not found");
    });

    it("updates sprint details (no status change)", async () => {
      const existing = { id: "s1", name: "Sprint 1", projectId: "p1", status: "planned" };
      prismaMock.sprint.findUnique.mockResolvedValueOnce(existing);
      const updated = { ...existing, name: "New Sprint" };
      prismaMock.sprint.update.mockResolvedValueOnce(updated);

      const req: any = { params: { id: "s1" }, body: { name: "New Sprint" } };
      const res = createRes();

      await (sprintController.updateSprint as any)(req, res);

      expect(prismaMock.sprint.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { name: "New Sprint" },
      });
    });

    it("transitions sprint to active and enforces one active sprint", async () => {
      const existing = { id: "s1", name: "Sprint 1", projectId: "p1", status: "planned" };
      prismaMock.sprint.findUnique.mockResolvedValueOnce(existing);
      // Mock that there is already an active sprint
      prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: "s-other-active" });

      const req: any = { params: { id: "s1" }, body: { status: "active" } };
      const res = createRes();

      await expect((sprintController.updateSprint as any)(req, res)).rejects.toThrow(
        "An active sprint already exists. Close it before starting a new one."
      );
    });

    it("completes sprint and moves uncompleted tasks to destination", async () => {
      const existing = { id: "s1", name: "Sprint 1", projectId: "p1", status: "active", organizationId: "org-1" };
      prismaMock.sprint.findUnique.mockResolvedValueOnce(existing);
      // mock dest sprint exists in project
      prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: "s2-dest", projectId: "p1" });
      // mock uncompleted tasks
      prismaMock.task.findMany.mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }]);
      prismaMock.task.updateMany.mockResolvedValueOnce({ count: 2 });
      prismaMock.taskActivity.createMany.mockResolvedValueOnce({ count: 2 });
      prismaMock.sprint.update.mockResolvedValueOnce({ id: "s1", status: "completed" });

      const req: any = {
        params: { id: "s1" },
        body: { status: "completed", uncompletedTasksDestination: "550e8400-e29b-41d4-a716-446655440002" }
      };
      const res = createRes();

      await (sprintController.updateSprint as any)(req, res);

      expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["t1", "t2"] } },
        data: { sprintId: "550e8400-e29b-41d4-a716-446655440002" },
      });
      expect(prismaMock.taskActivity.createMany).toHaveBeenCalled();
    });
  });

  describe("deleteSprint", () => {
    it("deletes sprint successfully", async () => {
      const sprint = { id: "s1", projectId: "p1" };
      prismaMock.sprint.findUnique.mockResolvedValueOnce(sprint);

      const req: any = { params: { id: "s1" } };
      const res = createRes();

      await (sprintController.deleteSprint as any)(req, res);

      expect(prismaMock.sprint.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Sprint deleted successfully",
        data: {},
      });
    });

    it("throws NotFoundException if sprint not found", async () => {
      prismaMock.sprint.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "s1" } };
      const res = createRes();

      await expect((sprintController.deleteSprint as any)(req, res)).rejects.toThrow("Sprint not found");
    });
  });
});
