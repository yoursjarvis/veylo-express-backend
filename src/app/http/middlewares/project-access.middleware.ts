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
  req: Request
): Promise<{ activeOrgId: string; userId: string }> {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  const activeOrgId = (session.session as Record<string, unknown>).activeOrganizationId as string | undefined;
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
  workspaceId: string
): Promise<WorkspaceAdminContext> {
  const { activeOrgId, userId } = await resolveSession(req);

  // Check Org Admin/Owner — they always have workspace access
  const callerOrgMember = await prisma.member.findFirst({
    where: {
      organizationId: activeOrgId,
      userId,
      role: { in: ["owner", "admin"] },
    },
  });

  if (callerOrgMember) {
    return { activeOrgId, userId };
  }

  // Check Workspace Admin
  const callerWorkspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      role: "admin",
      workspace: { organizationId: activeOrgId },
    },
  });

  if (!callerWorkspaceMember) {
    throw new ForbiddenException(
      "Forbidden: You must be an organization or workspace admin"
    );
  }

  return { activeOrgId, userId };
}

/**
 * Verifies the caller has any access to the project:
 *   1. Org Owner/Admin
 *   2. Workspace Admin
 *   3. Project Member
 *
 * Returns { activeOrgId, userId, project } on success.
 * Throws Unauthorized, Forbidden, or NotFound on failure.
 */
export async function verifyProjectAccess(
  req: Request,
  projectId: string
): Promise<ProjectAccessContext> {
  const { activeOrgId, userId } = await resolveSession(req);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }

  // 1. Org Admin/Owner — always has access
  const callerOrgMember = await prisma.member.findFirst({
    where: {
      organizationId: activeOrgId,
      userId,
      role: { in: ["owner", "admin"] },
    },
  });

  if (callerOrgMember) {
    return { activeOrgId, userId, project };
  }

  // 2. Workspace Admin
  const callerWorkspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspaceId,
      userId,
      role: "admin",
      workspace: { organizationId: activeOrgId },
    },
  });

  if (callerWorkspaceMember) {
    return { activeOrgId, userId, project };
  }

  // 3. Direct Project Member
  const projectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  });

  if (!projectMember) {
    throw new ForbiddenException(
      "Forbidden: You must be a project member or workspace/org admin"
    );
  }

  return { activeOrgId, userId, project };
}

/**
 * Verifies the caller is an Org Owner/Admin OR a Workspace Admin for the
 * workspace that owns this project.
 *
 * Use this for destructive/admin actions on a project (update, delete, manage members).
 */
export async function verifyProjectAdmin(
  req: Request,
  projectId: string
): Promise<ProjectAccessContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }

  const ctx = await verifyWorkspaceAdmin(req, project.workspaceId);
  return { ...ctx, project };
}
