import { notificationRepository } from "@/app/repositories/notification.repository";
import { NotFoundException } from "@/utils/app-error";

export const notificationService = {
  // Controller service methods
  async getUserNotifications(recipientId: string) {
    return notificationRepository.getNotifications(recipientId);
  },

  async markNotificationAsRead(recipientId: string, notificationId: string) {
    const notification = await notificationRepository.findById(notificationId);
    if (!notification || notification.recipientId !== recipientId) {
      throw new NotFoundException("Notification not found");
    }
    return notificationRepository.markAsRead(notificationId);
  },

  async markAllUserNotificationsAsRead(recipientId: string) {
    return notificationRepository.markAllAsRead(recipientId);
  },

  // Dispatch a Slack webhook payload
  async dispatchSlackWebhook(projectId: string, text: string) {
    try {
      const webhooks = await notificationRepository.findActiveSlackWebhooks(projectId);

      for (const webhook of webhooks) {
        // Native fetch call to post to Slack
        await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            channel: webhook.channel || undefined,
          }),
        }).catch((err) => {
          console.error(`Failed to send slack webhook to ${webhook.url}:`, err);
        });
      }
    } catch (error) {
      console.error("Error dispatching Slack webhook:", error);
    }
  },

  // Create an in-app notification
  async createInAppNotification(data: {
    recipientId: string;
    senderId?: string | null;
    taskId?: string | null;
    organizationId: string;
    type: string;
    title: string;
    message: string;
  }) {
    try {
      // Don't notify yourself
      if (data.recipientId === data.senderId) {
        return;
      }
      await notificationRepository.createNotification(data);
    } catch (error) {
      console.error("Error creating in-app notification:", error);
    }
  },

  // Handle task created notifications
  async handleTaskCreated(taskId: string, creatorId: string) {
    try {
      const task = await notificationRepository.findTaskForNotification(taskId);

      if (!task) return;

      const creatorName = task.creator.name;

      // 1. In-app notification to Assignee
      if (task.assigneeId) {
        await this.createInAppNotification({
          recipientId: task.assigneeId,
          senderId: creatorId,
          taskId: task.id,
          organizationId: task.organizationId,
          type: "assignment",
          title: "New Task Assigned",
          message: `${creatorName} assigned you a new task: "${task.title}"`,
        });
      }

      // 2. Slack Notification
      const slackMessage =
        `*New Task Created* in project *${task.project.title}*\n` +
        `• *Title*: ${task.title}\n` +
        `• *Priority*: ${task.priority.toUpperCase()}\n` +
        `• *Status*: ${task.status.name}\n` +
        `• *Assignee*: ${task.assignee?.name || "Unassigned"}\n` +
        `• *Created By*: ${creatorName}`;
      await this.dispatchSlackWebhook(task.projectId, slackMessage);
    } catch (error) {
      console.error("Error in handleTaskCreated notification:", error);
    }
  },

  // Handle task updated notifications
  async handleTaskUpdated(taskId: string, updaterId: string, oldTask: Record<string, unknown>) {
    try {
      const task = await notificationRepository.findTaskForNotification(taskId);

      if (!task) return;

      const updater = await notificationRepository.findUserName(updaterId);
      const updaterName = updater?.name || "Someone";

      const changes: string[] = [];

      // Status change check
      if (oldTask.statusId !== task.statusId) {
        changes.push(`Status updated from *${oldTask.statusName as string}* to *${task.status.name}*`);

        const notifyIds = new Set<string>();
        if (task.assigneeId) notifyIds.add(task.assigneeId);
        if (task.creatorId) notifyIds.add(task.creatorId);

        for (const recipientId of notifyIds) {
          await this.createInAppNotification({
            recipientId,
            senderId: updaterId,
            taskId: task.id,
            organizationId: task.organizationId,
            type: "status_change",
            title: "Task Status Updated",
            message: `${updaterName} updated the status of "${task.title}" to "${task.status.name}"`,
          });
        }
      }

      // Assignee change check
      if (oldTask.assigneeId !== task.assigneeId) {
        const oldAssigneeName = (oldTask.assigneeName as string) || "Unassigned";
        changes.push(`Assignee updated from *${oldAssigneeName}* to *${task.assignee?.name || "Unassigned"}*`);

        if (task.assigneeId) {
          await this.createInAppNotification({
            recipientId: task.assigneeId,
            senderId: updaterId,
            taskId: task.id,
            organizationId: task.organizationId,
            type: "assignment",
            title: "Task Assigned to You",
            message: `${updaterName} assigned the task "${task.title}" to you.`,
          });
        }
      }

      if (changes.length > 0) {
        const slackMessage =
          `*Task Updated*: *${task.title}* (Project: *${task.project.title}*)\n` +
          `• *Updated By*: ${updaterName}\n` +
          changes.map((c) => `• ${c}`).join("\n");
        await this.dispatchSlackWebhook(task.projectId, slackMessage);
      }
    } catch (error) {
      console.error("Error in handleTaskUpdated notification:", error);
    }
  },

  // Handle comment notifications and parse mentions
  async handleCommentAdded(commentId: string, authorId: string) {
    try {
      const comment = await notificationRepository.findCommentForNotification(commentId);

      if (!comment) return;

      const authorName = comment.user.name;
      const task = comment.task;

      // 1. In-app notifications for @mentions
      const mentionRegex = /@([A-Za-z0-9_]+(?:\s+[A-Za-z0-9_]+)?)/g;
      let match;
      const mentionedNames = new Set<string>();
      while ((match = mentionRegex.exec(comment.content)) !== null) {
        mentionedNames.add(match[1].trim());
      }

      const notifiedUserIds = new Set<string>();

      if (mentionedNames.size > 0) {
        const projectMembers = await notificationRepository.findProjectMembers(task.projectId);

        for (const member of projectMembers) {
          const u = member.user;
          const isMentioned = Array.from(mentionedNames).some(
            (name) => name.toLowerCase() === u.name.toLowerCase()
          );

          if (isMentioned && u.id !== authorId) {
            notifiedUserIds.add(u.id);
            await this.createInAppNotification({
              recipientId: u.id,
              senderId: authorId,
              taskId: task.id,
              organizationId: task.organizationId,
              type: "mention",
              title: "Mentioned in Comment",
              message: `${authorName} mentioned you in a comment on "${task.title}": "${comment.content.slice(0, 50)}..."`,
            });
          }
        }
      }

      // 2. In-app notification to Assignee (if not already notified via mention)
      if (task.assigneeId && task.assigneeId !== authorId && !notifiedUserIds.has(task.assigneeId)) {
        await this.createInAppNotification({
          recipientId: task.assigneeId,
          senderId: authorId,
          taskId: task.id,
          organizationId: task.organizationId,
          type: "comment",
          title: "New Comment on Task",
          message: `${authorName} commented on task "${task.title}"`,
        });
      }

      // 3. Slack Webhook Notification
      const slackMessage =
        `*New Comment* by *${authorName}* on task *${task.title}*\n` +
        `> ${comment.content}`;
      await this.dispatchSlackWebhook(task.projectId, slackMessage);
    } catch (error) {
      console.error("Error in handleCommentAdded notification:", error);
    }
  },
};
