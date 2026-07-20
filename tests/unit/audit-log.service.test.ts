import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockAdd, mockQueueAdd } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockQueueAdd: vi.fn(),
}));

vi.mock("@/app/queues/audit-log.queue", () => ({
  auditLogWriteQueue: {
    add: mockAdd,
  },
  auditLogQueue: {
    add: mockQueueAdd,
  },
}));

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    put: vi.fn(),
    url: vi.fn().mockReturnValue("https://cdn.example.com/export.csv"),
  },
}));

vi.mock("@/core/storage", () => ({
  storage: storageMock,
}));

const { mailServiceMock } = vi.hoisted(() => ({
  mailServiceMock: {
    to: vi.fn(),
    view: vi.fn(),
    queue: vi.fn(),
  },
}));

vi.mock("@/core/mail", () => ({
  mailService: {
    to: (...args: unknown[]) => {
      mailServiceMock.to(...args);
      return {
        view: (...vArgs: unknown[]) => {
          mailServiceMock.view(...vArgs);
          return { queue: mailServiceMock.queue };
        },
      };
    },
  },
}));

const { notificationServiceMock } = vi.hoisted(() => ({
  notificationServiceMock: {
    createInAppNotification: vi.fn(),
  },
}));

vi.mock("@/app/services/notification.service", () => ({
  notificationService: notificationServiceMock,
}));

import { auditLogService } from "@/app/services/audit-log.service";

import { prismaMock } from "../helpers/db";

describe("AuditLogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("UT-AUD-01: enqueues write jobs with correct payload and options", async () => {
    const mockData = {
      workspaceId: "ws-123",
      organizationId: "org-123",
      userId: "user-123",
      action: "PROJECT_CREATE",
      entityType: "Project",
      entityId: "proj-123",
      entityName: "Test Project",
      description: "User created a project",
      metadata: { key: "value" },
      req: {
        headers: {
          "x-forwarded-for": "1.2.3.4",
          "user-agent": "Mozilla/5.0",
        },
        ip: "127.0.0.1",
      } as unknown,
    };

    await auditLogService.log(mockData);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(
      "write-log",
      {
        workspaceId: "ws-123",
        organizationId: "org-123",
        userId: "user-123",
        action: "PROJECT_CREATE",
        entityType: "Project",
        entityId: "proj-123",
        entityName: "Test Project",
        description: "User created a project",
        metadata: { key: "value" },
        ipAddress: "1.2.3.4",
        userAgent: "Mozilla/5.0",
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });

  it("UT-AUD-02: falls back to request IP if x-forwarded-for header is missing", async () => {
    const mockData = {
      organizationId: "org-123",
      userId: "user-123",
      action: "LOGIN",
      entityType: "User",
      description: "User logged in",
      req: {
        headers: {},
        ip: "192.168.1.1",
      } as unknown,
    };

    await auditLogService.log(mockData);

    expect(mockAdd).toHaveBeenCalledWith(
      "write-log",
      expect.objectContaining({
        ipAddress: "192.168.1.1",
        userAgent: null,
      }),
      expect.anything(),
    );
  });

  it("UT-AUD-03: handles request objects with no IP headers gracefully", async () => {
    const mockData = {
      organizationId: "org-123",
      userId: "user-123",
      action: "LOGOUT",
      entityType: "User",
      description: "User logged out",
      req: {
        headers: {},
      } as unknown,
    };

    await auditLogService.log(mockData);

    expect(mockAdd).toHaveBeenCalledWith(
      "write-log",
      expect.objectContaining({
        ipAddress: null,
        userAgent: null,
      }),
      expect.anything(),
    );
  });

  describe("processWriteJob", () => {
    it("UT-AUD-04: creates an audit log in the database using prisma", async () => {
      const mockPayload = {
        workspaceId: "ws-123",
        organizationId: "org-123",
        userId: "user-123",
        action: "TASK_UPDATE",
        entityType: "Task",
        entityId: "task-123",
        entityName: "Test Task",
        description: "User updated task status",
        metadata: { status: "Done" },
        ipAddress: "1.2.3.4",
        userAgent: "Mozilla/5.0",
      };

      await auditLogService.processWriteJob(mockPayload);

      expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: {
          workspaceId: "ws-123",
          organizationId: "org-123",
          userId: "user-123",
          action: "TASK_UPDATE",
          entityType: "Task",
          entityId: "task-123",
          entityName: "Test Task",
          description: "User updated task status",
          metadata: { status: "Done" },
          ipAddress: "1.2.3.4",
          userAgent: "Mozilla/5.0",
        },
      });
    });

    it("UT-AUD-05: handles optional null fields gracefully", async () => {
      const mockPayload = {
        organizationId: "org-123",
        userId: "user-123",
        action: "LOGOUT",
        entityType: "User",
        description: "User logged out",
      };

      await auditLogService.processWriteJob(mockPayload);

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: {
          workspaceId: null,
          organizationId: "org-123",
          userId: "user-123",
          action: "LOGOUT",
          entityType: "User",
          entityId: null,
          entityName: null,
          description: "User logged out",
          metadata: undefined,
          ipAddress: null,
          userAgent: null,
        },
      });
    });
  });

  describe("buildWhereClause", () => {
    it("UT-AUD-06: builds where clause with workspace string context", () => {
      const res = auditLogService.buildWhereClause("ws-123", {});
      expect(res).toEqual({ workspaceId: "ws-123" });
    });

    it("UT-AUD-07: builds where clause with object context", () => {
      const res1 = auditLogService.buildWhereClause({ workspaceId: "ws-123" }, {});
      expect(res1).toEqual({ workspaceId: "ws-123" });

      const res2 = auditLogService.buildWhereClause({ organizationId: "org-123" }, {});
      expect(res2).toEqual({ organizationId: "org-123" });
    });

    it("UT-AUD-08: filters by memberIds, actions, entityTypes, entityId, search and dates", () => {
      const filters = {
        memberIds: ["u1"],
        actions: ["CREATE"],
        entityTypes: ["Project"],
        entityId: "p1",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        search: "hello",
      };
      const res = auditLogService.buildWhereClause("ws-123", filters);

      expect(res.userId).toEqual({ in: ["u1"] });
      expect(res.action).toEqual({ in: ["CREATE"] });
      expect(res.entityType).toEqual({ in: ["Project"] });
      expect(res.entityId).toBe("p1");
      expect(res.createdAt.gte).toBeInstanceOf(Date);
      expect(res.createdAt.lte).toBeInstanceOf(Date);
      expect(res.OR).toHaveLength(3);
    });
  });

  describe("getLogs", () => {
    it("UT-AUD-09: fetches paginated logs successfully", async () => {
      prismaMock.auditLog.count.mockResolvedValueOnce(10);
      prismaMock.auditLog.findMany.mockResolvedValueOnce([{ id: "log-1" }]);

      const res = await auditLogService.getLogs("ws-123", { page: 2, limit: 5 });

      expect(prismaMock.auditLog.count).toHaveBeenCalled();
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
      expect(res.meta.totalPages).toBe(2);
      expect(res.data).toEqual([{ id: "log-1" }]);
    });
  });

  describe("queueExport", () => {
    it("enqueues export job and returns success", async () => {
      mockQueueAdd.mockResolvedValueOnce({ id: "job-123" });

      const result = await auditLogService.queueExport("ws-1", "org-1", "user-1", { page: 1 });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "export-csv",
        expect.objectContaining({ workspaceId: "ws-1", organizationId: "org-1", userId: "user-1" }),
        expect.objectContaining({ attempts: 3 })
      );
      expect(result).toEqual({ success: true, jobId: "job-123" });
    });

    it("enqueues export job without workspaceId", async () => {
      mockQueueAdd.mockResolvedValueOnce({ id: "job-456" });

      const result = await auditLogService.queueExport(undefined, "org-1", "user-1", {});

      expect(result).toEqual({ success: true, jobId: "job-456" });
    });
  });

  describe("processExportJob", () => {
    const jobData = {
      workspaceId: "ws-1",
      organizationId: "org-1",
      userId: "user-1",
      filters: {},
    };

    const mockLogs = [
      {
        createdAt: new Date("2026-07-18"),
        user: { name: "Alice", email: "alice@example.com" },
        action: "TASK_CREATE",
        entityType: "Task",
        entityName: "Fix bug",
        description: "Alice created a task",
        ipAddress: "1.2.3.4",
        userAgent: "Chrome",
      },
    ];

    it("fetches logs, builds CSV, saves to storage, and sends notifications", async () => {
      prismaMock.auditLog.findMany.mockResolvedValueOnce(mockLogs as unknown);
      storageMock.put.mockResolvedValueOnce(undefined);
      storageMock.url.mockReturnValueOnce("https://cdn.example.com/export.csv");
      prismaMock.user.findUnique.mockResolvedValueOnce({
        email: "alice@example.com", name: "Alice",
      } as unknown);
      mailServiceMock.queue.mockResolvedValueOnce(undefined);
      notificationServiceMock.createInAppNotification.mockResolvedValueOnce(undefined);

      await auditLogService.processExportJob(jobData);

      expect(storageMock.put).toHaveBeenCalled();
      expect(mailServiceMock.to).toHaveBeenCalledWith("alice@example.com", "Alice");
      expect(notificationServiceMock.createInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: "user-1", type: "audit_log_export" })
      );
    });

    it("handles logs with null values in CSV rows", async () => {
      const logsWithNulls = [{
        createdAt: new Date("2026-07-18"),
        user: { name: "Bob", email: "bob@example.com" },
        action: "TASK_DELETE",
        entityType: "Task",
        entityName: null, // null entityName
        description: "Bob deleted a task",
        ipAddress: null, // null ip
        userAgent: null, // null userAgent
      }];

      prismaMock.auditLog.findMany.mockResolvedValueOnce(logsWithNulls as unknown);
      storageMock.put.mockResolvedValueOnce(undefined);
      storageMock.url.mockReturnValueOnce("https://cdn.example.com/export.csv");
      prismaMock.user.findUnique.mockResolvedValueOnce({
        email: "bob@example.com", name: "Bob",
      } as unknown);
      mailServiceMock.queue.mockResolvedValueOnce(undefined);
      notificationServiceMock.createInAppNotification.mockResolvedValueOnce(undefined);

      await auditLogService.processExportJob(jobData);

      expect(storageMock.put).toHaveBeenCalled();
    });

    it("throws error if recipient user not found", async () => {
      prismaMock.auditLog.findMany.mockResolvedValueOnce([]);
      storageMock.put.mockResolvedValueOnce(undefined);
      storageMock.url.mockReturnValueOnce("https://cdn.example.com/export.csv");
      prismaMock.user.findUnique.mockResolvedValueOnce(null); // user not found

      await expect(auditLogService.processExportJob(jobData)).rejects.toThrow(
        "Export recipient user with ID user-1 not found."
      );
    });

    it("handles mail send error gracefully", async () => {
      prismaMock.auditLog.findMany.mockResolvedValueOnce([]);
      storageMock.put.mockResolvedValueOnce(undefined);
      storageMock.url.mockReturnValueOnce("https://cdn.example.com/export.csv");
      prismaMock.user.findUnique.mockResolvedValueOnce({ email: "alice@example.com", name: "Alice" } as unknown);
      mailServiceMock.queue.mockRejectedValueOnce(new Error("SMTP error"));
      notificationServiceMock.createInAppNotification.mockResolvedValueOnce(undefined);

      // Should not throw - mail error is caught
      await auditLogService.processExportJob(jobData);

      expect(notificationServiceMock.createInAppNotification).toHaveBeenCalled();
    });

    it("uses org context label when no workspaceId", async () => {
      const jobDataNoWs = { ...jobData, workspaceId: undefined };

      prismaMock.auditLog.findMany.mockResolvedValueOnce([]);
      storageMock.put.mockResolvedValueOnce(undefined);
      storageMock.url.mockReturnValueOnce("https://cdn.example.com/export.csv");
      prismaMock.user.findUnique.mockResolvedValueOnce({ email: "alice@example.com", name: "Alice" } as unknown);
      mailServiceMock.queue.mockResolvedValueOnce(undefined);
      notificationServiceMock.createInAppNotification.mockResolvedValueOnce(undefined);

      await auditLogService.processExportJob(jobDataNoWs);

      const filenameArg = storageMock.put.mock.calls[0][0];
      expect(filenameArg).toContain("org-org-1");
    });
  });
});
