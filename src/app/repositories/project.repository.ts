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
      projectKey: string;
      description?: string;
      icon?: string;
      template: string;
      teamMode: string;
      workspaceId: string;
      organizationId: string;
    },
    resolvedStatuses: {
      name: string;
      category: string;
      order: number;
      color?: string;
      progressWeight?: number;
    }[],
    resolvedCustomFields: { name: string; type: string }[],
  ) {
    return prisma.project.create({
      data: {
        title: data.title,
        projectKey: data.projectKey,
        description: data.description,
        icon: data.icon,
        template: data.template,
        teamMode: data.teamMode,
        workspaceId: data.workspaceId,
        organizationId: data.organizationId,
        vault: {
          create: {
            organizationId: data.organizationId,
          },
        },
        taskStatuses: {
          createMany: {
            data: resolvedStatuses.map((s) => ({
              ...s,
              organizationId: data.organizationId,
            })),
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

  getProjects(
    workspaceId: string,
    canSeeAll: boolean,
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      includeDeleted?: boolean;
      onlyDeleted?: boolean;
      status?: string;
      memberIds?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {},
  ) {
    const {
      page,
      limit,
      search,
      includeDeleted,
      onlyDeleted,
      status,
      memberIds,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = filters;

    const skip = page && limit ? (page - 1) * limit : undefined;
    const take = limit ? limit : undefined;

    // Trashed status filtering
    const deletedAtClause = onlyDeleted
      ? { not: null }
      : includeDeleted
        ? undefined
        : null;

    // Status filter
    const statusClause = status ? { in: status.split(",") } : undefined;

    // Search clause
    const searchClause = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { projectKey: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    // Member filter clause
    const memberClause = memberIds
      ? {
          members: {
            some: {
              userId: { in: memberIds.split(",") },
            },
          },
        }
      : undefined;

    // Date range filter clause
    const dateClause =
      startDate || endDate
        ? {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate
              ? (() => {
                  const endOfEndDate = new Date(endDate);
                  endOfEndDate.setHours(23, 59, 59, 999);
                  return endOfEndDate;
                })()
              : undefined,
          }
        : undefined;

    return prisma.project.findManyWithTrashed({
      where: {
        workspaceId,
        deletedAt: deletedAtClause,
        status: statusClause,
        createdAt: dateClause,
        ...searchClause,
        ...memberClause,
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
      },
      orderBy:
        sortBy &&
        ["title", "createdAt", "startDate", "endDate"].includes(sortBy)
          ? { [sortBy]: sortOrder === "asc" ? "asc" : "desc" }
          : { createdAt: "desc" },
      skip,
      take,
    });
  },

  getOrgProjects(
    organizationId: string,
    canSeeAll: boolean,
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      includeDeleted?: boolean;
      onlyDeleted?: boolean;
      status?: string;
      memberIds?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {},
  ) {
    const {
      page,
      limit,
      search,
      includeDeleted,
      onlyDeleted,
      status,
      memberIds,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = filters;

    const skip = page && limit ? (page - 1) * limit : undefined;
    const take = limit ? limit : undefined;

    // Trashed status filtering
    const deletedAtClause = onlyDeleted
      ? { not: null }
      : includeDeleted
        ? undefined
        : null;

    // Status filter
    const statusClause = status ? { in: status.split(",") } : undefined;

    // Search clause
    const searchClause = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { projectKey: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    // Member filter clause
    const memberClause = memberIds
      ? {
          members: {
            some: {
              userId: { in: memberIds.split(",") },
            },
          },
        }
      : undefined;

    // Date range filter clause
    const dateClause =
      startDate || endDate
        ? {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate
              ? (() => {
                  const endOfEndDate = new Date(endDate);
                  endOfEndDate.setHours(23, 59, 59, 999);
                  return endOfEndDate;
                })()
              : undefined,
          }
        : undefined;

    return prisma.project.findManyWithTrashed({
      where: {
        organizationId,
        deletedAt: deletedAtClause,
        status: statusClause,
        createdAt: dateClause,
        ...searchClause,
        ...memberClause,
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
      },
      orderBy:
        sortBy &&
        ["title", "createdAt", "startDate", "endDate"].includes(sortBy)
          ? { [sortBy]: sortOrder === "asc" ? "asc" : "desc" }
          : { createdAt: "desc" },
      skip,
      take,
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

  updateProject(projectId: string, data: Record<string, unknown>) {
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

  async upsertProjectMember(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Project not found");
    return prisma.projectMember.upsert({
      where: {
        projectId_userId_organizationId: {
          projectId,
          userId,
          organizationId: project.organizationId,
        },
      },
      update: {},
      create: {
        projectId,
        userId,
        organizationId: project.organizationId,
      },
    });
  },

  async deleteProjectMember(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Project not found");
    return prisma.projectMember.delete({
      where: {
        projectId_userId_organizationId: {
          projectId,
          userId,
          organizationId: project.organizationId,
        },
      },
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

  async createVault(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Project not found");
    return prisma.vault.create({
      data: { projectId, organizationId: project.organizationId },
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

  async createVaultService(vaultId: string, name: string) {
    const vault = await prisma.vault.findUnique({
      where: { id: vaultId },
      select: { organizationId: true },
    });
    if (!vault) throw new Error("Vault not found");
    return prisma.vaultService.create({
      data: {
        vaultId,
        name,
        organizationId: vault.organizationId,
      },
    });
  },

  deleteVaultService(serviceId: string) {
    return prisma.vaultService.delete({
      where: { id: serviceId },
    });
  },

  async upsertVaultItem(
    serviceId: string,
    key: string,
    value: string,
    note: string | null,
  ) {
    const service = await prisma.vaultService.findUnique({
      where: { id: serviceId },
      select: { organizationId: true },
    });
    if (!service) throw new Error("Vault service not found");
    return prisma.vaultItem.upsert({
      where: {
        serviceId_key_organizationId: {
          serviceId,
          key,
          organizationId: service.organizationId,
        },
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
        organizationId: service.organizationId,
      },
    });
  },

  updateVaultItem(itemId: string, data: Record<string, unknown>) {
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

  findAutomationRules(projectId: string) {
    return prisma.automationRule.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  },

  findAutomationRuleById(ruleId: string) {
    return prisma.automationRule.findUnique({
      where: { id: ruleId },
    });
  },

  async createAutomationRule(
    projectId: string,
    data: {
      name: string;
      trigger: string;
      triggerVal?: string | null;
      action: string;
      actionVal?: string | null;
      isActive?: boolean;
    },
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Project not found");
    return prisma.automationRule.create({
      data: {
        projectId,
        organizationId: project.organizationId,
        name: data.name,
        trigger: data.trigger,
        triggerVal: data.triggerVal ?? null,
        action: data.action,
        actionVal: data.actionVal ?? null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  },

  updateAutomationRule(
    ruleId: string,
    data: {
      name?: string;
      trigger?: string;
      triggerVal?: string | null;
      action?: string;
      actionVal?: string | null;
      isActive?: boolean;
    },
  ) {
    return prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        name: data.name,
        trigger: data.trigger,
        triggerVal: data.triggerVal,
        action: data.action,
        actionVal: data.actionVal,
        isActive: data.isActive,
      },
    });
  },

  deleteAutomationRule(ruleId: string) {
    return prisma.automationRule.delete({
      where: { id: ruleId },
    });
  },

  findProjectByIdWithTrashed(projectId: string) {
    return prisma.project.findUniqueWithTrashed({
      where: { id: projectId },
    });
  },

  restoreProject(projectId: string) {
    return prisma.project.restore({
      where: { id: projectId },
    });
  },

  forceDeleteProject(projectId: string) {
    return prisma.project.forceDelete({
      where: { id: projectId },
    });
  },

  findVaultServiceByIdWithTrashed(serviceId: string) {
    return prisma.vaultService.findUniqueWithTrashed({
      where: { id: serviceId },
    });
  },

  restoreVaultService(serviceId: string) {
    return prisma.vaultService.restore({
      where: { id: serviceId },
    });
  },

  forceDeleteVaultService(serviceId: string) {
    return prisma.vaultService.forceDelete({
      where: { id: serviceId },
    });
  },

  findVaultItemByIdWithTrashed(itemId: string) {
    return prisma.vaultItem.findUniqueWithTrashed({
      where: { id: itemId },
    });
  },

  restoreVaultItem(itemId: string) {
    return prisma.vaultItem.restore({
      where: { id: itemId },
    });
  },

  forceDeleteVaultItem(itemId: string) {
    return prisma.vaultItem.forceDelete({
      where: { id: itemId },
    });
  },

  findAutomationRuleByIdWithTrashed(ruleId: string) {
    return prisma.automationRule.findUniqueWithTrashed({
      where: { id: ruleId },
    });
  },

  restoreAutomationRule(ruleId: string) {
    return prisma.automationRule.restore({
      where: { id: ruleId },
    });
  },

  forceDeleteAutomationRule(ruleId: string) {
    return prisma.automationRule.forceDelete({
      where: { id: ruleId },
    });
  },
};
