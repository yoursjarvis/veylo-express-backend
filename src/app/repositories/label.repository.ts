import prisma from "@/lib/prisma";

export const labelRepository = {
  async findByNameAndProjectId(name: string, projectId: string) {
    return prisma.label.findUnique({
      where: {
        projectId_name: {
          projectId,
          name,
        },
      },
    });
  },

  async create(data: {
    name: string;
    color: string;
    projectId: string;
    organizationId: string;
  }) {
    return prisma.label.create({
      data,
    });
  },

  async findByProjectId(projectId: string) {
    return prisma.label.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.label.findUnique({
      where: { id },
    });
  },

  async findDuplicateName(projectId: string, name: string, excludeId: string) {
    return prisma.label.findFirst({
      where: {
        projectId,
        name,
        id: { not: excludeId },
      },
    });
  },

  async update(id: string, data: { name?: string; color?: string }) {
    return prisma.label.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.label.delete({
      where: { id },
    });
  },

  async findByIdWithTrashed(id: string) {
    return prisma.label.findUniqueWithTrashed({
      where: { id },
    });
  },

  async restore(id: string) {
    return prisma.label.restore({
      where: { id },
    });
  },

  async forceDelete(id: string) {
    return prisma.label.forceDelete({
      where: { id },
    });
  },
};
