import prisma from "@/lib/prisma";

export const epicRepository = {
  async create(data: {
    title: string;
    description?: string | null;
    color?: string;
    projectId: string;
    organizationId: string;
    startDate?: Date | null;
    endDate?: Date | null;
    status: string;
  }) {
    return prisma.epic.create({
      data,
    });
  },

  async findByProjectId(projectId: string) {
    return prisma.epic.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.epic.findUnique({
      where: { id },
    });
  },

  async findByIdWithTasks(id: string) {
    return prisma.epic.findUnique({
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

  async update(id: string, data: Record<string, any>) {
    return prisma.epic.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.epic.delete({
      where: { id },
    });
  },
};
