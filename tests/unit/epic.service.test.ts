import { describe, expect, it, vi, beforeEach } from "vitest";
import { epicService } from "../../src/app/services/epic.service";

const { epicRepositoryMock } = vi.hoisted(() => ({
  epicRepositoryMock: {
    create: vi.fn(),
    findByProjectId: vi.fn(),
    findByIdWithTasks: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByIdWithTrashed: vi.fn(),
    restore: vi.fn(),
    forceDelete: vi.fn(),
  },
}));

vi.mock("@/app/repositories/epic.repository", () => ({
  epicRepository: epicRepositoryMock,
}));

describe("EpicService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEpic", () => {
    it("creates an epic with correct defaults", async () => {
      epicRepositoryMock.create.mockResolvedValueOnce({ id: "e1", title: "New Epic" });
      const result = await epicService.createEpic("proj-1", "org-1", { title: "New Epic" });

      expect(epicRepositoryMock.create).toHaveBeenCalledWith({
        title: "New Epic",
        description: undefined,
        color: "#6366f1",
        projectId: "proj-1",
        organizationId: "org-1",
        startDate: null,
        endDate: null,
        status: "open",
      });
      expect(result).toEqual({ id: "e1", title: "New Epic" });
    });

    it("parses dates in createEpic", async () => {
      await epicService.createEpic("proj-1", "org-1", {
        title: "New Epic",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
      });
      expect(epicRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: new Date("2026-07-01"),
          endDate: new Date("2026-07-31"),
        })
      );
    });
  });

  describe("getEpics & getEpic", () => {
    it("gets epics by project ID", async () => {
      epicRepositoryMock.findByProjectId.mockResolvedValueOnce([{ id: "e1" }]);
      const res = await epicService.getEpics("proj-1");
      expect(epicRepositoryMock.findByProjectId).toHaveBeenCalledWith("proj-1");
      expect(res).toEqual([{ id: "e1" }]);
    });

    it("gets single epic by ID", async () => {
      epicRepositoryMock.findByIdWithTasks.mockResolvedValueOnce({ id: "e1" });
      const res = await epicService.getEpic("e1");
      expect(epicRepositoryMock.findByIdWithTasks).toHaveBeenCalledWith("e1");
      expect(res).toEqual({ id: "e1" });
    });
  });

  describe("updateEpic", () => {
    it("updates epic with valid fields", async () => {
      epicRepositoryMock.update.mockResolvedValueOnce({ id: "e1", title: "Updated" });
      const res = await epicService.updateEpic("e1", {
        title: "Updated",
        startDate: "2026-07-05",
      });
      expect(epicRepositoryMock.update).toHaveBeenCalledWith("e1", {
        title: "Updated",
        startDate: new Date("2026-07-05"),
      });
      expect(res).toEqual({ id: "e1", title: "Updated" });
    });

    it("updates epic with description, color, status, and clears dates to null", async () => {
      epicRepositoryMock.update.mockResolvedValueOnce({ id: "e1" });
      await epicService.updateEpic("e1", {
        description: "A desc",
        color: "#ff0000",
        status: "done",
        startDate: null,
        endDate: null,
      });
      expect(epicRepositoryMock.update).toHaveBeenCalledWith("e1", {
        description: "A desc",
        color: "#ff0000",
        status: "done",
        startDate: null,
        endDate: null,
      });
    });

    it("updates epic with endDate set to a value", async () => {
      epicRepositoryMock.update.mockResolvedValueOnce({ id: "e1" });
      await epicService.updateEpic("e1", {
        endDate: "2026-08-31",
      });
      expect(epicRepositoryMock.update).toHaveBeenCalledWith("e1", {
        endDate: new Date("2026-08-31"),
      });
    });
  });

  describe("delete/restore/forceDelete", () => {
    it("deletes epic", async () => {
      await epicService.deleteEpic("e1");
      expect(epicRepositoryMock.delete).toHaveBeenCalledWith("e1");
    });

    it("restores epic or throws NotFoundException", async () => {
      epicRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(epicService.restoreEpic("e1")).rejects.toThrow("Epic not found");

      epicRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce({ id: "e1" });
      epicRepositoryMock.restore.mockResolvedValueOnce({ id: "e1" });
      await epicService.restoreEpic("e1");
      expect(epicRepositoryMock.restore).toHaveBeenCalledWith("e1");
    });

    it("force deletes epic or throws NotFoundException", async () => {
      epicRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(epicService.forceDeleteEpic("e1")).rejects.toThrow("Epic not found");

      epicRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce({ id: "e1" });
      epicRepositoryMock.forceDelete.mockResolvedValueOnce({ id: "e1" });
      await epicService.forceDeleteEpic("e1");
      expect(epicRepositoryMock.forceDelete).toHaveBeenCalledWith("e1");
    });
  });
});
