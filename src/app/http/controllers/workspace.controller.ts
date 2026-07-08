import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { workspaceSchema } from "@/app/http/validators/workspace.validator";
import { auditLogService } from "@/app/services/audit-log.service";
import { workspaceService } from "@/app/services/workspace.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import prisma from "@/lib/prisma";
import { UnauthorizedException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const workspaceController = {
  getWorkspaces: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const activeOrgId = session.session.activeOrganizationId;
    const workspaces = await workspaceService.getWorkspaces(
      activeOrgId,
      session.user.id,
    );

    return ok(res, "Workspaces fetched", workspaces);
  }),

  createWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const validatedData = workspaceSchema.parse(req.body);
    const activeOrgId = session.session.activeOrganizationId;

    const workspace = await workspaceService.createWorkspace(
      activeOrgId,
      session.user.id,
      validatedData,
    );

    await auditLogService.log({
      workspaceId: workspace.id,
      organizationId: workspace.organizationId,
      userId: session.user.id,
      action: "CREATE_WORKSPACE",
      entityType: "WORKSPACE",
      entityId: workspace.id,
      entityName: workspace.name,
      description: `User "${session.user.name}" created workspace "${workspace.name}".`,
      req,
    });

    return ok(res, "Workspace created successfully", workspace);
  }),

  updateWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const validatedData = workspaceSchema.partial().parse(req.body);
    const activeOrgId = session.session.activeOrganizationId;

    const updatedWorkspace = await workspaceService.updateWorkspace(
      activeOrgId,
      session.user.id,
      id,
      validatedData,
    );

    await auditLogService.log({
      workspaceId: updatedWorkspace.id,
      organizationId: updatedWorkspace.organizationId,
      userId: session.user.id,
      action: "UPDATE_WORKSPACE",
      entityType: "WORKSPACE",
      entityId: updatedWorkspace.id,
      entityName: updatedWorkspace.name,
      description: `User "${session.user.name}" updated settings for workspace "${updatedWorkspace.name}".`,
      metadata: validatedData,
      req,
    });

    return ok(res, "Workspace updated successfully", updatedWorkspace);
  }),

  deleteWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const activeOrgId = session.session.activeOrganizationId;

    const deletedWorkspace = await workspaceService.deleteWorkspace(
      activeOrgId,
      session.user.id,
      id,
    );

    await auditLogService.log({
      workspaceId: deletedWorkspace.id,
      organizationId: deletedWorkspace.organizationId,
      userId: session.user.id,
      action: "DELETE_WORKSPACE",
      entityType: "WORKSPACE",
      entityId: deletedWorkspace.id,
      entityName: deletedWorkspace.name,
      description: `User "${session.user.name}" soft-deleted workspace "${deletedWorkspace.name}".`,
      req,
    });

    return ok(res, "Workspace soft-deleted successfully");
  }),

  restoreWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const activeOrgId = session.session.activeOrganizationId;

    const restoredWorkspace = await workspaceService.restoreWorkspace(
      activeOrgId,
      session.user.id,
      id,
    );

    await auditLogService.log({
      workspaceId: restoredWorkspace.id,
      organizationId: restoredWorkspace.organizationId,
      userId: session.user.id,
      action: "RESTORE_WORKSPACE",
      entityType: "WORKSPACE",
      entityId: restoredWorkspace.id,
      entityName: restoredWorkspace.name,
      description: `User "${session.user.name}" restored workspace "${restoredWorkspace.name}".`,
      req,
    });

    return ok(res, "Workspace restored successfully");
  }),

  forceDeleteWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const activeOrgId = session.session.activeOrganizationId;

    const deletedWorkspace = await workspaceService.forceDeleteWorkspace(
      activeOrgId,
      session.user.id,
      id,
    );

    await auditLogService.log({
      workspaceId: deletedWorkspace.id,
      organizationId: deletedWorkspace.organizationId,
      userId: session.user.id,
      action: "FORCE_DELETE_WORKSPACE",
      entityType: "WORKSPACE",
      entityId: deletedWorkspace.id,
      entityName: deletedWorkspace.name,
      description: `User "${session.user.name}" permanently deleted workspace "${deletedWorkspace.name}".`,
      req,
    });

    return ok(res, "Workspace permanently deleted");
  }),

  getWorkspaceMembers: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const activeOrgId = session.session.activeOrganizationId;
    const members = await workspaceService.getWorkspaceMembers(
      activeOrgId,
      session.user.id,
      workspaceId,
    );

    return ok(res, "Workspace members fetched", members);
  }),

  addWorkspaceMembers: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const { userIds } = req.body;
    const activeOrgId = session.session.activeOrganizationId;

    const workspaceMembers = await workspaceService.addWorkspaceMembers(
      activeOrgId,
      session.user.id,
      workspaceId,
      userIds,
    );

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, organizationId: true },
    });

    if (workspace) {
      await auditLogService.log({
        workspaceId,
        organizationId: workspace.organizationId,
        userId: session.user.id,
        action: "ADD_WORKSPACE_MEMBERS",
        entityType: "WORKSPACE",
        entityId: workspaceId,
        entityName: workspace.name,
        description: `User "${session.user.name}" added ${userIds.length} members to workspace "${workspace.name}".`,
        metadata: { addedUserIds: userIds },
        req,
      });
    }

    return ok(res, "Members added to workspace", workspaceMembers);
  }),

  removeWorkspaceMember: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const userId = req.params.userId as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const activeOrgId = session.session.activeOrganizationId;

    await workspaceService.removeWorkspaceMember(
      activeOrgId,
      session.user.id,
      workspaceId,
      userId,
    );

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, organizationId: true },
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (workspace && targetUser) {
      await auditLogService.log({
        workspaceId,
        organizationId: workspace.organizationId,
        userId: session.user.id,
        action: "REMOVE_WORKSPACE_MEMBER",
        entityType: "WORKSPACE",
        entityId: workspaceId,
        entityName: workspace.name,
        description: `User "${session.user.name}" removed member "${targetUser.name}" from workspace "${workspace.name}".`,
        metadata: { removedUserId: userId },
        req,
      });
    }

    return ok(res, "Member removed from workspace");
  }),
};
