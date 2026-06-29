import { notificationRepository } from "@/app/repositories/notification.repository";
import prisma from "@/lib/prisma";
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
      const webhooks =
        await notificationRepository.findActiveSlackWebhooks(projectId);

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
    projectId?: string | null;
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

      // Check recipient notification preferences
      const preferencesRecord = await notificationRepository.getUserPreferences(
        data.recipientId,
      );
      let channels = { in_app: true, email: true, push: true };

      if (preferencesRecord && preferencesRecord.notificationPreferences) {
        try {
          const preferences = JSON.parse(
            preferencesRecord.notificationPreferences,
          );
          if (preferences && typeof preferences === "object") {
            const types = preferences.types || preferences;
            // If explicitly set to false, skip notification creation completely
            if (types[data.type] === false) {
              return;
            }

            if (
              preferences.channels &&
              typeof preferences.channels === "object"
            ) {
              channels = {
                ...channels,
                ...preferences.channels,
              };
            }
          }
        } catch (e) {
          console.error("Failed to parse user notification preferences", e);
        }
      }

      // 1. IN APP CHANNEL
      if (channels.in_app !== false) {
        await notificationRepository.createNotification(data);
      }

      // 2. EMAIL CHANNEL
      if (channels.email !== false) {
        try {
          const recipientUser = await prisma.user.findUnique({
            where: { id: data.recipientId },
            select: { email: true, name: true },
          });

          if (recipientUser?.email) {
            const { mailService } = await import("@/core/mail");
            await mailService
              .to(recipientUser.email, recipientUser.name)
              .view("notification", {
                title: data.title,
                message: data.message,
              })
              .queue();
          }
        } catch (mailErr) {
          console.error("Failed to queue email notification:", mailErr);
        }
      }
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

      // Handle mentions in description
      if (task.description) {
        await this.handleMentionsInDescription(
          task.id,
          creatorId,
          task.description,
        );
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
  async handleTaskUpdated(
    taskId: string,
    updaterId: string,
    oldTask: Record<string, unknown>,
  ) {
    try {
      const task = await notificationRepository.findTaskForNotification(taskId);

      if (!task) return;

      const updater = await notificationRepository.findUserName(updaterId);
      const updaterName = updater?.name || "Someone";

      const changes: string[] = [];

      // Status change check
      if (oldTask.statusId !== task.statusId) {
        changes.push(
          `Status updated from *${oldTask.statusName as string}* to *${task.status.name}*`,
        );

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
        const oldAssigneeName =
          (oldTask.assigneeName as string) || "Unassigned";
        changes.push(
          `Assignee updated from *${oldAssigneeName}* to *${task.assignee?.name || "Unassigned"}*`,
        );

        // Notify new assignee
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

        // Notify old assignee if removed
        if (
          oldTask.assigneeId &&
          oldTask.assigneeId !== task.assigneeId &&
          oldTask.assigneeId !== updaterId
        ) {
          await this.createInAppNotification({
            recipientId: oldTask.assigneeId as string,
            senderId: updaterId,
            taskId: task.id,
            organizationId: task.organizationId,
            type: "assignment_removed",
            title: "Removed from Task",
            message: `${updaterName} removed you from the task "${task.title}".`,
          });
        }
      }

      // Handle mentions in description if description changed
      if (oldTask.description !== task.description && task.description) {
        await this.handleMentionsInDescription(
          task.id,
          updaterId,
          task.description,
          oldTask.description as string,
        );
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
      const comment =
        await notificationRepository.findCommentForNotification(commentId);

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
        const projectMembers = await notificationRepository.findProjectMembers(
          task.projectId,
        );

        for (const member of projectMembers) {
          const u = member.user;
          const isMentioned = Array.from(mentionedNames).some(
            (name) => name.toLowerCase() === u.name.toLowerCase(),
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

      // 2. In-app notification for Comment Reply
      if (
        comment.parentId &&
        comment.parent &&
        comment.parent.userId !== authorId &&
        !notifiedUserIds.has(comment.parent.userId)
      ) {
        notifiedUserIds.add(comment.parent.userId);
        await this.createInAppNotification({
          recipientId: comment.parent.userId,
          senderId: authorId,
          taskId: task.id,
          organizationId: task.organizationId,
          type: "reply",
          title: "New Reply to Your Comment",
          message: `${authorName} replied to your comment: "${comment.content.slice(0, 50)}..."`,
        });
      }

      // 3. In-app notification to Assignee (if not already notified via mention/reply)
      if (
        task.assigneeId &&
        task.assigneeId !== authorId &&
        !notifiedUserIds.has(task.assigneeId)
      ) {
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

      // 4. Slack Webhook Notification
      const slackMessage =
        `*New Comment* by *${authorName}* on task *${task.title}*\n` +
        `> ${comment.content}`;
      await this.dispatchSlackWebhook(task.projectId, slackMessage);
    } catch (error) {
      console.error("Error in handleCommentAdded notification:", error);
    }
  },

  // Parse and handle mentions in task description
  async handleMentionsInDescription(
    taskId: string,
    authorId: string,
    newDescription: string,
    oldDescription?: string,
  ) {
    try {
      if (!newDescription) return;
      const mentionRegex = /@([A-Za-z0-9_]+(?:\s+[A-Za-z0-9_]+)?)/g;

      const newMentions = new Set<string>();
      let match;
      while ((match = mentionRegex.exec(newDescription)) !== null) {
        newMentions.add(match[1].trim().toLowerCase());
      }

      if (newMentions.size === 0) return;

      const oldMentions = new Set<string>();
      if (oldDescription) {
        let oldMatch;
        while ((oldMatch = mentionRegex.exec(oldDescription)) !== null) {
          oldMentions.add(oldMatch[1].trim().toLowerCase());
        }
      }

      // Filter out users already mentioned in old description
      const freshMentions = Array.from(newMentions).filter(
        (name) => !oldMentions.has(name),
      );
      if (freshMentions.length === 0) return;

      const task = await notificationRepository.findTaskForNotification(taskId);
      if (!task) return;

      const projectMembers = await notificationRepository.findProjectMembers(
        task.projectId,
      );
      const author = await notificationRepository.findUserName(authorId);
      const authorName = author?.name || "Someone";

      for (const member of projectMembers) {
        const u = member.user;
        const isMentioned = freshMentions.some(
          (name) => name === u.name.toLowerCase(),
        );

        if (isMentioned && u.id !== authorId) {
          await this.createInAppNotification({
            recipientId: u.id,
            senderId: authorId,
            taskId: task.id,
            organizationId: task.organizationId,
            type: "mention",
            title: "Mentioned in Task Description",
            message: `${authorName} mentioned you in the description of "${task.title}"`,
          });
        }
      }
    } catch (error) {
      console.error("Error in handleMentionsInDescription:", error);
    }
  },

  // Handle when users are added to a project
  async handleAddedToProject(
    projectId: string,
    adderId: string,
    addedUserIds: string[],
  ) {
    try {
      const project =
        await notificationRepository.findProjectForNotification(projectId);
      if (!project) return;

      const adder = await notificationRepository.findUserName(adderId);
      const adderName = adder?.name || "Someone";

      for (const recipientId of addedUserIds) {
        if (recipientId === adderId) continue;
        await this.createInAppNotification({
          recipientId,
          senderId: adderId,
          projectId: project.id,
          organizationId: project.organizationId,
          type: "project_added",
          title: "Added to Project",
          message: `${adderName} added you to the project "${project.title}"`,
        });
      }
    } catch (error) {
      console.error("Error in handleAddedToProject notification:", error);
    }
  },

  // Handle when someone reacts to a comment/reply
  async handleCommentReaction(reactionId: string) {
    try {
      const reaction =
        await notificationRepository.findReactionForNotification(reactionId);
      if (!reaction) return;

      const reactorId = reaction.userId;
      const recipientId = reaction.comment.userId;

      // Don't notify yourself
      if (reactorId === recipientId) return;

      const reactor = reaction.user;
      const reactorName = reactor.name;
      const commentContent = reaction.comment.content;
      const task = reaction.comment.task;

      await this.createInAppNotification({
        recipientId,
        senderId: reactorId,
        taskId: task.id,
        organizationId: task.organizationId,
        type: "reaction",
        title: "New Reaction on Comment",
        message: `${reactorName} reacted with ${reaction.emoji} to your comment: "${commentContent.slice(0, 50)}..."`,
      });
    } catch (error) {
      console.error("Error in handleCommentReaction notification:", error);
    }
  },
};
