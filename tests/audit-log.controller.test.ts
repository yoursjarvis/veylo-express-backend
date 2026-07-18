import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockGetLogs, mockQueueExport, mockAuthorize } = vi.hoisted(() => ({
  mockGetLogs: vi.fn(),
  mockQueueExport: vi.fn(),
  mockAuthorize: vi.fn(),
}));

vi.mock("../src/app/services/audit-log.service", () => ({
  auditLogService: {
    getLogs: mockGetLogs,
    queueExport: mockQueueExport,
  },
}));

vi.mock("../src/app/services/rbac.service", () => ({
  rbacService: {
    authorize: mockAuthorize,
  },
}));

vi.mock("../src/lib/auth/auth", async () => {
  const { getSessionMock } = await import("./helpers/auth");
  return {
    auth: {
      api: {
        getSession: getSessionMock,
      },
    },
  };
});

import { auditLogController } from "../src/app/http/controllers/audit-log.controller";
import { setMockUser } from "./helpers/auth";
import { createUser } from "./helpers/factories";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("auditLogController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }));
  });

  describe("getLogs", () => {
    it("throws ForbiddenException if not allowed", async () => {
      mockAuthorize.mockResolvedValueOnce(false);
      const req: any = { params: { id: "ws-123" }, query: {} };
      const res = createRes();

      await expect(
        (auditLogController.getLogs as any)(req, res)
      ).rejects.toThrow("Forbidden: You do not have permission to view audit logs.");
    });

    it("fetches logs successfully if allowed", async () => {
      mockAuthorize.mockResolvedValueOnce(true);
      mockGetLogs.mockResolvedValueOnce({ data: [{ id: "l1" }] });
      const req: any = {
        params: { id: "ws-123" },
        query: {
          startDate: "2026-07-01",
          memberIds: ["u1"],
        },
      };
      const res = createRes();

      await (auditLogController.getLogs as any)(req, res);

      expect(mockGetLogs).toHaveBeenCalledWith("ws-123", expect.objectContaining({
        startDate: "2026-07-01",
        memberIds: ["u1"],
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { data: [{ id: "l1" }] },
      }));
    });
  });

  describe("exportLogs", () => {
    it("queues export job successfully", async () => {
      mockAuthorize.mockResolvedValueOnce(true);
      mockQueueExport.mockResolvedValueOnce({ success: true, jobId: "job-123" });
      const req: any = {
        params: { id: "ws-123" },
        body: { startDate: "2026-07-01" },
      };
      const res = createRes();

      await (auditLogController.exportLogs as any)(req, res);

      expect(mockQueueExport).toHaveBeenCalledWith(
        "ws-123",
        "org-123",
        "user-123",
        { startDate: "2026-07-01" }
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { success: true, jobId: "job-123" },
      }));
    });
  });

  describe("getOrgLogs & exportOrgLogs", () => {
    it("fetches organization logs successfully", async () => {
      mockAuthorize.mockResolvedValueOnce(true);
      mockGetLogs.mockResolvedValueOnce({ data: [{ id: "l2" }] });
      const req: any = { params: {}, query: {} };
      const res = createRes();

      await (auditLogController.getOrgLogs as any)(req, res);

      expect(mockGetLogs).toHaveBeenCalledWith({ organizationId: "org-123" }, expect.any(Object));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it("queues organization export job successfully", async () => {
      mockAuthorize.mockResolvedValueOnce(true);
      mockQueueExport.mockResolvedValueOnce({ success: true, jobId: "job-456" });
      const req: any = { params: {}, body: {} };
      const res = createRes();

      await (auditLogController.exportOrgLogs as any)(req, res);

      expect(mockQueueExport).toHaveBeenCalledWith(
        undefined,
        "org-123",
        "user-123",
        {}
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });
});
