import { mediaRepository } from "@/app/repositories/media.repository";
import { mediaService as coreMediaService } from "@/core/media";
import { ForbiddenException, NotFoundException } from "@/utils/app-error";

export const mediaService = {
  async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ) {
    const media = await coreMediaService.addMedia(
      "User",
      userId,
      file,
      "avatars",
      true // Replace existing avatars
    );

    const url = await coreMediaService.getUrl(media.id);
    if (!url) {
      throw new Error("Failed to generate avatar URL");
    }

    await mediaRepository.updateUserAvatar(userId, url);

    return { media_id: media.id, url };
  },

  async uploadOrgLogo(
    userId: string,
    activeOrgId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ) {
    const member = await mediaRepository.findOrgMember(activeOrgId, userId);
    if (!member) {
      throw new ForbiddenException("You do not have permission to upload logos for this organization");
    }

    const media = await coreMediaService.addMedia(
      "Organization",
      activeOrgId,
      file,
      "logos",
      true // Replace existing logos
    );

    const url = await coreMediaService.getUrl(media.id);
    return { media_id: media.id, url };
  },

  async uploadWorkspaceIcon(
    workspaceId: string,
    userId: string,
    activeOrgId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ) {
    const workspaceMember = await mediaRepository.findWorkspaceMember(workspaceId, userId, activeOrgId);
    const orgAdmin = await mediaRepository.findOrgMember(activeOrgId, userId);

    if (!workspaceMember && !orgAdmin) {
      throw new ForbiddenException("You do not have permission to upload icons for this workspace");
    }

    const media = await coreMediaService.addMedia(
      "Workspace",
      workspaceId,
      file,
      "icons",
      true // Replace existing icon
    );

    const url = await coreMediaService.getUrl(media.id);
    if (!url) {
      throw new Error("Failed to generate workspace icon URL");
    }

    await mediaRepository.updateWorkspaceIcon(workspaceId, url);

    return { media_id: media.id, url };
  },

  async uploadProjectIcon(
    projectId: string,
    userId: string,
    activeOrgId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ) {
    const project = await mediaRepository.findProjectById(projectId);
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const workspaceMember = await mediaRepository.findWorkspaceMember(
      project.workspaceId,
      userId,
      activeOrgId
    );
    const orgAdmin = await mediaRepository.findOrgMember(activeOrgId, userId);

    if (!workspaceMember && !orgAdmin) {
      throw new ForbiddenException("You do not have permission to upload icons for this project");
    }

    const media = await coreMediaService.addMedia(
      "Project",
      projectId,
      file,
      "icons",
      true // Replace existing icon
    );

    const url = await coreMediaService.getUrl(media.id);
    if (!url) {
      throw new Error("Failed to generate project icon URL");
    }

    await mediaRepository.updateProjectIcon(projectId, url);

    return { media_id: media.id, url };
  },

  async uploadFile(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ) {
    const media = await coreMediaService.addMedia("User", userId, file, "attachments", false);

    const url = await coreMediaService.getUrl(media.id);
    return { media_id: media.id, url };
  },
};
