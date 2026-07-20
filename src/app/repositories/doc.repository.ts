import prisma from "@/lib/prisma";
import { Prisma } from "../../../generated/prisma/client.js";

export const docRepository = {
  async createDoc(data: {
    projectId: string;
    organizationId: string;
    parentId?: string | null;
    title: string;
    slug: string;
    emoji?: string | null;
    icon?: string | null;
    coverImage?: string | null;
    content?: Record<string, unknown>;
    plainText?: string | null;
    order?: number;
    createdBy: string;
    updatedBy: string;
  }) {
    return prisma.projectDoc.create({
      data: {
        projectId: data.projectId,
        organizationId: data.organizationId,
        parentId: data.parentId ?? null,
        title: data.title,
        slug: data.slug,
        emoji: data.emoji ?? null,
        icon: data.icon ?? null,
        coverImage: data.coverImage ?? null,
        content: (data.content ?? null) as unknown as object,
        plainText: data.plainText ?? null,
        order: data.order ?? 0,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        }
      }
    });
  },

  async findDocById(id: string) {
    return prisma.projectDoc.findFirst({
      where: { id, deleted: false },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        },
        updater: {
          select: { id: true, name: true, image: true }
        },
        permissions: {
          include: {
            user: {
              select: { id: true, name: true, image: true }
            }
          }
        }
      }
    });
  },

  async findDocByIdWithTrashed(id: string) {
    return prisma.projectDoc.findFirst({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        }
      }
    });
  },

  async updateDoc(id: string, data: {
    title?: string;
    slug?: string;
    parentId?: string | null;
    emoji?: string | null;
    icon?: string | null;
    coverImage?: string | null;
    content?: Record<string, unknown>;
    plainText?: string | null;
    order?: number;
    archived?: boolean;
    deleted?: boolean;
    updatedBy: string;
  }) {
    return prisma.projectDoc.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        },
        updater: {
          select: { id: true, name: true, image: true }
        }
      }
    });
  },

  async deleteDoc(id: string, userId: string) {
    return prisma.projectDoc.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date(),
        updatedBy: userId,
      }
    });
  },

  async restoreDoc(id: string, userId: string) {
    return prisma.projectDoc.update({
      where: { id },
      data: {
        deleted: false,
        deletedAt: null,
        updatedBy: userId,
      }
    });
  },

  async getProjectDocs(projectId: string, userId: string) {
    // Return all project docs (excluding deleted ones)
    // and include user's favorite status
    return prisma.projectDoc.findMany({
      where: {
        projectId,
        deleted: false,
      },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        },
        favorites: {
          where: { userId },
          select: { isFavorite: true, isPinned: true }
        },
        permissions: {
          select: { userId: true, permission: true }
        }
      },
      orderBy: [
        { order: "asc" },
        { createdAt: "asc" }
      ]
    });
  },

  async searchDocs(projectId: string, query: string, userId: string) {
    return prisma.projectDoc.findMany({
      where: {
        projectId,
        deleted: false,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { plainText: { contains: query, mode: "insensitive" } },
          {
            comments: {
              some: {
                content: { contains: query, mode: "insensitive" }
              }
            }
          }
        ]
      },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        },
        favorites: {
          where: { userId },
          select: { isFavorite: true, isPinned: true }
        }
      },
      take: 20
    });
  },

  async getRecentDocs(projectId: string, userId: string, limit = 10) {
    return prisma.projectDoc.findMany({
      where: {
        projectId,
        deleted: false,
      },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        },
        favorites: {
          where: { userId },
          select: { isFavorite: true, isPinned: true }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: limit
    });
  },

  // Favorites & Pinned
  async upsertFavorite(docId: string, userId: string, organizationId: string, data: { isFavorite?: boolean; isPinned?: boolean }) {
    return prisma.projectDocFavorite.upsert({
      where: {
        docId_userId: { docId, userId }
      },
      update: data,
      create: {
        docId,
        userId,
        organizationId,
        isFavorite: data.isFavorite ?? false,
        isPinned: data.isPinned ?? false,
      }
    });
  },

  async getFavoritesAndPinned(projectId: string, userId: string) {
    return prisma.projectDoc.findMany({
      where: {
        projectId,
        deleted: false,
        favorites: {
          some: {
            userId,
            OR: [
              { isFavorite: true },
              { isPinned: true }
            ]
          }
        }
      },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        },
        favorites: {
          where: { userId },
          select: { isFavorite: true, isPinned: true }
        }
      }
    });
  },

  // Versions
  async createVersion(data: { docId: string; organizationId: string; content: Record<string, unknown>; createdBy: string; version: number }) {
    return prisma.projectDocVersion.create({
      data: {
        docId: data.docId,
        organizationId: data.organizationId,
        content: data.content,
        createdBy: data.createdBy,
        version: data.version,
      },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        }
      }
    });
  },

  async getVersions(docId: string) {
    return prisma.projectDocVersion.findMany({
      where: { docId },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  },

  async findLatestVersion(docId: string) {
    return prisma.projectDocVersion.findFirst({
      where: { docId },
      orderBy: { version: "desc" }
    });
  },

  async findVersionById(id: string) {
    return prisma.projectDocVersion.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, image: true }
        }
      }
    });
  },

  // Comments
  async createComment(data: { docId: string; userId: string; organizationId: string; parentId?: string | null; content: string }) {
    return prisma.projectDocComment.create({
      data: {
        docId: data.docId,
        userId: data.userId,
        organizationId: data.organizationId,
        parentId: data.parentId ?? null,
        content: data.content,
      },
      include: {
        user: {
          select: { id: true, name: true, image: true }
        },
        reactions: {
          include: {
            user: { select: { id: true, name: true, image: true } }
          }
        },
        replies: {
          include: {
            user: { select: { id: true, name: true, image: true } },
            reactions: {
              include: {
                user: { select: { id: true, name: true, image: true } }
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
  },

  async updateComment(id: string, data: { content?: string; resolved?: boolean }) {
    return prisma.projectDocComment.update({
      where: { id },
      data: {
        ...data,
        isEdited: data.content !== undefined ? true : undefined,
      },
      include: {
        user: {
          select: { id: true, name: true, image: true }
        },
        reactions: {
          include: {
            user: { select: { id: true, name: true, image: true } }
          }
        },
        replies: {
          include: {
            user: { select: { id: true, name: true, image: true } },
            reactions: {
              include: {
                user: { select: { id: true, name: true, image: true } }
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
  },

  async getCommentById(id: string) {
    return prisma.projectDocComment.findUnique({
      where: { id },
      include: {
        doc: true
      }
    });
  },

  async deleteComment(id: string) {
    return prisma.projectDocComment.delete({
      where: { id }
    });
  },

  async getComments(docId: string) {
    return prisma.projectDocComment.findMany({
      where: { docId, parentId: null },
      include: {
        user: {
          select: { id: true, name: true, image: true }
        },
        reactions: {
          include: {
            user: { select: { id: true, name: true, image: true } }
          }
        },
        replies: {
          include: {
            user: {
              select: { id: true, name: true, image: true }
            },
            reactions: {
              include: {
                user: { select: { id: true, name: true, image: true } }
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "asc" }
    });
  },

  // Activities
  async createActivity(data: { docId: string; userId: string; organizationId: string; action: string; metadata?: Record<string, unknown> }) {
    return prisma.projectDocActivity.create({
      data: {
        docId: data.docId,
        userId: data.userId,
        organizationId: data.organizationId,
        action: data.action,
        metadata: (data.metadata ?? null) as unknown as object,
      },
      include: {
        user: {
          select: { id: true, name: true, image: true }
        }
      }
    });
  },

  async getActivities(docId: string) {
    return prisma.projectDocActivity.findMany({
      where: { docId },
      include: {
        user: {
          select: { id: true, name: true, image: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  },

  // Custom document-specific permissions
  async updateDocPermission(docId: string, userId: string, organizationId: string, permission: string) {
    return prisma.projectDocPermission.upsert({
      where: {
        docId_userId: { docId, userId }
      },
      update: { permission },
      create: { docId, userId, organizationId, permission }
    });
  },

  async deleteDocPermission(docId: string, userId: string) {
    return prisma.projectDocPermission.deleteMany({
      where: { docId, userId }
    });
  },

  async getDocPermissions(docId: string) {
    return prisma.projectDocPermission.findMany({
      where: { docId },
      include: {
        user: {
          select: { id: true, name: true, image: true }
        }
      }
    });
  },

  async toggleReaction(data: { commentId: string; userId: string; organizationId: string; emoji: string }) {
    const existing = await prisma.projectDocCommentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId: data.commentId,
          userId: data.userId,
          emoji: data.emoji
        }
      }
    });
    if (existing) {
      return prisma.projectDocCommentReaction.delete({
        where: { id: existing.id }
      });
    } else {
      return prisma.projectDocCommentReaction.create({
        data: {
          commentId: data.commentId,
          userId: data.userId,
          organizationId: data.organizationId,
          emoji: data.emoji
        }
      });
    }
  }
};
