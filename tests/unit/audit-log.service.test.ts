import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockAdd } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
}));

vi.mock("@/app/queues/audit-log.queue", () => ({
  auditLogWriteQueue: {
    add: mockAdd,
  },
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
      } as any,
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
      } as any,
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
      } as any,
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
});
