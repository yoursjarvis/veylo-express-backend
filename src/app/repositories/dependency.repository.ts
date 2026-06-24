import prisma from "@/lib/prisma";

export const dependencyRepository = {
  async findTaskById(id: string) {
    return prisma.task.findUnique({
      where: { id },
    });
  },

  async getDependencies(taskId: string) {
    // Tasks that BLOCK this task (this task is blocked by them)
    const blockedBy = await prisma.taskDependency.findMany({
      where: { blockedTaskId: taskId },
      include: {
        blockingTask: {
          select: {
            id: true,
            title: true,
            type: true,
            priority: true,
            projectId: true,
            status: { select: { name: true, category: true } },
            project: { select: { title: true } },
          },
        },
      },
    });

    // Tasks that THIS task blocks
    const blocking = await prisma.taskDependency.findMany({
      where: { blockingTaskId: taskId },
      include: {
        blockedTask: {
          select: {
            id: true,
            title: true,
            type: true,
            priority: true,
            projectId: true,
            status: { select: { name: true, category: true } },
            project: { select: { title: true } },
          },
        },
      },
    });

    return { blockedBy, blocking };
  },

  async findDependencyPair(blockingTaskId: string, blockedTaskId: string) {
    return prisma.taskDependency.findFirst({
      where: { blockingTaskId, blockedTaskId },
    });
  },

  async createDependency(blockingTaskId: string, blockedTaskId: string) {
    return prisma.taskDependency.create({
      data: { blockingTaskId, blockedTaskId, dependencyType: "blocks" },
    });
  },

  async createTaskActivity(data: {
    taskId: string;
    userId: string;
    organizationId: string;
    action: string;
    newValue?: string;
    oldValue?: string;
  }) {
    return prisma.taskActivity.create({
      data,
    });
  },

  async findDependencyById(id: string) {
    return prisma.taskDependency.findUnique({
      where: { id },
      include: { blockingTask: true, blockedTask: true },
    });
  },

  async deleteDependency(id: string) {
    return prisma.taskDependency.delete({
      where: { id },
    });
  },
};
