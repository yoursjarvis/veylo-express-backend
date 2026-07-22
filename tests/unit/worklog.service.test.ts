import { describe, expect, it, vi, beforeEach } from "vitest";
import { workLogService } from "../../src/app/services/worklog.service";
import { prismaMock } from "../helpers/db";

describe("WorkLogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWorkLog", () => {
    it("throws BadRequestException if hoursLogged <= 0", async () => {
      await expect(
        workLogService.createWorkLog("t1", "u1", { hoursLogged: 0 }),
      ).rejects.toThrow("Hours logged must be greater than zero");
    });

    it("throws NotFoundException if task not found", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce(null);
      await expect(
        workLogService.createWorkLog("t1", "u1", { hoursLogged: 4 }),
      ).rejects.toThrow("Task not found");
    });

    it("creates worklog successfully", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce({
        id: "t1",
        organizationId: "org-1",
      });
      const mockLog = { id: "wl-1", hoursLogged: 4 };
      prismaMock.workLog.create.mockResolvedValueOnce(mockLog);

      const res = await workLogService.createWorkLog("t1", "u1", {
        hoursLogged: 4,
        description: "Coding tests",
      });

      expect(prismaMock.workLog.create).toHaveBeenCalledWith({
        data: {
          taskId: "t1",
          userId: "u1",
          hoursLogged: 4,
          loggedAt: expect.any(Date),
          description: "Coding tests",
          organizationId: "org-1",
        },
        include: expect.any(Object),
      });
      expect(res).toEqual(mockLog);
    });
  });

  describe("getTaskWorkLogs & getProjectWorkLogs", () => {
    it("gets task worklogs or throws if task not found", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce(null);
      await expect(workLogService.getTaskWorkLogs("t1")).rejects.toThrow(
        "Task not found",
      );

      prismaMock.task.findUnique.mockResolvedValueOnce({ id: "t1" });
      prismaMock.workLog.findMany.mockResolvedValueOnce([{ id: "wl-1" }]);
      const res = await workLogService.getTaskWorkLogs("t1");
      expect(res).toEqual([{ id: "wl-1" }]);
    });

    it("gets project worklogs or throws if project not found", async () => {
      prismaMock.project.findUnique.mockResolvedValueOnce(null);
      await expect(workLogService.getProjectWorkLogs("p1")).rejects.toThrow(
        "Project not found",
      );

      prismaMock.project.findUnique.mockResolvedValueOnce({ id: "p1" });
      prismaMock.workLog.findMany.mockResolvedValueOnce([{ id: "wl-1" }]);
      const res = await workLogService.getProjectWorkLogs("p1");
      expect(res).toEqual([{ id: "wl-1" }]);
    });
  });

  describe("updateWorkLog", () => {
    it("throws NotFoundException if worklog not found", async () => {
      prismaMock.workLog.findUnique.mockResolvedValueOnce(null);
      await expect(
        workLogService.updateWorkLog("wl-1", "u1", { hoursLogged: 4 }),
      ).rejects.toThrow("Work log not found");
    });

    it("throws ForbiddenException if user is not the owner", async () => {
      prismaMock.workLog.findUnique.mockResolvedValueOnce({
        id: "wl-1",
        userId: "u-owner",
      });
      await expect(
        workLogService.updateWorkLog("wl-1", "u-other", { hoursLogged: 4 }),
      ).rejects.toThrow("You cannot edit someone else's work log");
    });

    it("throws BadRequestException if hoursLogged <= 0", async () => {
      prismaMock.workLog.findUnique.mockResolvedValueOnce({
        id: "wl-1",
        userId: "u1",
      });
      await expect(
        workLogService.updateWorkLog("wl-1", "u1", { hoursLogged: -2 }),
      ).rejects.toThrow("Hours logged must be greater than zero");
    });

    it("updates worklog successfully", async () => {
      prismaMock.workLog.findUnique.mockResolvedValueOnce({
        id: "wl-1",
        userId: "u1",
      });
      prismaMock.workLog.update.mockResolvedValueOnce({
        id: "wl-1",
        hoursLogged: 5,
      });

      const res = await workLogService.updateWorkLog("wl-1", "u1", {
        hoursLogged: 5,
      });
      expect(prismaMock.workLog.update).toHaveBeenCalledWith({
        where: { id: "wl-1" },
        data: { hoursLogged: 5 },
        include: expect.any(Object),
      });
      expect(res).toEqual({ id: "wl-1", hoursLogged: 5 });
    });
  });

  describe("deleteWorkLog", () => {
    it("throws NotFoundException if worklog not found", async () => {
      prismaMock.workLog.findUnique.mockResolvedValueOnce(null);
      await expect(workLogService.deleteWorkLog("wl-1", "u1")).rejects.toThrow(
        "Work log not found",
      );
    });

    it("throws ForbiddenException if user is not the owner", async () => {
      prismaMock.workLog.findUnique.mockResolvedValueOnce({
        id: "wl-1",
        userId: "u-owner",
      });
      await expect(
        workLogService.deleteWorkLog("wl-1", "u-other"),
      ).rejects.toThrow("You cannot delete someone else's work log");
    });

    it("deletes worklog successfully", async () => {
      prismaMock.workLog.findUnique.mockResolvedValueOnce({
        id: "wl-1",
        userId: "u1",
      });
      await workLogService.deleteWorkLog("wl-1", "u1");
      expect(prismaMock.workLog.delete).toHaveBeenCalledWith({
        where: { id: "wl-1" },
      });
    });
  });
});
