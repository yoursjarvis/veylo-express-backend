import prisma from "@/lib/prisma";

export const slackWebhookRepository = {
  async findByProjectId(projectId: string) {
    return prisma.slackWebhook.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: {
    projectId: string;
    url: string;
    channel?: string | null;
    isActive: boolean;
  }) {
    return prisma.slackWebhook.create({
      data,
    });
  },

  async findById(id: string) {
    return prisma.slackWebhook.findUnique({
      where: { id },
    });
  },

  async delete(id: string) {
    return prisma.slackWebhook.delete({
      where: { id },
    });
  },
};
