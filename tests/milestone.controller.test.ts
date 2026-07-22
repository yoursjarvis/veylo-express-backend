import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockVerifyProjectAccess, prismaMock } = vi.hoisted(() => ({
  mockVerifyProjectAccess: vi.fn().mockResolvedValue({
    project: { organizationId: "org-123" },
  }),
  prismaMock: {
    milestone: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUniqueWithTrashed: vi.fn(),
      restore: vi.fn(),
      forceDelete: vi.fn(),
    },
  },
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
  basePrisma: prismaMock,
}));

import { milestoneController } from "../src/app/http/controllers/milestone.controller";

function createRes() {
  const res: unknown = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("milestoneController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMilestone", () => {
    it("creates milestone successfully", async () => {
      const milestone = {
        id: "m1",
        title: "Milestone 1",
        projectId: "p1",
        organizationId: "org-123",
      };
      prismaMock.milestone.create.mockResolvedValueOnce(milestone);

      const req: unknown = {
        params: { projectId: "p1" },
        body: {
          title: "Milestone 1",
          description: "Desc",
          dueDate: "2026-06-25T02:00:00.000Z",
        },
      };
      const res = createRes();

      await (milestoneController.createMilestone as unknown)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1", "project-milestone:create");
      expect(prismaMock.milestone.create).toHaveBeenCalledWith({
        data: {
          title: "Milestone 1",
          description: "Desc",
          projectId: "p1",
          organizationId: "org-123",
          dueDate: expect.any(Date),
          isCompleted: false,
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Milestone created successfully",
        data: milestone,
      });
    });
  });

  describe("getMilestones", () => {
    it("fetches milestones successfully", async () => {
      const milestones = [{ id: "m1", title: "Milestone 1" }];
      prismaMock.milestone.findMany.mockResolvedValueOnce(milestones);

      const req: unknown = { params: { projectId: "p1" } };
      const res = createRes();

      await (milestoneController.getMilestones as unknown)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1", "project-milestone:read");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Milestones fetched successfully",
        data: milestones,
      });
    });
  });

  describe("updateMilestone", () => {
    it("updates milestone successfully", async () => {
      const milestone = { id: "m1", projectId: "p1" };
      prismaMock.milestone.findUnique.mockResolvedValueOnce(milestone);
      const updatedMilestone = { id: "m1", title: "Updated" };
      prismaMock.milestone.update.mockResolvedValueOnce(updatedMilestone);

      const req: unknown = {
        params: { id: "m1" },
        body: { title: "Updated", isCompleted: true },
      };
      const res = createRes();

      await (milestoneController.updateMilestone as unknown)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1", "project-milestone:update");
      expect(prismaMock.milestone.update).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: { title: "Updated", isCompleted: true },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Milestone updated successfully",
        data: updatedMilestone,
      });
    });

    it("throws NotFoundException if milestone not found", async () => {
      prismaMock.milestone.findUnique.mockResolvedValueOnce(null);

      const req: unknown = { params: { id: "m1" }, body: { title: "Updated" } };
      const res = createRes();

      await expect(
        (milestoneController.updateMilestone as unknown)(req, res),
      ).rejects.toThrow("Milestone not found");
    });
  });

  describe("deleteMilestone", () => {
    it("deletes milestone successfully", async () => {
      const milestone = { id: "m1", projectId: "p1" };
      prismaMock.milestone.findUnique.mockResolvedValueOnce(milestone);

      const req: unknown = { params: { id: "m1" } };
      const res = createRes();

      await (milestoneController.deleteMilestone as unknown)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1", "project-milestone:delete");
      expect(prismaMock.milestone.delete).toHaveBeenCalledWith({
        where: { id: "m1" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Milestone deleted successfully",
        data: {},
      });
    });

    it("throws NotFoundException if milestone not found", async () => {
      prismaMock.milestone.findUnique.mockResolvedValueOnce(null);

      const req: unknown = { params: { id: "m1" } };
      const res = createRes();

      await expect(
        (milestoneController.deleteMilestone as unknown)(req, res),
      ).rejects.toThrow("Milestone not found");
    });
  });

  describe("restoreMilestone", () => {
    it("restores milestone successfully", async () => {
      const milestone = { id: "m1", projectId: "p1" };
      prismaMock.milestone.findUniqueWithTrashed.mockResolvedValue(milestone);

      const req: unknown = { params: { id: "m1" } };
      const res = createRes();

      await (milestoneController.restoreMilestone as unknown)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1", "project-milestone:restore");
      expect(prismaMock.milestone.restore).toHaveBeenCalledWith({
        where: { id: "m1" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Milestone restored successfully",
        data: {},
      });
    });

    it("throws NotFoundException if milestone not found", async () => {
      prismaMock.milestone.findUniqueWithTrashed.mockResolvedValueOnce(null);

      const req: unknown = { params: { id: "m1" } };
      const res = createRes();

      await expect(
        (milestoneController.restoreMilestone as unknown)(req, res),
      ).rejects.toThrow("Milestone not found");
    });
  });

  describe("forceDeleteMilestone", () => {
    it("force deletes milestone successfully", async () => {
      const milestone = { id: "m1", projectId: "p1" };
      prismaMock.milestone.findUniqueWithTrashed.mockResolvedValue(milestone);

      const req: unknown = { params: { id: "m1" } };
      const res = createRes();

      await (milestoneController.forceDeleteMilestone as unknown)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1", "project-milestone:force-delete");
      expect(prismaMock.milestone.forceDelete).toHaveBeenCalledWith({
        where: { id: "m1" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Milestone permanently deleted",
        data: {},
      });
    });

    it("throws NotFoundException if milestone not found", async () => {
      prismaMock.milestone.findUniqueWithTrashed.mockResolvedValueOnce(null);

      const req: unknown = { params: { id: "m1" } };
      const res = createRes();

      await expect(
        (milestoneController.forceDeleteMilestone as unknown)(req, res),
      ).rejects.toThrow("Milestone not found");
    });
  });
});
