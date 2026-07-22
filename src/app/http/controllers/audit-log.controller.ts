import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import {
  auditLogService,
  type AuditLogFilters,
} from "@/app/services/audit-log.service";
import { rbacService } from "@/app/services/rbac.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { ForbiddenException, UnauthorizedException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const auditLogController = {
  /**
   * Get paginated audit logs for a workspace with robust filtering.
   */
  getLogs: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const workspaceId = req.params.id as string;

    // Check permission to read audit logs
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "audit-log:read",
      {
        workspaceId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to view audit logs.",
      );
    }

    // Parse filters from query parameters
    const filters: AuditLogFilters = {
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      entityId: req.query.entityId ? String(req.query.entityId) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    };

    // Parse array filters
    if (req.query.memberIds) {
      filters.memberIds = Array.isArray(req.query.memberIds)
        ? (req.query.memberIds as string[])
        : [String(req.query.memberIds)];
    }

    if (req.query.actions) {
      filters.actions = Array.isArray(req.query.actions)
        ? (req.query.actions as string[])
        : [String(req.query.actions)];
    }

    if (req.query.entityTypes) {
      filters.entityTypes = Array.isArray(req.query.entityTypes)
        ? (req.query.entityTypes as string[])
        : [String(req.query.entityTypes)];
    }

    const logs = await auditLogService.getLogs(workspaceId, filters);

    return ok(res, "Audit logs fetched successfully", logs);
  }),

  /**
   * Queue background job to export audit logs to CSV.
   */
  exportLogs: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const workspaceId = req.params.id as string;
    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      throw new ForbiddenException("No active organization found in session.");
    }

    // Check permission to export audit logs
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "audit-log:export",
      {
        workspaceId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to export audit logs.",
      );
    }

    // Parse filters from request body (POST request)
    const filters: AuditLogFilters = req.body || {};

    const result = await auditLogService.queueExport(
      workspaceId,
      activeOrgId,
      session.user.id,
      filters,
    );

    return ok(
      res,
      "Audit logs export started in the background. You will receive an email and in-app notification when it is complete.",
      result,
    );
  }),

  /**
   * Get paginated audit logs for the organization with robust filtering.
   */
  getOrgLogs: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
      throw new ForbiddenException("No active organization found in session.");
    }

    // Check permission to read audit logs at organization level
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "audit-log:read",
      {
        organizationId: activeOrgId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to view organization audit logs.",
      );
    }

    // Parse filters from query parameters
    const filters: AuditLogFilters = {
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      entityId: req.query.entityId ? String(req.query.entityId) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    };

    // Parse array filters
    if (req.query.memberIds) {
      filters.memberIds = Array.isArray(req.query.memberIds)
        ? (req.query.memberIds as string[])
        : [String(req.query.memberIds)];
    }

    if (req.query.actions) {
      filters.actions = Array.isArray(req.query.actions)
        ? (req.query.actions as string[])
        : [String(req.query.actions)];
    }

    if (req.query.entityTypes) {
      filters.entityTypes = Array.isArray(req.query.entityTypes)
        ? (req.query.entityTypes as string[])
        : [String(req.query.entityTypes)];
    }

    const logs = await auditLogService.getLogs(
      { organizationId: activeOrgId },
      filters,
    );

    return ok(res, "Organization audit logs fetched successfully", logs);
  }),

  /**
   * Queue background job to export organization audit logs to CSV.
   */
  exportOrgLogs: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
      throw new ForbiddenException("No active organization found in session.");
    }

    // Check permission to export audit logs
    const isAllowed = await rbacService.authorize(
      session.user.id,
      "audit-log:export",
      {
        organizationId: activeOrgId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "Forbidden: You do not have permission to export organization audit logs.",
      );
    }

    // Parse filters from request body (POST request)
    const filters: AuditLogFilters = req.body || {};

    const result = await auditLogService.queueExport(
      undefined, // workspaceId is undefined for org logs
      activeOrgId,
      session.user.id,
      filters,
    );

    return ok(
      res,
      "Organization audit logs export started in the background. You will receive an email and in-app notification when it is complete.",
      result,
    );
  }),
};
