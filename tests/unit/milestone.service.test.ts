import { describe, expect, it, vi, beforeEach } from "vitest";
import { milestoneService } from "../../src/app/services/milestone.service";

const { milestoneRepositoryMock } = vi.hoisted(() => ({
  milestoneRepositoryMock: {
    create: vi.fn(),
    findByProjectId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByIdWithTrashed: vi.fn(),
    restore: vi.fn(),
    forceDelete: vi.fn(),
  },
}));

vi.mock("@/app/repositories/milestone.repository", () => ({
  milestoneRepository: milestoneRepositoryMock,
}));

describe("MilestoneService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMilestone", () => {
    it("creates a milestone with dueDate", async () => {
      milestoneRepositoryMock.create.mockResolvedValueOnce({
        id: "m1",
        title: "v1.0",
      });

      const result = await milestoneService.createMilestone("proj-1", "org-1", {
        title: "v1.0",
        description: "First release",
        dueDate: "2026-09-01",
      });

      expect(milestoneRepositoryMock.create).toHaveBeenCalledWith({
        title: "v1.0",
        description: "First release",
        projectId: "proj-1",
        organizationId: "org-1",
        dueDate: new Date("2026-09-01"),
        isCompleted: false,
      });
      expect(result).toEqual({ id: "m1", title: "v1.0" });
    });

    it("creates a milestone without dueDate (sets null)", async () => {
      milestoneRepositoryMock.create.mockResolvedValueOnce({ id: "m2" });

      await milestoneService.createMilestone("proj-1", "org-1", {
        title: "v2.0",
      });

      expect(milestoneRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: null }),
      );
    });
  });

  describe("getMilestones", () => {
    it("returns milestones for a project", async () => {
      milestoneRepositoryMock.findByProjectId.mockResolvedValueOnce([
        { id: "m1" },
        { id: "m2" },
      ]);

      const result = await milestoneService.getMilestones("proj-1");
      expect(milestoneRepositoryMock.findByProjectId).toHaveBeenCalledWith(
        "proj-1",
      );
      expect(result).toHaveLength(2);
    });
  });

  describe("updateMilestone", () => {
    it("updates with all fields including setting dueDate", async () => {
      milestoneRepositoryMock.update.mockResolvedValueOnce({ id: "m1" });

      await milestoneService.updateMilestone("m1", {
        title: "v1.1",
        description: "Updated",
        isCompleted: true,
        dueDate: "2026-10-01",
      });

      expect(milestoneRepositoryMock.update).toHaveBeenCalledWith("m1", {
        title: "v1.1",
        description: "Updated",
        isCompleted: true,
        dueDate: new Date("2026-10-01"),
      });
    });

    it("clears dueDate to null when set to null", async () => {
      milestoneRepositoryMock.update.mockResolvedValueOnce({ id: "m1" });

      await milestoneService.updateMilestone("m1", { dueDate: null });

      expect(milestoneRepositoryMock.update).toHaveBeenCalledWith("m1", {
        dueDate: null,
      });
    });

    it("updates only the fields provided (no undefined fields in update data)", async () => {
      milestoneRepositoryMock.update.mockResolvedValueOnce({ id: "m1" });

      await milestoneService.updateMilestone("m1", { title: "v1.2" });

      // Only title should be in the update data object
      expect(milestoneRepositoryMock.update).toHaveBeenCalledWith("m1", {
        title: "v1.2",
      });
    });
  });

  describe("deleteMilestone", () => {
    it("soft deletes a milestone", async () => {
      milestoneRepositoryMock.delete.mockResolvedValueOnce(undefined);

      await milestoneService.deleteMilestone("m1");
      expect(milestoneRepositoryMock.delete).toHaveBeenCalledWith("m1");
    });
  });

  describe("restoreMilestone", () => {
    it("throws NotFoundException if milestone not found", async () => {
      milestoneRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce(null);

      await expect(
        milestoneService.restoreMilestone("m-missing"),
      ).rejects.toThrow("Milestone not found");
      expect(milestoneRepositoryMock.restore).not.toHaveBeenCalled();
    });

    it("restores a soft-deleted milestone", async () => {
      milestoneRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce({
        id: "m1",
      });
      milestoneRepositoryMock.restore.mockResolvedValueOnce({ id: "m1" });

      const result = await milestoneService.restoreMilestone("m1");
      expect(milestoneRepositoryMock.restore).toHaveBeenCalledWith("m1");
      expect(result).toEqual({ id: "m1" });
    });
  });

  describe("forceDeleteMilestone", () => {
    it("throws NotFoundException if milestone not found", async () => {
      milestoneRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce(null);

      await expect(
        milestoneService.forceDeleteMilestone("m-missing"),
      ).rejects.toThrow("Milestone not found");
      expect(milestoneRepositoryMock.forceDelete).not.toHaveBeenCalled();
    });

    it("permanently deletes a milestone", async () => {
      milestoneRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce({
        id: "m1",
      });
      milestoneRepositoryMock.forceDelete.mockResolvedValueOnce({ id: "m1" });

      const result = await milestoneService.forceDeleteMilestone("m1");
      expect(milestoneRepositoryMock.forceDelete).toHaveBeenCalledWith("m1");
      expect(result).toEqual({ id: "m1" });
    });
  });
});
