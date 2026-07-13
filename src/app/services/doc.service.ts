import { docRepository } from "@/app/repositories/doc.repository";
import { rbacService } from "@/app/services/rbac.service";
import prisma from "@/lib/prisma";
import { BadRequestException, NotFoundException, ForbiddenException } from "@/utils/app-error";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const docService = {
  async checkPermission(userId: string, projectId: string, permission: string) {
    const hasPermission = await rbacService.authorize(userId, permission, { projectId });
    if (!hasPermission) {
      throw new ForbiddenException("Forbidden: You do not have permission to perform this action.");
    }
  },

  async createDoc(
    projectId: string,
    data: {
      parentId?: string | null;
      title: string;
      emoji?: string | null;
      icon?: string | null;
      coverImage?: string | null;
      content?: any;
      plainText?: string | null;
    },
    userId: string
  ) {
    await this.checkPermission(userId, projectId, "project-doc:create");

    // Fetch the project to get organizationId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true }
    });
    if (!project) throw new NotFoundException("Project not found");
    const organizationId = project.organizationId;

    // Generate unique slug
    let baseSlug = slugify(data.title) || "untitled";
    let slug = baseSlug;
    let count = 1;
    while (true) {
      const existing = await prisma.projectDoc.findFirst({
        where: { projectId, slug, deleted: false }
      });
      if (!existing) break;
      slug = `${baseSlug}-${count++}`;
    }

    // Get order: count how many siblings exist
    const siblingCount = await prisma.projectDoc.count({
      where: {
        projectId,
        parentId: data.parentId ?? null,
        deleted: false
      }
    });

    const doc = await docRepository.createDoc({
      projectId,
      organizationId,
      parentId: data.parentId,
      title: data.title,
      slug,
      emoji: data.emoji,
      icon: data.icon,
      coverImage: data.coverImage,
      content: data.content,
      plainText: data.plainText,
      order: siblingCount,
      createdBy: userId,
      updatedBy: userId
    });

    // Create default version
    await docRepository.createVersion({
      docId: doc.id,
      organizationId,
      content: data.content || { type: "doc", content: [] },
      createdBy: userId,
      version: 1
    });

    // Log Activity
    await docRepository.createActivity({
      docId: doc.id,
      organizationId,
      userId,
      action: "created",
      metadata: { title: doc.title }
    });

    return doc;
  },

  async getDoc(id: string, userId: string) {
    const doc = await docRepository.findDocById(id);
    if (!doc) {
      throw new NotFoundException("Document not found");
    }

    await this.checkPermission(userId, doc.projectId, "project-doc:view");

    // Check custom permissions if set
    const userPerm = doc.permissions.find(p => p.userId === userId);
    if (doc.permissions.length > 0 && !userPerm) {
      // Check if user is project admin or higher to bypass
      const isProjectAdmin = await rbacService.authorize(userId, "project-doc:manage-permissions", { projectId: doc.projectId });
      if (!isProjectAdmin) {
        throw new ForbiddenException("You do not have permission to access this document.");
      }
    }

    return doc;
  },

  async updateDoc(
    id: string,
    data: {
      title?: string;
      parentId?: string | null;
      emoji?: string | null;
      icon?: string | null;
      coverImage?: string | null;
      content?: any;
      plainText?: string | null;
      order?: number;
      archived?: boolean;
    },
    userId: string
  ) {
    const doc = await docRepository.findDocById(id);
    if (!doc) {
      throw new NotFoundException("Document not found");
    }

    await this.checkPermission(userId, doc.projectId, "project-doc:edit");

    // Check custom edit permission
    if (doc.permissions.length > 0) {
      const userPerm = doc.permissions.find(p => p.userId === userId);
      if (userPerm && userPerm.permission === "view") {
        throw new ForbiddenException("You only have read-only access to this document.");
      }
    }

    const updateData: any = { ...data, updatedBy: userId };

    if (data.title && data.title !== doc.title) {
      let baseSlug = slugify(data.title) || "untitled";
      let slug = baseSlug;
      let count = 1;
      while (true) {
        const existing = await prisma.projectDoc.findFirst({
          where: { projectId: doc.projectId, slug, id: { not: id }, deleted: false }
        });
        if (!existing) break;
        slug = `${baseSlug}-${count++}`;
      }
      updateData.slug = slug;
    }

    const updatedDoc = await docRepository.updateDoc(id, updateData);

    // Auto versioning: Save version if content changed and last version is > 5 minutes old
    if (data.content) {
      const latestVersion = await docRepository.findLatestVersion(id);
      const isTimeElapsed = latestVersion
        ? (new Date().getTime() - new Date(latestVersion.createdAt).getTime()) > 5 * 60 * 1000
        : true;
      const isNewAuthor = latestVersion ? latestVersion.createdBy !== userId : true;

      if (isTimeElapsed || isNewAuthor) {
        const nextVersionNum = latestVersion ? latestVersion.version + 1 : 1;
        await docRepository.createVersion({
          docId: id,
          organizationId: doc.organizationId,
          content: data.content,
          createdBy: userId,
          version: nextVersionNum
        });
      }
    }

    // Log Activity
    await docRepository.createActivity({
      docId: id,
      organizationId: doc.organizationId,
      userId,
      action: data.archived !== undefined ? (data.archived ? "archived" : "unarchived") : "edited",
      metadata: { title: updatedDoc.title }
    });

    return updatedDoc;
  },

  async deleteDoc(id: string, userId: string) {
    const doc = await docRepository.findDocById(id);
    if (!doc) {
      throw new NotFoundException("Document not found");
    }

    await this.checkPermission(userId, doc.projectId, "project-doc:delete");

    await docRepository.deleteDoc(id, userId);

    await docRepository.createActivity({
      docId: id,
      organizationId: doc.organizationId,
      userId,
      action: "deleted",
      metadata: { title: doc.title }
    });
  },

  async restoreDoc(id: string, userId: string) {
    const doc = await docRepository.findDocByIdWithTrashed(id);
    if (!doc) {
      throw new NotFoundException("Document not found");
    }

    await this.checkPermission(userId, doc.projectId, "project-doc:restore");

    await docRepository.restoreDoc(id, userId);

    await docRepository.createActivity({
      docId: id,
      organizationId: doc.organizationId,
      userId,
      action: "restored",
      metadata: { title: doc.title }
    });

    return doc;
  },

  async duplicateDoc(id: string, userId: string) {
    const doc = await docRepository.findDocById(id);
    if (!doc) {
      throw new NotFoundException("Document not found");
    }

    await this.checkPermission(userId, doc.projectId, "project-doc:create");

    const duplicateDocRecursive = async (originalId: string, newParentId: string | null): Promise<string> => {
      const original = await prisma.projectDoc.findUnique({
        where: { id: originalId },
        include: { children: true }
      });

      if (!original) throw new NotFoundException("Document to duplicate not found");

      const dupTitle = newParentId === null ? `${original.title} Copy` : original.title;
      let baseSlug = slugify(dupTitle) || "untitled";
      let slug = baseSlug;
      let count = 1;
      while (true) {
        const existing = await prisma.projectDoc.findFirst({
          where: { projectId: original.projectId, slug, deleted: false }
        });
        if (!existing) break;
        slug = `${baseSlug}-${count++}`;
      }

      const dup = await prisma.projectDoc.create({
        data: {
          projectId: original.projectId,
          organizationId: original.organizationId,
          parentId: newParentId,
          title: dupTitle,
          slug,
          emoji: original.emoji,
          icon: original.icon,
          coverImage: original.coverImage,
          content: (original.content as any) ?? undefined,
          plainText: original.plainText,
          order: original.order,
          createdBy: userId,
          updatedBy: userId
        }
      });

      // Duplicate children
      for (const child of original.children) {
        if (!child.deleted) {
          await duplicateDocRecursive(child.id, dup.id);
        }
      }

      return dup.id;
    };

    const duplicateId = await duplicateDocRecursive(id, doc.parentId);
    const duplicated = await docRepository.findDocById(duplicateId);

    if (duplicated) {
      await docRepository.createActivity({
        docId: duplicated.id,
        organizationId: duplicated.organizationId,
        userId,
        action: "duplicated",
        metadata: { title: duplicated.title, originalTitle: doc.title }
      });
    }

    return duplicated;
  },

  async getProjectDocs(projectId: string, userId: string) {
    await this.checkPermission(userId, projectId, "project-doc:view");
    return docRepository.getProjectDocs(projectId, userId);
  },

  async searchDocs(projectId: string, query: string, userId: string) {
    await this.checkPermission(userId, projectId, "project-doc:view");
    return docRepository.searchDocs(projectId, query, userId);
  },

  async getRecentDocs(projectId: string, userId: string, limit?: number) {
    await this.checkPermission(userId, projectId, "project-doc:view");
    return docRepository.getRecentDocs(projectId, userId, limit);
  },

  // Favorites
  async toggleFavorite(docId: string, userId: string, data: { isFavorite?: boolean; isPinned?: boolean }) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    return docRepository.upsertFavorite(docId, userId, doc.organizationId, data);
  },

  async getFavorites(projectId: string, userId: string) {
    await this.checkPermission(userId, projectId, "project-doc:view");
    return docRepository.getFavoritesAndPinned(projectId, userId);
  },

  // Versions
  async getVersions(docId: string, userId: string) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    await this.checkPermission(userId, doc.projectId, "project-doc:version_history");
    return docRepository.getVersions(docId);
  },

  async restoreVersion(docId: string, versionId: string, userId: string) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    await this.checkPermission(userId, doc.projectId, "project-doc:version_history");

    const version = await docRepository.findVersionById(versionId);
    if (!version || version.docId !== docId) {
      throw new NotFoundException("Version not found for this document");
    }

    const updated = await docRepository.updateDoc(docId, {
      content: version.content,
      updatedBy: userId
    });

    // Create a new version representing this restoration
    const latest = await docRepository.findLatestVersion(docId);
    const nextVer = latest ? latest.version + 1 : 1;
    await docRepository.createVersion({
      docId,
      organizationId: doc.organizationId,
      content: version.content,
      createdBy: userId,
      version: nextVer
    });

    await docRepository.createActivity({
      docId,
      organizationId: doc.organizationId,
      userId,
      action: "version_restored",
      metadata: { version: version.version }
    });

    return updated;
  },

  // Comments
  async getComments(docId: string, userId: string) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    await this.checkPermission(userId, doc.projectId, "project-doc:view");
    return docRepository.getComments(docId);
  },

  async createComment(docId: string, content: string, userId: string, parentId?: string | null) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    await this.checkPermission(userId, doc.projectId, "project-doc:comment");

    const comment = await docRepository.createComment({
      docId,
      userId,
      organizationId: doc.organizationId,
      parentId,
      content
    });

    await docRepository.createActivity({
      docId,
      userId,
      organizationId: doc.organizationId,
      action: parentId ? "replied" : "commented",
      metadata: { commentId: comment.id }
    });

    return comment;
  },

  async updateComment(commentId: string, data: { content?: string; resolved?: boolean }, userId: string) {
    const comment = await docRepository.getCommentById(commentId);
    if (!comment) throw new NotFoundException("Comment not found");
    await this.checkPermission(userId, comment.doc.projectId, "project-doc:comment");

    // Only owner of comment can edit content
    if (data.content && comment.userId !== userId) {
      throw new ForbiddenException("You can only edit your own comments.");
    }

    const updated = await docRepository.updateComment(commentId, data);

    if (data.resolved !== undefined) {
      await docRepository.createActivity({
        docId: comment.docId,
        organizationId: comment.doc.organizationId,
        userId,
        action: data.resolved ? "comment_resolved" : "comment_reopened",
        metadata: { commentId }
      });
    }

    return updated;
  },

  async deleteComment(commentId: string, userId: string) {
    const comment = await docRepository.getCommentById(commentId);
    if (!comment) throw new NotFoundException("Comment not found");
    await this.checkPermission(userId, comment.doc.projectId, "project-doc:comment");

    if (comment.userId !== userId) {
      // Check if project admin to allow deleting other users' comments
      const isProjectAdmin = await rbacService.authorize(userId, "project-doc:delete", { projectId: comment.doc.projectId });
      if (!isProjectAdmin) {
        throw new ForbiddenException("You can only delete your own comments.");
      }
    }

    await docRepository.deleteComment(commentId);
  },

  // Share and manage permissions
  async getPermissions(docId: string, userId: string) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    await this.checkPermission(userId, doc.projectId, "project-doc:view");
    return docRepository.getDocPermissions(docId);
  },

  async updatePermission(docId: string, targetUserId: string, permission: string, userId: string) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    await this.checkPermission(userId, doc.projectId, "project-doc:manage-permissions");

    const perm = await docRepository.updateDocPermission(docId, targetUserId, doc.organizationId, permission);

    await docRepository.createActivity({
      docId,
      organizationId: doc.organizationId,
      userId,
      action: "permission_changed",
      metadata: { targetUserId, permission }
    });

    return perm;
  },

  async deletePermission(docId: string, targetUserId: string, userId: string) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    await this.checkPermission(userId, doc.projectId, "project-doc:manage-permissions");

    await docRepository.deleteDocPermission(docId, targetUserId);

    await docRepository.createActivity({
      docId,
      organizationId: doc.organizationId,
      userId,
      action: "permission_removed",
      metadata: { targetUserId }
    });
  },

  // Breadcrumbs
  async getBreadcrumbs(docId: string, userId: string) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    await this.checkPermission(userId, doc.projectId, "project-doc:view");

    const breadcrumbs = [];
    let current: any = doc;
    while (current) {
      breadcrumbs.unshift({
        id: current.id,
        title: current.title,
        slug: current.slug,
        emoji: current.emoji
      });
      if (current.parentId) {
        current = await prisma.projectDoc.findUnique({
          where: { id: current.parentId }
        });
      } else {
        current = null;
      }
    }
    return breadcrumbs;
  },

  async toggleReaction(commentId: string, emoji: string, userId: string) {
    const comment = await docRepository.getCommentById(commentId);
    if (!comment) throw new NotFoundException("Comment not found");
    await this.checkPermission(userId, comment.doc.projectId, "project-doc:comment");

    return docRepository.toggleReaction({
      commentId,
      userId,
      organizationId: comment.doc.organizationId,
      emoji
    });
  },

  // Activity log
  async getActivities(docId: string, userId: string) {
    const doc = await docRepository.findDocById(docId);
    if (!doc) throw new NotFoundException("Document not found");
    await this.checkPermission(userId, doc.projectId, "project-doc:view");
    return docRepository.getActivities(docId);
  }
};
