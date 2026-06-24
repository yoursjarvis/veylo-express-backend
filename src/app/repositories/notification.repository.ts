import prisma from "@/lib/prisma";

export const notificationRepository = {
  // Controller database access
  async getNotifications(recipientId: string) {
    return prisma.notification.findMany({
      where: { recipientId },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        task: { select: { id: true, title: true, projectId: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.notification.findUnique({
      where: { id },
    });
  },

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  },

  async markAllAsRead(recipientId: string) {
    return prisma.notification.updateMany({
      where: { recipientId, isRead: false },
      data: { isRead: true },
    });
  },

  // Service database access
  async findActiveSlackWebhooks(projectId: string) {
    return prisma.slackWebhook.findMany({
      where: { projectId, isActive: true },
    });
  },

  async createNotification(data: {
    recipientId: string;
    senderId?: string | null;
    taskId?: string | null;
    organizationId: string;
    type: string;
    title: string;
    message: string;
  }) {
    return prisma.notification.create({
      data: {
        recipientId: data.recipientId,
        senderId: data.senderId ?? null,
        taskId: data.taskId ?? null,
        organizationId: data.organizationId,
        type: data.type,
        title: data.title,
        message: data.message,
      },
    });
  },

  async findTaskForNotification(taskId: string) {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        creator: { select: { name: true } },
        assignee: { select: { id: true, name: true } },
        status: true,
      },
    });
  },

  async findUserName(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
  },

  async findCommentForNotification(commentId: string) {
    return prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: {
          include: {
            project: true,
            assignee: { select: { id: true } },
          },
        },
        user: { select: { name: true } },
      },
    });
  },

  async findProjectMembers(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
    });
  },
};
