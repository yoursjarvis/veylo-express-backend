import prisma from "@/lib/prisma";

export const workflowRepository = {
  async findTransition(
    projectId: string,
    fromStatusId: string,
    toStatusId: string,
  ) {
    return prisma.workflowTransition.findUnique({
      where: {
        projectId_fromStatusId_toStatusId: {
          projectId,
          fromStatusId,
          toStatusId,
        },
      },
    });
  },

  async createTransition(data: {
    projectId: string;
    organizationId: string;
    fromStatusId: string;
    toStatusId: string;
    requiredRoleId?: string | null;
  }) {
    return prisma.workflowTransition.create({
      data,
    });
  },

  async deleteTransition(id: string) {
    return prisma.workflowTransition.delete({
      where: { id },
    });
  },

  async getTransitionsByProject(projectId: string) {
    return prisma.workflowTransition.findMany({
      where: { projectId },
      include: {
        fromStatus: true,
        toStatus: true,
        requiredRole: true,
      },
    });
  },

  async getTransitionsFromStatus(projectId: string, fromStatusId: string) {
    return prisma.workflowTransition.findMany({
      where: {
        projectId,
        fromStatusId,
      },
      include: {
        toStatus: true,
        requiredRole: true,
      },
    });
  },
};
