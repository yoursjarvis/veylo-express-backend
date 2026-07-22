import type { Request } from "express";

import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import prisma from "@/lib/prisma";
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";

export interface ProjectAccessContext {
  activeOrgId: string;
  userId: string;
  project: {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
    template: string;
    teamMode: string;
    workspaceId: string;
    organizationId: string;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface WorkspaceAdminContext {
  activeOrgId: string;
  userId: string;
}

/**
 * Resolves the current session and returns { activeOrgId, userId }.
 * Throws UnauthorizedException or BadRequestException on failure.
 */
export async function resolveSession(
  req: Request,
): Promise<{ activeOrgId: string; userId: string }> {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  const activeOrgId = (session.session as Record<string, unknown>)
    .activeOrganizationId as string | undefined;
  if (!activeOrgId) {
    throw new BadRequestException("No active organization found");
  }

  return { activeOrgId, userId: session.user.id };
}

/**
 * Verifies the caller is an Org Owner/Admin OR a Workspace Admin.
 * Used for operations that require elevated workspace-level permissions.
 */
export async function verifyWorkspaceAdmin(
  req: Request,
  workspaceId: string,
  requiredPermission: string = "workspace:update"
): Promise<WorkspaceAdminContext> {
  const { activeOrgId, userId } = await resolveSession(req);
  const { rbacService } = await import("@/app/services/rbac.service");

  const isAllowed = await rbacService.authorize(userId, requiredPermission, {
    organizationId: activeOrgId,
    workspaceId,
  });

  if (!isAllowed) {
    throw new ForbiddenException(
      `Forbidden: You lack the required permission (${requiredPermission})`,
    );
  }

  return { activeOrgId, userId };
}

export async function verifyProjectAccess(
  req: Request,
  projectId: string,
  requiredPermission: string = "project:read"
): Promise<ProjectAccessContext> {
  const { activeOrgId, userId } = await resolveSession(req);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }

  const { rbacService } = await import("@/app/services/rbac.service");
  const isAllowed = await rbacService.authorize(userId, requiredPermission, {
    organizationId: activeOrgId,
    workspaceId: project.workspaceId,
    projectId,
  });

  if (!isAllowed) {
    throw new ForbiddenException(
      `Forbidden: You lack the required permission (${requiredPermission})`,
    );
  }

  return { activeOrgId, userId, project };
}

export async function verifyProjectAdmin(
  req: Request,
  projectId: string,
  requiredPermission: string = "project:update"
): Promise<ProjectAccessContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }

  const { activeOrgId, userId } = await resolveSession(req);
  const { rbacService } = await import("@/app/services/rbac.service");

  const isAllowed = await rbacService.authorize(userId, requiredPermission, {
    organizationId: activeOrgId,
    workspaceId: project.workspaceId,
    projectId,
  });

  if (!isAllowed) {
    throw new ForbiddenException(
      `Forbidden: You lack the required permission (${requiredPermission})`,
    );
  }

  return { activeOrgId, userId, project };
}
