import prisma from "@/lib/prisma";

export const milestoneRepository = {
  async create(data: {
    title: string;
    description?: string | null;
    projectId: string;
    organizationId: string;
    dueDate?: Date | null;
    isCompleted: boolean;
  }) {
    return prisma.milestone.create({
      data,
    });
  },

  async findByProjectId(projectId: string) {
    return prisma.milestone.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.milestone.findUnique({
      where: { id },
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return prisma.milestone.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.milestone.delete({
      where: { id },
    });
  },
};
