import prisma from "@/lib/prisma";

export const sprintRepository = {
  async create(data: {
    name: string;
    goal?: string | null;
    projectId: string;
    organizationId: string;
    startDate?: Date | null;
    endDate?: Date | null;
    status: string;
  }) {
    return prisma.sprint.create({
      data,
    });
  },

  async findByProjectId(projectId: string) {
    return prisma.sprint.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.sprint.findUnique({
      where: { id },
    });
  },

  async findByIdWithTasks(id: string) {
    return prisma.sprint.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            status: true,
            assignee: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });
  },

  async findFirstActiveByProjectId(projectId: string) {
    return prisma.sprint.findFirst({
      where: { projectId, status: "active" },
    });
  },

  async findSprintInProject(id: string, projectId: string) {
    return prisma.sprint.findFirst({
      where: { id, projectId },
    });
  },

  async findUncompletedTasksInSprint(sprintId: string) {
    return prisma.task.findMany({
      where: {
        sprintId,
        deletedAt: null,
        status: {
          category: { not: "done" },
        },
      },
    });
  },

  async updateTasksSprint(taskIds: string[], destSprintId: string | null) {
    return prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { sprintId: destSprintId },
    });
  },

  async createTaskActivities(
    logPayloads: {
      taskId: string;
      userId: string;
      organizationId: string;
      action: string;
      oldValue?: string;
      newValue?: string;
    }[],
  ) {
    return prisma.taskActivity.createMany({
      data: logPayloads,
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return prisma.sprint.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.sprint.delete({
      where: { id },
    });
  },

  async findByIdWithTrashed(id: string) {
    return prisma.sprint.findUniqueWithTrashed({
      where: { id },
    });
  },

  async restore(id: string) {
    return prisma.sprint.restore({
      where: { id },
    });
  },

  async forceDelete(id: string) {
    return prisma.sprint.forceDelete({
      where: { id },
    });
  },
};
