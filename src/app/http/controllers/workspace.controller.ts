import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { workspaceSchema } from "@/app/http/validators/workspace.validator";
import { workspaceService } from "@/app/services/workspace.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
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
    const workspaces = await workspaceService.getWorkspaces(activeOrgId, session.user.id);

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
      validatedData
    );

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
      validatedData
    );

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

    await workspaceService.deleteWorkspace(activeOrgId, session.user.id, id);

    return ok(res, "Workspace soft-deleted successfully");
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
    const members = await workspaceService.getWorkspaceMembers(activeOrgId, session.user.id, workspaceId);

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
      userIds
    );

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

    await workspaceService.removeWorkspaceMember(activeOrgId, session.user.id, workspaceId, userId);

    return ok(res, "Member removed from workspace");
  }),
};
