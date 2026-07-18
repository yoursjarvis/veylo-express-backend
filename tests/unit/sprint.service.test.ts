import { describe, expect, it, vi, beforeEach } from "vitest";
import { sprintService } from "../../src/app/services/sprint.service";

const { sprintRepositoryMock } = vi.hoisted(() => ({
  sprintRepositoryMock: {
    create: vi.fn(),
    findByProjectId: vi.fn(),
    findByIdWithTasks: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByIdWithTrashed: vi.fn(),
    restore: vi.fn(),
    forceDelete: vi.fn(),
    findFirstActiveByProjectId: vi.fn(),
    findSprintInProject: vi.fn(),
    findUncompletedTasksInSprint: vi.fn(),
    updateTasksSprint: vi.fn(),
    createTaskActivities: vi.fn(),
  },
}));

vi.mock("@/app/repositories/sprint.repository", () => ({
  sprintRepository: sprintRepositoryMock,
}));

const existingSprint = {
  id: "sprint-1",
  projectId: "proj-1",
  organizationId: "org-1",
  name: "Sprint 1",
  status: "planned",
  startDate: null as Date | null,
};

describe("SprintService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSprint", () => {
    it("creates sprint with dates", async () => {
      sprintRepositoryMock.create.mockResolvedValueOnce({ id: "sprint-1" });

      const result = await sprintService.createSprint("proj-1", "org-1", {
        name: "Sprint 1",
        goal: "Ship feature",
        startDate: "2026-08-01",
        endDate: "2026-08-15",
      });

      expect(sprintRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Sprint 1",
          goal: "Ship feature",
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-08-15"),
          status: "planned",
        })
      );
      expect(result).toEqual({ id: "sprint-1" });
    });

    it("creates sprint without dates (sets null)", async () => {
      sprintRepositoryMock.create.mockResolvedValueOnce({ id: "sprint-2" });

      await sprintService.createSprint("proj-1", "org-1", { name: "Sprint 2" });

      expect(sprintRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: null, endDate: null })
      );
    });
  });

  describe("getSprints & getSprint", () => {
    it("returns sprints for a project", async () => {
      sprintRepositoryMock.findByProjectId.mockResolvedValueOnce([{ id: "sprint-1" }]);
      const result = await sprintService.getSprints("proj-1");
      expect(result).toHaveLength(1);
    });

    it("returns sprint with tasks by ID", async () => {
      sprintRepositoryMock.findByIdWithTasks.mockResolvedValueOnce({ id: "sprint-1", tasks: [] });
      const result = await sprintService.getSprint("sprint-1");
      expect(result).toEqual({ id: "sprint-1", tasks: [] });
    });
  });

  describe("updateSprint", () => {
    it("updates sprint name, goal, and clears dates to null", async () => {
      sprintRepositoryMock.update.mockResolvedValueOnce({ id: "sprint-1" });

      await sprintService.updateSprint(existingSprint, {
        name: "Sprint 1 Updated",
        goal: null,
        startDate: null,
        endDate: null,
      }, "user-1");

      expect(sprintRepositoryMock.update).toHaveBeenCalledWith("sprint-1",
        expect.objectContaining({ name: "Sprint 1 Updated", goal: null, startDate: null, endDate: null })
      );
    });

    it("sets status to active when no active sprint exists", async () => {
      sprintRepositoryMock.findFirstActiveByProjectId.mockResolvedValueOnce(null);
      sprintRepositoryMock.update.mockResolvedValueOnce({ id: "sprint-1", status: "active" });

      await sprintService.updateSprint(existingSprint, { status: "active" }, "user-1");

      expect(sprintRepositoryMock.findFirstActiveByProjectId).toHaveBeenCalledWith("proj-1");
      expect(sprintRepositoryMock.update).toHaveBeenCalledWith("sprint-1",
        expect.objectContaining({ status: "active" })
      );
    });

    it("auto-sets startDate when activating sprint with no startDate", async () => {
      sprintRepositoryMock.findFirstActiveByProjectId.mockResolvedValueOnce(null);
      sprintRepositoryMock.update.mockResolvedValueOnce({ id: "sprint-1" });

      await sprintService.updateSprint({ ...existingSprint, startDate: null }, { status: "active" }, "user-1");

      const call = sprintRepositoryMock.update.mock.calls[0][1];
      expect(call.startDate).toBeInstanceOf(Date);
    });

    it("does NOT auto-set startDate when sprint already has one", async () => {
      sprintRepositoryMock.findFirstActiveByProjectId.mockResolvedValueOnce(null);
      sprintRepositoryMock.update.mockResolvedValueOnce({ id: "sprint-1" });
      const sprintWithDate = { ...existingSprint, startDate: new Date("2026-08-01") };

      await sprintService.updateSprint(sprintWithDate, { status: "active" }, "user-1");

      const call = sprintRepositoryMock.update.mock.calls[0][1];
      expect(call.startDate).toBeUndefined();
    });

    it("throws BadRequestException when activating and another sprint is already active", async () => {
      sprintRepositoryMock.findFirstActiveByProjectId.mockResolvedValueOnce({ id: "other-sprint" });

      await expect(
        sprintService.updateSprint(existingSprint, { status: "active" }, "user-1")
      ).rejects.toThrow("An active sprint already exists");
    });

    it("completes sprint and moves uncompleted tasks to destination sprint", async () => {
      const uncompletedTasks = [{ id: "task-1" }, { id: "task-2" }];
      const destSprint = { id: "sprint-dest", projectId: "proj-1" };

      sprintRepositoryMock.findSprintInProject.mockResolvedValueOnce(destSprint);
      sprintRepositoryMock.findUncompletedTasksInSprint.mockResolvedValueOnce(uncompletedTasks);
      sprintRepositoryMock.updateTasksSprint.mockResolvedValueOnce(undefined);
      sprintRepositoryMock.createTaskActivities.mockResolvedValueOnce(undefined);
      sprintRepositoryMock.update.mockResolvedValueOnce({ id: "sprint-1", status: "completed" });

      const activeSprint = { ...existingSprint, status: "active" };
      await sprintService.updateSprint(activeSprint, {
        status: "completed",
        uncompletedTasksDestination: "sprint-dest",
      }, "user-1");

      expect(sprintRepositoryMock.findSprintInProject).toHaveBeenCalledWith("sprint-dest", "proj-1");
      expect(sprintRepositoryMock.updateTasksSprint).toHaveBeenCalledWith(
        ["task-1", "task-2"], "sprint-dest"
      );
      expect(sprintRepositoryMock.createTaskActivities).toHaveBeenCalled();
    });

    it("completes sprint with no uncompleted tasks (no move needed)", async () => {
      sprintRepositoryMock.findUncompletedTasksInSprint.mockResolvedValueOnce([]);
      sprintRepositoryMock.update.mockResolvedValueOnce({ id: "sprint-1", status: "completed" });

      const activeSprint = { ...existingSprint, status: "active" };
      await sprintService.updateSprint(activeSprint, { status: "completed" }, "user-1");

      expect(sprintRepositoryMock.updateTasksSprint).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when destination sprint not found", async () => {
      sprintRepositoryMock.findSprintInProject.mockResolvedValueOnce(null);

      const activeSprint = { ...existingSprint, status: "active" };
      await expect(
        sprintService.updateSprint(activeSprint, {
          status: "completed",
          uncompletedTasksDestination: "nonexistent-sprint",
        }, "user-1")
      ).rejects.toThrow("Selected destination sprint does not belong to this project");
    });

    it("sets status to planned (else branch)", async () => {
      sprintRepositoryMock.update.mockResolvedValueOnce({ id: "sprint-1" });

      const activeSprint = { ...existingSprint, status: "active" };
      await sprintService.updateSprint(activeSprint, { status: "planned" }, "user-1");

      const call = sprintRepositoryMock.update.mock.calls[0][1];
      expect(call.status).toBe("planned");
    });

    it("does not change status if same as current", async () => {
      sprintRepositoryMock.update.mockResolvedValueOnce({ id: "sprint-1" });

      await sprintService.updateSprint(existingSprint, { status: "planned" }, "user-1"); // same as existing

      // status should remain unchanged (no status in updateData for same status)
      expect(sprintRepositoryMock.findFirstActiveByProjectId).not.toHaveBeenCalled();
    });
  });

  describe("deleteSprint", () => {
    it("soft deletes a sprint", async () => {
      sprintRepositoryMock.delete.mockResolvedValueOnce(undefined);
      await sprintService.deleteSprint("sprint-1");
      expect(sprintRepositoryMock.delete).toHaveBeenCalledWith("sprint-1");
    });
  });

  describe("restoreSprint", () => {
    it("throws NotFoundException if sprint not found", async () => {
      sprintRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(sprintService.restoreSprint("sprint-missing")).rejects.toThrow("Sprint not found");
    });

    it("restores a soft-deleted sprint", async () => {
      sprintRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce({ id: "sprint-1" });
      sprintRepositoryMock.restore.mockResolvedValueOnce({ id: "sprint-1" });
      const result = await sprintService.restoreSprint("sprint-1");
      expect(result).toEqual({ id: "sprint-1" });
    });
  });

  describe("forceDeleteSprint", () => {
    it("throws NotFoundException if sprint not found", async () => {
      sprintRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(sprintService.forceDeleteSprint("sprint-missing")).rejects.toThrow("Sprint not found");
    });

    it("permanently deletes a sprint", async () => {
      sprintRepositoryMock.findByIdWithTrashed.mockResolvedValueOnce({ id: "sprint-1" });
      sprintRepositoryMock.forceDelete.mockResolvedValueOnce({ id: "sprint-1" });
      const result = await sprintService.forceDeleteSprint("sprint-1");
      expect(result).toEqual({ id: "sprint-1" });
    });
  });
});
