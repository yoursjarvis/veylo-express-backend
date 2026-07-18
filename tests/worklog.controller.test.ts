import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockVerifyProjectAccess, mockResolveSession, mockWorkLogService } = vi.hoisted(() => ({
  mockVerifyProjectAccess: vi.fn().mockResolvedValue({ userId: "user-123" }),
  mockResolveSession: vi.fn().mockResolvedValue({ userId: "user-123" }),
  mockWorkLogService: {
    createWorkLog: vi.fn(),
    getTaskWorkLogs: vi.fn(),
    getProjectWorkLogs: vi.fn(),
    updateWorkLog: vi.fn(),
    deleteWorkLog: vi.fn(),
  },
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
  resolveSession: mockResolveSession,
}));

vi.mock("../src/app/services/worklog.service", () => ({
  workLogService: mockWorkLogService,
}));

import { workLogController } from "../src/app/http/controllers/worklog.controller";
import { prismaMock } from "./helpers/db";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("workLogController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWorkLog", () => {
    it("throws NotFoundException if task not found", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce(null);
      const req: any = { params: { taskId: "t1" }, body: {} };
      const res = createRes();

      await expect(
        (workLogController.createWorkLog as any)(req, res)
      ).rejects.toThrow("Task not found");
    });

    it("creates worklog successfully", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce({ id: "t1", projectId: "p1" });
      mockWorkLogService.createWorkLog.mockResolvedValueOnce({ id: "wl-1" });
      const req: any = {
        params: { taskId: "t1" },
        body: { hoursLogged: 5 },
      };
      const res = createRes();

      await (workLogController.createWorkLog as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(mockWorkLogService.createWorkLog).toHaveBeenCalledWith("t1", "user-123", {
        hoursLogged: 5,
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: "Work log created successfully",
      }));
    });
  });

  describe("getTaskWorkLogs & getProjectWorkLogs", () => {
    it("gets task worklogs", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce({ id: "t1", projectId: "p1" });
      mockWorkLogService.getTaskWorkLogs.mockResolvedValueOnce([{ id: "wl-1" }]);
      const req: any = { params: { taskId: "t1" } };
      const res = createRes();

      await (workLogController.getTaskWorkLogs as any)(req, res);

      expect(mockWorkLogService.getTaskWorkLogs).toHaveBeenCalledWith("t1");
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("gets project worklogs", async () => {
      mockWorkLogService.getProjectWorkLogs.mockResolvedValueOnce([{ id: "wl-1" }]);
      const req: any = { params: { projectId: "p1" } };
      const res = createRes();

      await (workLogController.getProjectWorkLogs as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(mockWorkLogService.getProjectWorkLogs).toHaveBeenCalledWith("p1");
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe("updateWorkLog & deleteWorkLog", () => {
    it("updates worklog", async () => {
      mockWorkLogService.updateWorkLog.mockResolvedValueOnce({ id: "wl-1" });
      const req: any = { params: { id: "wl-1" }, body: { hoursLogged: 6 } };
      const res = createRes();

      await (workLogController.updateWorkLog as any)(req, res);

      expect(mockResolveSession).toHaveBeenCalledWith(req);
      expect(mockWorkLogService.updateWorkLog).toHaveBeenCalledWith("wl-1", "user-123", {
        hoursLogged: 6,
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("deletes worklog", async () => {
      const req: any = { params: { id: "wl-1" } };
      const res = createRes();

      await (workLogController.deleteWorkLog as any)(req, res);

      expect(mockWorkLogService.deleteWorkLog).toHaveBeenCalledWith("wl-1", "user-123");
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
