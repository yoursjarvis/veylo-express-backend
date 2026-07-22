import { describe, expect, it, vi, beforeEach } from "vitest";
import { objectiveService } from "../../src/app/services/objective.service";

const { objectiveRepositoryMock } = vi.hoisted(() => ({
  objectiveRepositoryMock: {
    findObjectivesByWorkspace: vi.fn(),
    findProjectById: vi.fn(),
    createObjective: vi.fn(),
    findObjectiveByIdWithTrashed: vi.fn(),
    deleteObjective: vi.fn(),
    restoreObjective: vi.fn(),
    forceDeleteObjective: vi.fn(),
    updateObjective: vi.fn(),
  },
}));

vi.mock("@/app/repositories/objective.repository", () => ({
  objectiveRepository: objectiveRepositoryMock,
}));

describe("ObjectiveService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getObjectives", () => {
    it("gets objectives by workspace", async () => {
      objectiveRepositoryMock.findObjectivesByWorkspace.mockResolvedValueOnce([
        { id: "o1" },
      ]);
      const res = await objectiveService.getObjectives("ws-1");
      expect(
        objectiveRepositoryMock.findObjectivesByWorkspace,
      ).toHaveBeenCalledWith("ws-1", false);
      expect(res).toEqual([{ id: "o1" }]);
    });
  });

  describe("createObjective", () => {
    it("throws NotFoundException if project not in organization", async () => {
      objectiveRepositoryMock.findProjectById.mockResolvedValueOnce(null);
      await expect(
        objectiveService.createObjective("org-1", {
          title: "O1",
          projectId: "p1",
          krTitle: "K1",
          krTarget: "100",
        }),
      ).rejects.toThrow("Project not found in this organization");

      objectiveRepositoryMock.findProjectById.mockResolvedValueOnce({
        id: "p1",
        organizationId: "org-other",
      });
      await expect(
        objectiveService.createObjective("org-1", {
          title: "O1",
          projectId: "p1",
          krTitle: "K1",
          krTarget: "100",
        }),
      ).rejects.toThrow("Project not found in this organization");
    });

    it("creates objective successfully if project is in organization", async () => {
      objectiveRepositoryMock.findProjectById.mockResolvedValueOnce({
        id: "p1",
        organizationId: "org-1",
      });
      objectiveRepositoryMock.createObjective.mockResolvedValueOnce({
        id: "o1",
      });
      const res = await objectiveService.createObjective("org-1", {
        title: "O1",
        projectId: "p1",
        krTitle: "K1",
        krTarget: "100",
      });
      expect(objectiveRepositoryMock.createObjective).toHaveBeenCalledWith({
        title: "O1",
        projectId: "p1",
        krTitle: "K1",
        krTarget: "100",
        organizationId: "org-1",
      });
      expect(res).toEqual({ id: "o1" });
    });
  });

  describe("delete/restore/forceDelete", () => {
    it("throws NotFoundException if objective not found", async () => {
      objectiveRepositoryMock.findObjectiveByIdWithTrashed.mockResolvedValue(
        null,
      );
      await expect(objectiveService.deleteObjective("o1")).rejects.toThrow(
        "Objective not found",
      );
      await expect(objectiveService.restoreObjective("o1")).rejects.toThrow(
        "Objective not found",
      );
      await expect(objectiveService.forceDeleteObjective("o1")).rejects.toThrow(
        "Objective not found",
      );
    });

    it("performs actions if objective exists", async () => {
      objectiveRepositoryMock.findObjectiveByIdWithTrashed.mockResolvedValue({
        id: "o1",
      });

      await objectiveService.deleteObjective("o1");
      expect(objectiveRepositoryMock.deleteObjective).toHaveBeenCalledWith(
        "o1",
      );

      await objectiveService.restoreObjective("o1");
      expect(objectiveRepositoryMock.restoreObjective).toHaveBeenCalledWith(
        "o1",
      );

      await objectiveService.forceDeleteObjective("o1");
      expect(objectiveRepositoryMock.forceDeleteObjective).toHaveBeenCalledWith(
        "o1",
      );
    });
  });

  describe("updateObjective", () => {
    it("throws NotFoundException if objective not found", async () => {
      objectiveRepositoryMock.findObjectiveByIdWithTrashed.mockResolvedValueOnce(
        null,
      );
      await expect(
        objectiveService.updateObjective("o1", "org-1", { title: "New" }),
      ).rejects.toThrow("Objective not found");
    });

    it("throws NotFoundException if project not in organization during update", async () => {
      objectiveRepositoryMock.findObjectiveByIdWithTrashed.mockResolvedValueOnce(
        { id: "o1" },
      );
      objectiveRepositoryMock.findProjectById.mockResolvedValueOnce(null);
      await expect(
        objectiveService.updateObjective("o1", "org-1", { projectId: "p1" }),
      ).rejects.toThrow("Project not found in this organization");
    });

    it("updates objective successfully", async () => {
      objectiveRepositoryMock.findObjectiveByIdWithTrashed.mockResolvedValueOnce(
        { id: "o1" },
      );
      objectiveRepositoryMock.findProjectById.mockResolvedValueOnce({
        id: "p1",
        organizationId: "org-1",
      });
      objectiveRepositoryMock.updateObjective.mockResolvedValueOnce({
        id: "o1",
        title: "New",
      });

      const res = await objectiveService.updateObjective("o1", "org-1", {
        title: "New",
        projectId: "p1",
      });

      expect(objectiveRepositoryMock.updateObjective).toHaveBeenCalledWith(
        "o1",
        {
          title: "New",
          projectId: "p1",
        },
      );
      expect(res).toEqual({ id: "o1", title: "New" });
    });
  });
});
