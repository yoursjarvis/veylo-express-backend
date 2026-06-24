import { workspaceRepository } from "@/app/repositories/workspace.repository";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/utils/app-error";

async function verifyOrgAdmin(activeOrgId: string | null | undefined, userId: string) {
  if (!activeOrgId) {
    throw new BadRequestException("No active organization found");
  }

  const callerMember = await workspaceRepository.findOrgMember(activeOrgId, userId, ["owner", "admin"]);
  if (!callerMember) {
    throw new ForbiddenException("Forbidden: You must be an organization admin");
  }

  return { activeOrgId, userId };
}

async function verifyWorkspaceAdmin(activeOrgId: string | null | undefined, userId: string, workspaceId: string) {
  if (!activeOrgId) {
    throw new BadRequestException("No active organization found");
  }

  // Check Org Admin
  const callerOrgMember = await workspaceRepository.findOrgMember(activeOrgId, userId, ["owner", "admin"]);
  if (callerOrgMember) {
    return { activeOrgId, userId };
  }

  // Check Workspace Admin
  const callerWorkspaceMember = await workspaceRepository.findWorkspaceMemberWithOrg(
    workspaceId,
    userId,
    "admin",
    activeOrgId
  );

  if (!callerWorkspaceMember) {
    throw new ForbiddenException("Forbidden: You must be an organization or workspace admin");
  }

  return { activeOrgId, userId };
}

export const workspaceService = {
  async getWorkspaces(activeOrgId: string | null | undefined, userId: string) {
    if (!activeOrgId) {
      throw new BadRequestException("No active organization found");
    }

    // Best-effort sync of org admins to workspaces
    try {
      await workspaceRepository.syncOrgAdminsToWorkspaces(activeOrgId);
    } catch (error) {
      console.error("Failed to sync organization admins to workspaces:", error);
    }

    return workspaceRepository.getWorkspacesForUser(activeOrgId, userId);
  },

  async createWorkspace(
    activeOrgId: string | null | undefined,
    userId: string,
    data: { name: string; slug: string; icon?: string }
  ) {
    await verifyOrgAdmin(activeOrgId, userId);

    const existingWorkspace = await workspaceRepository.findWorkspaceBySlug(data.slug);
    if (existingWorkspace) {
      throw new BadRequestException("Workspace slug already exists");
    }

    const workspace = await workspaceRepository.createWorkspace({
      name: data.name,
      slug: data.slug,
      organizationId: activeOrgId!,
      creatorUserId: userId,
    });

    try {
      await workspaceRepository.syncOrgAdminsToWorkspaces(activeOrgId!);
    } catch (error) {
      console.error("Failed to sync organization admins to workspaces:", error);
    }

    return workspace;
  },

  async updateWorkspace(
    activeOrgId: string | null | undefined,
    userId: string,
    id: string,
    data: { name?: string; slug?: string; icon?: string }
  ) {
    await verifyWorkspaceAdmin(activeOrgId, userId, id);

    const workspace = await workspaceRepository.findWorkspaceByIdAndOrg(id, activeOrgId!);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    if (data.slug) {
      const existingWorkspace = await workspaceRepository.findWorkspaceBySlugExcludeId(data.slug, id);
      if (existingWorkspace) {
        throw new BadRequestException("Workspace slug already exists");
      }
    }

    return workspaceRepository.updateWorkspace(id, data);
  },

  async deleteWorkspace(activeOrgId: string | null | undefined, userId: string, id: string) {
    await verifyWorkspaceAdmin(activeOrgId, userId, id);

    const workspace = await workspaceRepository.findWorkspaceByIdAndOrg(id, activeOrgId!);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    await workspaceRepository.deleteWorkspace(id);
  },

  async getWorkspaceMembers(activeOrgId: string | null | undefined, userId: string, workspaceId: string) {
    await verifyWorkspaceAdmin(activeOrgId, userId, workspaceId);

    try {
      await workspaceRepository.syncOrgAdminsToWorkspaces(activeOrgId!);
    } catch (error) {
      console.error("Failed to sync organization admins to workspaces:", error);
    }

    return workspaceRepository.getWorkspaceMembers(workspaceId, activeOrgId!);
  },

  async addWorkspaceMembers(
    activeOrgId: string | null | undefined,
    userId: string,
    workspaceId: string,
    userIds: string[]
  ) {
    await verifyWorkspaceAdmin(activeOrgId, userId, workspaceId);

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestException("User IDs are required");
    }

    // Verify all users are part of the organization
    const orgMembers = await workspaceRepository.getOrgMembersByIds(activeOrgId!, userIds);
    if (orgMembers.length !== userIds.length) {
      throw new BadRequestException("One or more users are not members of this organization");
    }

    return Promise.all(
      userIds.map((targetUserId) =>
        workspaceRepository.upsertWorkspaceMember(workspaceId, targetUserId, "member")
      )
    );
  },

  async removeWorkspaceMember(
    activeOrgId: string | null | undefined,
    userId: string,
    workspaceId: string,
    targetUserId: string
  ) {
    await verifyWorkspaceAdmin(activeOrgId, userId, workspaceId);

    return workspaceRepository.deleteWorkspaceMember(workspaceId, targetUserId);
  },
};
