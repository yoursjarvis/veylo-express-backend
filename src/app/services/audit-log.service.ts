import type { Request } from "express";

import { auditLogWriteQueue } from "@/app/queues/audit-log.queue";
import { notificationService } from "@/app/services/notification.service";
import prisma from "@/lib/prisma";

export interface AuditLogFilters {
  memberIds?: string[];
  startDate?: string;
  endDate?: string;
  actions?: string[];
  entityTypes?: string[];
  entityId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogWritePayload {
  workspaceId?: string | null;
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export const auditLogService = {
  /**
   * Log an administrative action in the immutable audit log ledger.
   */
  async log(data: {
    workspaceId?: string;
    organizationId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    entityName?: string;
    description: string;
    metadata?: Record<string, unknown>;
    req?: Request;
  }): Promise<void> {
    try {
      const ipAddress = data.req
        ? ((data.req.headers["x-forwarded-for"] as string) ||
          data.req.ip ||
          null)
        : null;
      const userAgent = data.req
        ? (data.req.headers["user-agent"] || null)
        : null;

      await auditLogWriteQueue.add(
        "write-log",
        {
          workspaceId: data.workspaceId ?? null,
          organizationId: data.organizationId,
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId ?? null,
          entityName: data.entityName ?? null,
          description: data.description,
          metadata: data.metadata ?? undefined,
          ipAddress,
          userAgent,
        },
        {
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (error) {
      console.error("[AUDIT LOG ERROR] Failed to enqueue audit log:", error);
    }
  },

  /**
   * Build Prisma query where clause based on comprehensive filters.
   */
  buildWhereClause(
    context: string | { workspaceId?: string; organizationId?: string },
    filters: AuditLogFilters,
  ) {
    const where: Record<string, unknown> = {};

    if (typeof context === "string") {
      where.workspaceId = context;
    } else {
      if (context.workspaceId) {
        where.workspaceId = context.workspaceId;
      } else if (context.organizationId) {
        where.organizationId = context.organizationId;
      }
    }

    if (filters.memberIds && filters.memberIds.length > 0) {
      where.userId = { in: filters.memberIds };
    }

    if (filters.actions && filters.actions.length > 0) {
      where.action = { in: filters.actions };
    }

    if (filters.entityTypes && filters.entityTypes.length > 0) {
      where.entityType = { in: filters.entityTypes };
    }

    if (filters.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters.startDate || filters.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // Adjust to end of the day (23:59:59.999) to make the date inclusive
        const end = new Date(filters.endDate);
        end.setUTCHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    if (filters.search) {
      const searchPattern = filters.search.trim();
      where.OR = [
        { description: { contains: searchPattern, mode: "insensitive" } },
        { entityName: { contains: searchPattern, mode: "insensitive" } },
        {
          user: {
            name: { contains: searchPattern, mode: "insensitive" },
          },
        },
      ];
    }

    return where;
  },

  /**
   * Fetch paginated audit logs with robust filtering.
   */
  async getLogs(
    context: string | { workspaceId?: string; organizationId?: string },
    filters: AuditLogFilters,
  ) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Number(filters.limit || 50));
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(context, filters);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  /**
   * Queue background job to export audit logs to CSV.
   */
  async queueExport(
    workspaceId: string | undefined,
    organizationId: string,
    userId: string,
    filters: AuditLogFilters,
  ): Promise<{ success: boolean; jobId: string }> {
    const { auditLogQueue } = await import("@/app/queues/audit-log.queue");
    const job = await auditLogQueue.add(
      "export-csv",
      {
        workspaceId,
        organizationId,
        userId,
        filters,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return {
      success: true,
      jobId: String(job.id),
    };
  },

  /**
   * Process background writing of audit logs.
   */
  async processWriteJob(data: AuditLogWritePayload): Promise<void> {
    await prisma.auditLog.create({
      data: {
        workspaceId: data.workspaceId ?? null,
        organizationId: data.organizationId,
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        entityName: data.entityName ?? null,
        description: data.description,
        metadata: data.metadata ?? undefined,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  },

  /**
   * Actual worker implementation for generating CSV, saving, emailing, and notifying.
   */
  async processExportJob(jobData: {
    workspaceId?: string;
    organizationId: string;
    userId: string;
    filters: AuditLogFilters;
  }): Promise<void> {
    const { workspaceId, organizationId, userId, filters } = jobData;

    // Fetch all logs matching the query (no limit)
    const where = this.buildWhereClause({ workspaceId, organizationId }, filters);
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Build CSV content
    const headers = [
      "Date",
      "User Name",
      "User Email",
      "Action",
      "Entity Type",
      "Entity Name",
      "Description",
      "IP Address",
      "User Agent",
    ];

    interface ExportableAuditLog {
      createdAt: Date;
      user: {
        name: string;
        email: string;
      };
      action: string;
      entityType: string;
      entityName: string | null;
      description: string;
      ipAddress: string | null;
      userAgent: string | null;
    }

    const rows = (logs as unknown as ExportableAuditLog[]).map((log: ExportableAuditLog) => [
      log.createdAt.toISOString(),
      log.user.name,
      log.user.email,
      log.action,
      log.entityType,
      log.entityName || "",
      log.description,
      log.ipAddress || "",
      log.userAgent || "",
    ]);

    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map((row: string[]) =>
        row.map((val: string) => `"${String(val).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Save to storage
    const { storage } = await import("@/core/storage");
    const contextLabel = workspaceId ? `workspace-${workspaceId}` : `org-${organizationId}`;
    const filename = `exports/audit-logs-${contextLabel}-${Date.now()}.csv`;
    await storage.put(filename, csvContent);
    const downloadUrl = storage.url(filename);

    // Get user details
    const recipientUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!recipientUser) {
      throw new Error(`Export recipient user with ID ${userId} not found.`);
    }

    const title = "Audit Logs Export Complete";
    const contextText = workspaceId ? "workspace" : "organization";
    const message = `Your requested audit logs CSV export for ${contextText} has completed. You can download it here: ${downloadUrl}`;

    // Send email notification
    try {
      const { mailService } = await import("@/core/mail");
      await mailService
        .to(recipientUser.email, recipientUser.name)
        .view("notification", {
          title,
          message,
        })
        .queue();
    } catch (err) {
      console.error("Failed to queue email notification for export:", err);
    }

    // Send in-app notification
    await notificationService.createInAppNotification({
      recipientId: userId,
      senderId: null, // system notification
      taskId: null,
      projectId: null,
      organizationId,
      type: "audit_log_export",
      title,
      message,
    });
  },
};
