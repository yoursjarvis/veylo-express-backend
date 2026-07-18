import { describe, expect, it, vi, beforeEach } from "vitest";
import { labelService } from "../../src/app/services/label.service";

const { labelRepositoryMock } = vi.hoisted(() => ({
  labelRepositoryMock: {
    findByNameAndProjectId: vi.fn(),
    create: vi.fn(),
    findByProjectId: vi.fn(),
    findDuplicateName: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByIdWithTrashed: vi.fn(),
    restore: vi.fn(),
    forceDelete: vi.fn(),
  },
}));

vi.mock("@/app/repositories/label.repository", () => ({
  labelRepository: labelRepositoryMock,
}));

describe("LabelService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLabel", () => {
    it("creates a label successfully", async () => {
      labelRepositoryMock.findByNameAndProjectId.mockResolvedValueOnce(null);
      labelRepositoryMock.create.mockResolvedValueOnce({ id: "l1", name: "Bug", color: "#ff0000" });

      const result = await labelService.createLabel("proj-1", "org-1", { name: "Bug", color: "#ff0000" });

      expect(labelRepositoryMock.findByNameAndProjectId).toHaveBeenCalledWith("Bug", "proj-1");
      expect(labelRepositoryMock.create).toHaveBeenCalledWith({
        name: "Bug",
        color: "#ff0000",
        projectId: "proj-1",
        organizationId: "org-1",
      });
      expect(result).toEqual({ id: "l1", name: "Bug", color: "#ff0000" });
    });

    it("throws BadRequestException if label name already exists", async () => {
      labelRepositoryMock.findByNameAndProjectId.mockResolvedValueOnce({ id: "l-existing" });

      await expect(
        labelService.createLabel("proj-1", "org-1", { name: "Bug", color: "#ff0000" })
      ).rejects.toThrow("Label with this name already exists in the project");

      expect(labelRepositoryMock.create).not.toHaveBeenCalled();
    });
  });

  describe("getLabels", () => {
    it("returns labels for a project", async () => {
      labelRepositoryMock.findByProjectId.mockResolvedValueOnce([{ id: "l1" }, { id: "l2" }]);

      const result = await labelService.getLabels("proj-1");
      expect(labelRepositoryMock.findByProjectId).toHaveBeenCalledWith("proj-1");
      expect(result).toHaveLength(2);
    });
  });

  describe("updateLabel", () => {
    it("updates a label when no duplicate name exists", async () => {
      labelRepositoryMock.findDuplicateName.mockResolvedValueOnce(null);
      labelRepositoryMock.update.mockResolvedValueOnce({ id: "l1", name: "Feature" });

      const result = await labelService.updateLabel(
        { id: "l1", projectId: "proj-1" },
        { name: "Feature", color: "#00ff00" }
      );

      expect(labelRepositoryMock.findDuplicateName).toHaveBeenCalledWith("proj-1", "Feature", "l1");
      expect(labelRepositoryMock.update).toHaveBeenCalledWith("l1", { name: "Feature", color: "#00ff00" });
      expect(result).toEqual({ id: "l1", name: "Feature" });
    });

    it("throws BadRequestException if duplicate name exists when updating", async () => {
      labelRepositoryMock.findDuplicateName.mockResolvedValueOnce({ id: "l-other" });

      await expect(
        labelService.updateLabel({ id: "l1", projectId: "proj-1" }, { name: "Bug" })
      ).rejects.toThrow("Label with this name already exists in the project");

      expect(labelRepositoryMock.update).not.toHaveBeenCalled();
    });

    it("updates label with only color (no name check performed)", async () => {
      labelRepositoryMock.update.mockResolvedValueOnce({ id: "l1", color: "#0000ff" });

      await labelService.updateLabel({ id: "l1", projectId: "proj-1" }, { color: "#0000ff" });

      expect(labelRepositoryMock.findDuplicateName).not.toHaveBeenCalled();
      expect(labelRepositoryMock.update).toHaveBeenCalledWith("l1", { color: "#0000ff" });
    });
  });

  describe("deleteLabel", () => {
    it("deletes a label", async () => {
      labelRepositoryMock.delete.mockResolvedValueOnce(undefined);

      await labelService.deleteLabel("l1");
      expect(labelRepositoryMock.delete).toHaveBeenCalledWith("l1");
    });
  });

  describe("restoreLabel", () => {
    it("throws NotFoundException if label not found during restore", async () => {
      labelRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce(null);

      await expect(labelService.restoreLabel("l-missing")).rejects.toThrow("Label not found");
      expect(labelRepositoryMock.restore).not.toHaveBeenCalled();
    });

    it("restores a soft-deleted label", async () => {
      labelRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce({ id: "l1" });
      labelRepositoryMock.restore.mockResolvedValueOnce({ id: "l1" });

      const result = await labelService.restoreLabel("l1");
      expect(labelRepositoryMock.restore).toHaveBeenCalledWith("l1");
      expect(result).toEqual({ id: "l1" });
    });
  });

  describe("forceDeleteLabel", () => {
    it("throws NotFoundException if label not found during force delete", async () => {
      labelRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce(null);

      await expect(labelService.forceDeleteLabel("l-missing")).rejects.toThrow("Label not found");
      expect(labelRepositoryMock.forceDelete).not.toHaveBeenCalled();
    });

    it("force deletes a label", async () => {
      labelRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce({ id: "l1" });
      labelRepositoryMock.forceDelete.mockResolvedValueOnce({ id: "l1" });

      const result = await labelService.forceDeleteLabel("l1");
      expect(labelRepositoryMock.forceDelete).toHaveBeenCalledWith("l1");
      expect(result).toEqual({ id: "l1" });
    });
  });
});
