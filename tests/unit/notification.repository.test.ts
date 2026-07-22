import { describe, it, expect, vi } from "vitest";
import { notificationRepository } from "@/app/repositories/notification.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("NotificationRepository", () => {
  it("should get notifications for a recipient", async () => {
    prismaMock.notification.findMany.mockResolvedValueOnce([
      { id: "notif-1", recipientId: "user-1" },
    ]);
    const result = await notificationRepository.getNotifications("user-1");
    expect(prismaMock.notification.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should find notification by id", async () => {
    prismaMock.notification.findUnique.mockResolvedValueOnce({ id: "notif-1" });
    const result = await notificationRepository.findById("notif-1");
    expect(prismaMock.notification.findUnique).toHaveBeenCalledWith({
      where: { id: "notif-1" },
    });
    expect(result?.id).toBe("notif-1");
  });

  it("should mark notification as read", async () => {
    prismaMock.notification.update.mockResolvedValueOnce({
      id: "notif-1",
      isRead: true,
    });
    const result = await notificationRepository.markAsRead("notif-1");
    expect(prismaMock.notification.update).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { isRead: true },
    });
    expect(result.isRead).toBe(true);
  });

  it("should mark all notifications as read", async () => {
    prismaMock.notification.updateMany.mockResolvedValueOnce({ count: 5 });
    const result = await notificationRepository.markAllAsRead("user-1");
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { recipientId: "user-1", isRead: false },
      data: { isRead: true },
    });
    expect(result.count).toBe(5);
  });

  it("should find active slack webhooks", async () => {
    prismaMock.slackWebhook.findMany.mockResolvedValueOnce([
      { id: "webhook-1" },
    ]);
    const result =
      await notificationRepository.findActiveSlackWebhooks("proj-1");
    expect(prismaMock.slackWebhook.findMany).toHaveBeenCalledWith({
      where: { projectId: "proj-1", isActive: true },
    });
    expect(result).toHaveLength(1);
  });

  it("should create notification", async () => {
    const data = {
      recipientId: "user-2",
      senderId: "user-1",
      taskId: "task-1",
      projectId: "proj-1",
      organizationId: "org-1",
      type: "mention",
      title: "New Mention",
      message: "You were mentioned",
    };
    prismaMock.notification.create.mockResolvedValueOnce({
      id: "notif-1",
      ...data,
    });
    const result = await notificationRepository.createNotification(data);
    expect(prismaMock.notification.create).toHaveBeenCalled();
    expect(result.id).toBe("notif-1");
  });

  it("should find task for notification", async () => {
    prismaMock.task.findUnique.mockResolvedValueOnce({
      id: "task-1",
      title: "Task 1",
    });
    const result =
      await notificationRepository.findTaskForNotification("task-1");
    expect(prismaMock.task.findUnique).toHaveBeenCalled();
    expect(result?.id).toBe("task-1");
  });

  it("should find user name and notification preferences", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ name: "John Doe" });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      notificationPreferences: {},
    });

    expect(await notificationRepository.findUserName("user-1")).toEqual({
      name: "John Doe",
    });
    expect(await notificationRepository.getUserPreferences("user-1")).toEqual({
      notificationPreferences: {},
    });
  });

  it("should find comment for notification", async () => {
    prismaMock.comment.findUnique.mockResolvedValueOnce({ id: "comment-1" });
    const result =
      await notificationRepository.findCommentForNotification("comment-1");
    expect(prismaMock.comment.findUnique).toHaveBeenCalled();
    expect(result?.id).toBe("comment-1");
  });

  it("should find project members", async () => {
    prismaMock.projectMember.findMany.mockResolvedValueOnce([
      { id: "member-1" },
    ]);
    const result = await notificationRepository.findProjectMembers("proj-1");
    expect(prismaMock.projectMember.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should find project for notification", async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      id: "proj-1",
      title: "Project",
    });
    const result =
      await notificationRepository.findProjectForNotification("proj-1");
    expect(prismaMock.project.findUnique).toHaveBeenCalled();
    expect(result?.id).toBe("proj-1");
  });

  it("should find comment reaction for notification", async () => {
    prismaMock.commentReaction.findUnique.mockResolvedValueOnce({ id: "re-1" });
    const result =
      await notificationRepository.findReactionForNotification("re-1");
    expect(prismaMock.commentReaction.findUnique).toHaveBeenCalled();
    expect(result?.id).toBe("re-1");
  });
});
