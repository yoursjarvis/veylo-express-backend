import prisma from "@/lib/prisma";

export const orgMembersRepository = {
  async findCallerMember(organizationId: string, userId: string) {
    return prisma.member.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ["owner", "admin"] },
      },
    });
  },

  async findTargetMember(organizationId: string, targetUserId: string) {
    return prisma.member.findFirst({
      where: {
        organizationId,
        userId: targetUserId,
      },
    });
  },

  async banUser(id: string, reason: string) {
    return prisma.user.update({
      where: { id },
      data: {
        banned: true,
        banReason: reason,
      },
    });
  },

  async unbanUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        banned: false,
        banReason: null,
        banExpires: null,
      },
    });
  },

  async deleteSessionsByUserId(userId: string) {
    return prisma.session.deleteMany({
      where: { userId },
    });
  },

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  async createSession(data: {
    userId: string;
    token: string;
    expiresAt: Date;
    impersonatedBy: string;
  }) {
    return prisma.session.create({
      data,
    });
  },

  async findMembers(params: {
    activeOrgId: string;
    limit: number;
    cursor?: string;
    search?: string;
    role?: string;
    status?: string;
  }) {
    const where: any = {
      organizationId: params.activeOrgId,
    };

    if (params.role) {
      where.role = params.role;
    }

    if (params.search || params.status) {
      where.user = {};
      if (params.search) {
        where.user.OR = [
          { name: { contains: params.search, mode: "insensitive" } },
          { email: { contains: params.search, mode: "insensitive" } },
        ];
      }
      if (params.status === "banned") {
        where.user.banned = true;
      } else if (params.status === "active") {
        where.user.banned = false;
      }
    }

    return prisma.member.findMany({
      where,
      take: params.limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            banned: true,
            banReason: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    });
  },

  async findInvitationById(id: string) {
    return prisma.invitation.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });
  },

  async findPendingInvitations(organizationId: string) {
    return prisma.invitation.findMany({
      where: {
        organizationId,
        status: "pending",
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findInvitationInOrg(id: string, organizationId: string) {
    return prisma.invitation.findFirst({
      where: {
        id,
        organizationId,
      },
    });
  },
};
