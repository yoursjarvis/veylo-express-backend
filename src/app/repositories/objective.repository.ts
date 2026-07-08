import prisma from "@/lib/prisma";

export const objectiveRepository = {
  findObjectivesByWorkspace(workspaceId: string) {
    return prisma.objective.findMany({
      where: {
        project: {
          workspaceId,
        },
      },
      include: {
        keyResults: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
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
};
