import prisma from "@/lib/prisma";

export const objectiveRepository = {
  findObjectivesByWorkspace(workspaceId: string, withTrashed = false) {
    const queryArgs = {
      where: {
        project: {
          workspaceId,
        },
      },
      include: {
        keyResults: true,
        project: {
          select: {
            title: true,
            icon: true,
          },
        },
        epic: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      } as const,
    };

    if (withTrashed) {
      return prisma.objective.findManyWithTrashed(queryArgs);
    }
    return prisma.objective.findMany(queryArgs);
  },

  findProjectById(id: string) {
    return prisma.project.findUnique({
      where: { id },
    });
  },

  createObjective(data: {
    title: string;
    description?: string;
    projectId: string;
    epicId?: string | null;
    organizationId: string;
    krTitle: string;
    krTarget: string;
  }) {
    return prisma.objective.create({
      data: {
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        epicId: data.epicId,
        organizationId: data.organizationId,
        keyResults: {
          create: {
            title: data.krTitle,
            target: data.krTarget,
            progress: 0,
          },
        },
      },
      include: {
        keyResults: true,
      },
    });
  },

  deleteObjective(id: string) {
    return prisma.objective.delete({
      where: { id },
    });
  },

  findObjectiveByIdWithTrashed(id: string) {
    return prisma.objective.findUniqueWithTrashed({
      where: { id },
    });
  },

  restoreObjective(id: string) {
    return prisma.objective.restore({
      where: { id },
    });
  },

  forceDeleteObjective(id: string) {
    return prisma.objective.forceDelete({
      where: { id },
    });
  },

  async updateObjective(
    id: string,
    data: {
      title?: string;
      description?: string;
      projectId?: string;
      epicId?: string | null;
      krTitle?: string;
      krTarget?: string;
    },
  ) {
    if (data.krTitle !== undefined || data.krTarget !== undefined) {
      const firstKr = await prisma.keyResult.findFirst({
        where: { objectiveId: id },
        orderBy: { createdAt: "asc" },
      });
      if (firstKr) {
        await prisma.keyResult.update({
          where: { id: firstKr.id },
          data: {
            title: data.krTitle,
            target: data.krTarget,
          },
        });
      }
    }

    return prisma.objective.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        epicId: data.epicId,
      },
      include: {
        keyResults: true,
      },
    });
  },
};
