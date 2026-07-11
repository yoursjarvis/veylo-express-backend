import prisma from "@/lib/prisma";

import { Prisma } from "../../../generated/prisma/client.js";

export const portfolioService = {
  async getPortfolios(
    workspaceId: string,
    options: { withTrashed?: boolean; onlyTrashed?: boolean } = {}
  ) {
    const where: Prisma.PortfolioWhereInput = { workspaceId };

    if (options.onlyTrashed) {
      where.deletedAt = { not: null };
    } else if (options.withTrashed) {
      // No filter, returns both active and deleted
    } else {
      where.deletedAt = null;
    }

    const queryOptions = {
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        projects: {
          include: {
            project: {
              include: {
                owner: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
                tasks: {
                  select: {
                    dueDate: true,
                    status: {
                      select: {
                        category: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" as const },
    };

    const portfolios = (options.withTrashed || options.onlyTrashed)
      ? await prisma.portfolio.findManyWithTrashed(queryOptions)
      : await prisma.portfolio.findMany(queryOptions);

    return portfolios.map((portfolio) => {
      const projects = portfolio.projects.map((pp) => {
        const proj = pp.project;
        const totalTasks = proj.tasks.length;
        const completedTasks = proj.tasks.filter((t) => t.status.category === "done").length;
        const delayedTasks = proj.tasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status.category !== "done"
        ).length;

        return {
          id: proj.id,
          projectKey: proj.projectKey,
          title: proj.title,
          description: proj.description,
          icon: proj.icon,
          status: proj.status,
          priority: proj.priority,
          startDate: proj.startDate,
          endDate: proj.endDate,
          owner: proj.owner,
          progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          completedTasks,
          totalTasks,
          delayedTasks,
        };
      });

      return {
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        workspaceId: portfolio.workspaceId,
        organizationId: portfolio.organizationId,
        ownerId: portfolio.ownerId,
        deletedAt: portfolio.deletedAt,
        createdAt: portfolio.createdAt,
        updatedAt: portfolio.updatedAt,
        owner: portfolio.owner,
        projects,
      };
    });
  },

  async getPortfolioById(id: string, options: { withTrashed?: boolean } = {}) {
    const queryOptions = {
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        projects: {
          include: {
            project: {
              include: {
                owner: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
                tasks: {
                  select: {
                    dueDate: true,
                    status: {
                      select: {
                        category: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const portfolio = options.withTrashed
      ? await prisma.portfolio.findUniqueWithTrashed(queryOptions)
      : await prisma.portfolio.findUnique(queryOptions);

    if (!portfolio) return null;

    const projects = portfolio.projects.map((pp) => {
      const proj = pp.project;
      const totalTasks = proj.tasks.length;
      const completedTasks = proj.tasks.filter((t) => t.status.category === "done").length;
      const delayedTasks = proj.tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status.category !== "done"
      ).length;

      return {
        id: proj.id,
        projectKey: proj.projectKey,
        title: proj.title,
        description: proj.description,
        icon: proj.icon,
        status: proj.status,
        priority: proj.priority,
        startDate: proj.startDate,
        endDate: proj.endDate,
        owner: proj.owner,
        progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        completedTasks,
        totalTasks,
        delayedTasks,
      };
    });

    return {
      id: portfolio.id,
      name: portfolio.name,
      description: portfolio.description,
      workspaceId: portfolio.workspaceId,
      organizationId: portfolio.organizationId,
      ownerId: portfolio.ownerId,
      deletedAt: portfolio.deletedAt,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
      owner: portfolio.owner,
      projects,
    };
  },

  async createPortfolio(
    workspaceId: string,
    organizationId: string,
    ownerId: string,
    data: { name: string; description?: string | null; projectIds: string[] }
  ) {
    return prisma.$transaction(async (tx) => {
      const portfolio = await tx.portfolio.create({
        data: {
          name: data.name,
          description: data.description,
          workspaceId,
          organizationId,
          ownerId,
        },
      });

      if (data.projectIds.length > 0) {
        await tx.portfolioProject.createMany({
          data: data.projectIds.map((projectId) => ({
            portfolioId: portfolio.id,
            projectId,
          })),
        });
      }

      return portfolio;
    });
  },

  async updatePortfolio(
    id: string,
    data: { name?: string; description?: string | null; projectIds?: string[] }
  ) {
    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.PortfolioUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;

      const portfolio = await tx.portfolio.update({
        where: { id },
        data: updateData,
      });

      if (data.projectIds !== undefined) {
        await tx.portfolioProject.deleteMany({
          where: { portfolioId: id },
        });

        if (data.projectIds.length > 0) {
          await tx.portfolioProject.createMany({
            data: data.projectIds.map((projectId) => ({
              portfolioId: id,
              projectId,
            })),
          });
        }
      }

      return portfolio;
    });
  },

  async deletePortfolio(id: string) {
    return prisma.portfolio.delete({
      where: { id },
    });
  },

  async restorePortfolio(id: string) {
    return prisma.portfolio.restore({
      where: { id },
    });
  },

  async forceDeletePortfolio(id: string) {
    return prisma.portfolio.forceDelete({
      where: { id },
    });
  },
};
