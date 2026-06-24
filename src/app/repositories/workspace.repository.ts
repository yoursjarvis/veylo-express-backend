import prisma from "@/lib/prisma";

export const workspaceRepository = {
  findWorkspaceByIdAndOrg(id: string, orgId: string) {
    return prisma.workspace.findFirst({
      where: { id, organizationId: orgId },
    });
  },

  findWorkspaceBySlug(slug: string) {
    return prisma.workspace.findUnique({
      where: { slug },
    });
  },

  findWorkspaceBySlugExcludeId(slug: string, id: string) {
    return prisma.workspace.findFirst({
      where: { slug, id: { not: id } },
    });
  },

  findOrgMember(orgId: string, userId: string, roles: string[]) {
    return prisma.member.findFirst({
      where: {
        organizationId: orgId,
        userId,
        role: { in: roles },
      },
    });
  },

  findWorkspaceMember(workspaceId: string, userId: string, role?: string) {
    return prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        ...(role ? { role } : {}),
      },
    });
  },

  findWorkspaceMemberWithOrg(workspaceId: string, userId: string, role: string, orgId: string) {
    return prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        role,
        workspace: { organizationId: orgId },
      },
    });
  },

  async getWorkspacesForUser(orgId: string, userId: string) {
    return prisma.workspace.findMany({
      where: {
        organizationId: orgId,
        OR: [
          {
            members: {
              some: { userId },
            },
          },
          {
            organization: {
              members: {
                some: {
                  userId,
                  role: { in: ["owner", "admin"] },
                },
              },
            },
          },
        ],
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async createWorkspace(data: { name: string; slug: string; organizationId: string; creatorUserId: string }) {
    return prisma.workspace.create({
      data: {
        name: data.name,
        slug: data.slug,
        organizationId: data.organizationId,
        members: {
          create: {
            userId: data.creatorUserId,
            role: "admin",
          },
        },
      },
    });
  },

  updateWorkspace(id: string, data: any) {
    return prisma.workspace.update({
      where: { id },
      data,
    });
  },

  deleteWorkspace(id: string) {
    return prisma.workspace.delete({
      where: { id },
    });
  },

  async syncOrgAdminsToWorkspaces(organizationId: string) {
    const orgAdmins = await prisma.member.findMany({
      where: {
        organizationId,
        role: { in: ["owner", "admin"] },
      },
      select: { userId: true },
    });

    if (orgAdmins.length === 0) return;

    const workspaces = await prisma.workspace.findMany({
      where: { organizationId },
      select: { id: true },
    });

    if (workspaces.length === 0) return;

    const createData: { workspaceId: string; userId: string; role: string }[] = [];

    for (const admin of orgAdmins) {
      for (const workspace of workspaces) {
        createData.push({
          workspaceId: workspace.id,
          userId: admin.userId,
          role: "admin",
        });
      }
    }

    if (createData.length > 0) {
      await prisma.workspaceMember.createMany({
        data: createData,
        skipDuplicates: true,
      });
    }
  },

  getWorkspaceMembers(workspaceId: string, orgId: string) {
    return prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        workspace: { organizationId: orgId },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  },

  getOrgMembersByIds(orgId: string, userIds: string[]) {
    return prisma.member.findMany({
      where: {
        organizationId: orgId,
        userId: { in: userIds },
      },
    });
  },

  upsertWorkspaceMember(workspaceId: string, userId: string, role: string) {
    return prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      update: {},
      create: { workspaceId, userId, role },
    });
  },

  deleteWorkspaceMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  },
};
