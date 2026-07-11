import { mediaRepository } from "@/app/repositories/media.repository";
import { mediaService as coreMediaService } from "@/core/media";
import prisma from "@/lib/prisma";
import { ForbiddenException, NotFoundException } from "@/utils/app-error";

export const mediaService = {
  async uploadAvatar(
    userId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    const media = await coreMediaService.addMedia(
      "User",
      userId,
      file,
      "avatars",
      true, // Replace existing avatars
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
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(
      userId,
      "organization:update",
      {
        organizationId: activeOrgId,
      },
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        "You do not have permission to upload logos for this organization",
      );
    }

    const media = await coreMediaService.addMedia(
      "Organization",
      activeOrgId,
      file,
      "logos",
      true, // Replace existing logos
    );

    const url = await coreMediaService.getUrl(media.id);
    return { media_id: media.id, url };
  },

  async uploadWorkspaceIcon(
    workspaceId: string,
    userId: string,
    activeOrgId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(userId, "workspace:update", {
      organizationId: activeOrgId,
      workspaceId,
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        "You do not have permission to upload icons for this workspace",
      );
    }

    const media = await coreMediaService.addMedia(
      "Workspace",
      workspaceId,
      file,
      "icons",
      true, // Replace existing icon
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
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    const project = await mediaRepository.findProjectById(projectId);
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const { rbacService } = await import("@/app/services/rbac.service");
    const isAllowed = await rbacService.authorize(userId, "project:update", {
      organizationId: activeOrgId,
      workspaceId: project.workspaceId,
      projectId,
    });

    if (!isAllowed) {
      throw new ForbiddenException(
        "You do not have permission to upload icons for this project",
      );
    }

    const media = await coreMediaService.addMedia(
      "Project",
      projectId,
      file,
      "icons",
      true, // Replace existing icon
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
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    const media = await coreMediaService.addMedia(
      "User",
      userId,
      file,
      "attachments",
      false,
    );

    const url = await coreMediaService.getUrl(media.id);
    return { media_id: media.id, url };
  },

  async uploadVersion(
    parentMediaId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    const parent = await prisma.media.findUnique({
      where: { id: parentMediaId },
    });
    if (!parent) {
      throw new NotFoundException("Parent file not found");
    }

    const latest = await prisma.media.findFirst({
      where: {
        OR: [{ id: parentMediaId }, { parentMediaId }],
      },
      orderBy: { version: "desc" },
    });
    const nextVersion = (latest?.version || 1) + 1;

    const media = await coreMediaService.addMedia(
      parent.modelType,
      parent.modelId,
      file,
      parent.collectionName,
      false,
    );

    const updatedMedia = await prisma.media.update({
      where: { id: media.id },
      data: {
        parentMediaId,
        version: nextVersion,
      },
    });

    const url = await coreMediaService.getUrl(media.id);
    return {
      media_id: updatedMedia.id,
      version: updatedMedia.version,
      name: updatedMedia.name,
      url,
    };
  },

  async createAnnotation(data: {
    mediaId: string;
    userId: string;
    x: number;
    y: number;
    content: string;
  }) {
    const media = await prisma.media.findUnique({
      where: { id: data.mediaId },
    });
    if (!media) {
      throw new NotFoundException("Media not found");
    }

    return prisma.annotation.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });
  },

  async getAnnotations(mediaId: string) {
    return prisma.annotation.findMany({
      where: { mediaId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async deleteAnnotation(id: string, userId: string) {
    const annotation = await prisma.annotation.findUnique({
      where: { id },
    });
    if (!annotation) {
      throw new NotFoundException("Annotation not found");
    }
    if (annotation.userId !== userId) {
      throw new ForbiddenException("You cannot delete other user's annotation");
    }
    await prisma.annotation.delete({
      where: { id },
    });
  },
};
