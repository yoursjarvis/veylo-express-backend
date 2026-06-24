import prisma from "@/lib/prisma";

export const projectRepository = {
  findTemplateBySlug(slug: string) {
    return prisma.projectTemplate.findUnique({
      where: { slug },
    });
  },

  getTemplates() {
    return prisma.projectTemplate.findMany({
      orderBy: { name: "asc" },
    });
  },

  findWorkspaceById(workspaceId: string) {
    return prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });
  },

  createProject(
    data: {
      title: string;
      description?: string;
      icon?: string;
      template: string;
      teamMode: string;
      workspaceId: string;
      organizationId: string;
    },
    resolvedStatuses: { name: string; category: string; order: number }[],
    resolvedCustomFields: { name: string; type: string }[]
  ) {
    return prisma.project.create({
      data: {
        title: data.title,
        description: data.description,
        icon: data.icon,
        template: data.template,
        teamMode: data.teamMode,
        workspaceId: data.workspaceId,
        organizationId: data.organizationId,
        vault: {
          create: {},
        },
        taskStatuses: {
          createMany: {
            data: resolvedStatuses.map((s) => ({ ...s, organizationId: data.organizationId })),
          },
        },
        customFields:
          resolvedCustomFields.length > 0
            ? {
                createMany: {
                  data: resolvedCustomFields.map((cf) => ({
                    name: cf.name,
                    type: cf.type,
                    organizationId: data.organizationId,
                  })),
                },
              }
            : undefined,
      },
      include: {
        taskStatuses: true,
        customFields: true,
      },
    });
  },

  getProjects(workspaceId: string, canSeeAll: boolean, userId: string) {
    return prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(canSeeAll
          ? {}
          : {
              members: {
                some: { userId },
              },
            }),
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  getProjectDetails(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
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
        },
        _count: {
          select: { members: true },
        },
      },
    });
  },

  updateProject(projectId: string, data: any) {
    return prisma.project.update({
      where: { id: projectId },
      data,
    });
  },

  deleteProject(projectId: string) {
    return prisma.project.delete({
      where: { id: projectId },
    });
  },

  getProjectMembers(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
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

  findWorkspaceMembers(workspaceId: string, userIds: string[]) {
    return prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: userIds },
      },
    });
  },

  upsertProjectMember(projectId: string, userId: string, role: string) {
    return prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {},
      create: { projectId, userId, role },
    });
  },

  deleteProjectMember(projectId: string, userId: string) {
    return prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  },

  findVault(projectId: string) {
    return prisma.vault.findUnique({
      where: { projectId },
      include: {
        services: {
          include: {
            items: {
              orderBy: { key: "asc" },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });
  },

  createVault(projectId: string) {
    return prisma.vault.create({
      data: { projectId },
      include: {
        services: {
          include: {
            items: {
              orderBy: { key: "asc" },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });
  },

  findVaultService(vaultId: string, name: string) {
    return prisma.vaultService.findFirst({
      where: { vaultId, name },
    });
  },

  createVaultService(vaultId: string, name: string) {
    return prisma.vaultService.create({
      data: {
        vaultId,
        name,
      },
    });
  },

  deleteVaultService(serviceId: string) {
    return prisma.vaultService.delete({
      where: { id: serviceId },
    });
  },

  upsertVaultItem(serviceId: string, key: string, value: string, note: string | null) {
    return prisma.vaultItem.upsert({
      where: {
        serviceId_key: { serviceId, key },
      },
      update: {
        value,
        note,
      },
      create: {
        serviceId,
        key,
        value,
        note,
      },
    });
  },

  updateVaultItem(itemId: string, data: any) {
    return prisma.vaultItem.update({
      where: { id: itemId },
      data,
    });
  },

  deleteVaultItem(itemId: string) {
    return prisma.vaultItem.delete({
      where: { id: itemId },
    });
  },

  findProjectFile(projectId: string, fileId: string) {
    return prisma.media.findFirst({
      where: {
        id: fileId,
        modelType: "Project",
        modelId: projectId,
      },
    });
  },
};
