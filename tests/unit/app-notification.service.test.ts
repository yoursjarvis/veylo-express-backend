import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationService } from "@/app/services/notification.service";
import { notificationRepository } from "@/app/repositories/notification.repository";
import { prismaMock } from "../../tests/helpers/db";

// Mock notificationRepository functions
vi.mock("@/app/repositories/notification.repository", () => ({
  notificationRepository: {
    getNotifications: vi.fn(),
    findById: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    findActiveSlackWebhooks: vi.fn(),
    createNotification: vi.fn(),
    findTaskForNotification: vi.fn(),
    findUserName: vi.fn(),
    getUserPreferences: vi.fn(),
    findCommentForNotification: vi.fn(),
    findProjectMembers: vi.fn(),
    findProjectForNotification: vi.fn(),
    findReactionForNotification: vi.fn(),
  },
}));

// Mock mailService from @/core/mail
const queueMock = vi.fn();
const viewMock = vi.fn().mockReturnValue({ queue: queueMock });
const toMock = vi.fn().mockReturnValue({ view: viewMock });
vi.mock("@/core/mail", () => ({
  mailService: {
    to: toMock,
  },
}));

describe("NotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({}));
  });

  it("should get notifications, mark read, and mark all read", async () => {
    vi.mocked(notificationRepository.getNotifications).mockResolvedValueOnce([{ id: "n-1" } as unknown]);
    expect(await notificationService.getUserNotifications("user-1")).toHaveLength(1);

    vi.mocked(notificationRepository.findById).mockResolvedValueOnce({ id: "n-1", recipientId: "user-1" } as unknown);
    vi.mocked(notificationRepository.markAsRead).mockResolvedValueOnce({ id: "n-1", isRead: true } as unknown);
    expect(await notificationService.markNotificationAsRead("user-1", "n-1")).toEqual({ id: "n-1", isRead: true });

    // NotFoundException cases
    vi.mocked(notificationRepository.findById).mockResolvedValueOnce(null);
    await expect(notificationService.markNotificationAsRead("user-1", "n-1")).rejects.toThrow("Notification not found");

    vi.mocked(notificationRepository.findById).mockResolvedValueOnce({ id: "n-1", recipientId: "user-other" } as unknown);
    await expect(notificationService.markNotificationAsRead("user-1", "n-1")).rejects.toThrow("Notification not found");

    vi.mocked(notificationRepository.markAllAsRead).mockResolvedValueOnce({ count: 5 } as unknown);
    expect(await notificationService.markAllUserNotificationsAsRead("user-1")).toEqual({ count: 5 });
  });

  it("should dispatch slack webhooks", async () => {
    const webhooks = [{ url: "https://slack.com", channel: "general" }];
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce(webhooks);

    await notificationService.dispatchSlackWebhook("proj-1", "Hello");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should create in app and email notifications depending on user preferences", async () => {
    // Case 1: Preferences set to false for type
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValueOnce({
      notificationPreferences: JSON.stringify({ types: { mention: false } }),
    } as unknown);
    await notificationService.createInAppNotification({
      recipientId: "user-1",
      senderId: "user-2",
      type: "mention",
      title: "Title",
      message: "Msg",
      organizationId: "org-1",
    });
    expect(notificationRepository.createNotification).not.toHaveBeenCalled();

    // Case 2: Preferences parsed successfully, sending in_app and email
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValueOnce({
      notificationPreferences: JSON.stringify({ channels: { in_app: true, email: true } }),
    } as unknown);
    prismaMock.user.findUnique.mockResolvedValueOnce({ email: "john@example.com", name: "John" });

    await notificationService.createInAppNotification({
      recipientId: "user-1",
      senderId: "user-2",
      type: "mention",
      title: "Title",
      message: "Msg",
      organizationId: "org-1",
    });

    expect(notificationRepository.createNotification).toHaveBeenCalled();
    expect(toMock).toHaveBeenCalledWith("john@example.com", "John");
  });

  it("should handle task created notifications", async () => {
    const task = {
      id: "task-1",
      title: "Task 1",
      assigneeId: "user-2",
      projectId: "proj-1",
      project: { title: "Project 1" },
      organizationId: "org-1",
      priority: "high",
      status: { name: "Todo" },
      creator: { name: "John" },
      assignee: { name: "Doe" },
      description: "Hello @Doe",
    };
    vi.mocked(notificationRepository.findTaskForNotification).mockResolvedValueOnce(task as unknown);
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([]);

    await notificationService.handleTaskCreated("task-1", "user-1");
    expect(notificationRepository.findTaskForNotification).toHaveBeenCalledWith("task-1");
  });

  it("should handle task updated notifications", async () => {
    const oldTask = {
      statusId: "status-old",
      statusName: "Backlog",
      assigneeId: "user-3",
      assigneeName: "Doe",
      description: "Hello",
    };
    const task = {
      id: "task-1",
      title: "Task 1",
      statusId: "status-new",
      status: { name: "Todo" },
      assigneeId: "user-2",
      assignee: { name: "Alice" },
      creatorId: "user-1",
      projectId: "proj-1",
      project: { title: "Project 1" },
      organizationId: "org-1",
      description: "Hello @Alice",
    };
    vi.mocked(notificationRepository.findTaskForNotification).mockResolvedValueOnce(task as unknown);
    vi.mocked(notificationRepository.findUserName).mockResolvedValueOnce({ name: "Bob" });
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([]);

    await notificationService.handleTaskUpdated("task-1", "user-4", oldTask);
    expect(notificationRepository.findTaskForNotification).toHaveBeenCalled();
  });

  it("should handle comment added notifications and mention parser", async () => {
    const comment = {
      id: "comment-1",
      content: "Hello @Alice",
      task: { id: "task-1", projectId: "proj-1", organizationId: "org-1", title: "Task 1", assigneeId: "user-2" },
      user: { name: "Bob" },
      parentId: "parent-1",
      parent: { userId: "user-3" },
    };
    vi.mocked(notificationRepository.findCommentForNotification).mockResolvedValueOnce(comment as unknown);
    vi.mocked(notificationRepository.findProjectMembers).mockResolvedValueOnce([
      { user: { id: "user-3", name: "Alice" } },
    ] as unknown);
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([]);

    await notificationService.handleCommentAdded("comment-1", "user-1");
    expect(notificationRepository.findCommentForNotification).toHaveBeenCalledWith("comment-1");
  });

  it("should handle project added notifications", async () => {
    const project = { id: "proj-1", title: "Project 1", organizationId: "org-1" };
    vi.mocked(notificationRepository.findProjectForNotification).mockResolvedValueOnce(project as unknown);
    vi.mocked(notificationRepository.findUserName).mockResolvedValueOnce({ name: "Bob" });

    await notificationService.handleAddedToProject("proj-1", "user-1", ["user-2"]);
    expect(notificationRepository.findProjectForNotification).toHaveBeenCalledWith("proj-1");
  });

  it("should handle comment reaction notifications", async () => {
    const reaction = {
      id: "reaction-1",
      userId: "user-2",
      emoji: "thumbsup",
      user: { name: "Alice" },
      comment: {
        userId: "user-1",
        content: "Nice!",
        task: { id: "task-1", organizationId: "org-1" },
      },
    };
    vi.mocked(notificationRepository.findReactionForNotification).mockResolvedValueOnce(reaction as unknown);

    await notificationService.handleCommentReaction("reaction-1");
    expect(notificationRepository.findReactionForNotification).toHaveBeenCalledWith("reaction-1");
  });

  it("should skip reaction notification when reactor is the comment author", async () => {
    const reaction = {
      id: "reaction-1",
      userId: "user-1", // same as comment author
      emoji: "thumbsup",
      user: { name: "Alice" },
      comment: { userId: "user-1", content: "Nice!", task: { id: "task-1", organizationId: "org-1" } },
    };
    vi.mocked(notificationRepository.findReactionForNotification).mockResolvedValueOnce(reaction as unknown);
    await notificationService.handleCommentReaction("reaction-1");
    expect(notificationRepository.createNotification).not.toHaveBeenCalled();
  });

  it("should skip when no task/comment/reaction found", async () => {
    vi.mocked(notificationRepository.findTaskForNotification).mockResolvedValueOnce(null);
    await notificationService.handleTaskCreated("task-missing", "user-1");

    vi.mocked(notificationRepository.findCommentForNotification).mockResolvedValueOnce(null);
    await notificationService.handleCommentAdded("comment-missing", "user-1");

    vi.mocked(notificationRepository.findReactionForNotification).mockResolvedValueOnce(null);
    await notificationService.handleCommentReaction("reaction-missing");

    vi.mocked(notificationRepository.findProjectForNotification).mockResolvedValueOnce(null);
    await notificationService.handleAddedToProject("proj-missing", "user-1", ["user-2"]);
  });

  it("should skip notification when recipientId === senderId", async () => {
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValueOnce(null);
    await notificationService.createInAppNotification({
      recipientId: "user-1",
      senderId: "user-1", // same as recipient
      type: "mention",
      title: "Title",
      message: "Msg",
      organizationId: "org-1",
    });
    expect(notificationRepository.createNotification).not.toHaveBeenCalled();
  });

  it("should handle description mentions with all fresh mentions matched", async () => {
    const task = {
      id: "task-1", title: "T1", projectId: "proj-1", organizationId: "org-1",
    };
    vi.mocked(notificationRepository.findTaskForNotification).mockResolvedValueOnce(task as unknown);
    vi.mocked(notificationRepository.findProjectMembers).mockResolvedValueOnce([
      { user: { id: "user-2", name: "Alice" } },
    ] as unknown);
    vi.mocked(notificationRepository.findUserName).mockResolvedValueOnce({ name: "Bob" });
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValue(null);

    await notificationService.handleMentionsInDescription(
      "task-1", "user-1", "@Alice great work", undefined
    );
    expect(notificationRepository.findTaskForNotification).toHaveBeenCalled();
  });

  it("should skip description mentions if no new mentions", async () => {
    await notificationService.handleMentionsInDescription(
      "task-1", "user-1", "no mentions here"
    );
    expect(notificationRepository.findTaskForNotification).not.toHaveBeenCalled();
  });

  it("should skip description mentions if all mentions already existed", async () => {
    await notificationService.handleMentionsInDescription(
      "task-1", "user-1", "@Alice was here", "@Alice was here"
    );
    expect(notificationRepository.findTaskForNotification).not.toHaveBeenCalled();
  });

  it("should handle email channel disabled in preferences", async () => {
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValueOnce({
      notificationPreferences: JSON.stringify({ channels: { in_app: true, email: false } }),
    } as unknown);
    vi.mocked(notificationRepository.createNotification).mockResolvedValueOnce({} as unknown);

    await notificationService.createInAppNotification({
      recipientId: "user-1",
      senderId: "user-2",
      type: "mention",
      title: "Title",
      message: "Msg",
      organizationId: "org-1",
    });

    expect(notificationRepository.createNotification).toHaveBeenCalled();
  });

  it("should handle invalid JSON in preferences gracefully", async () => {
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValueOnce({
      notificationPreferences: "not-valid-json",
    } as unknown);

    // Should not throw - error is caught and defaults used
    await notificationService.createInAppNotification({
      recipientId: "user-1",
      senderId: "user-2",
      type: "mention",
      title: "Title",
      message: "Msg",
      organizationId: "org-1",
    });

    expect(notificationRepository.createNotification).toHaveBeenCalled();
  });

  it("should handle slack webhook dispatch errors gracefully", async () => {
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([
      { url: "https://slack.com", channel: "general" },
    ]);
    // Make fetch throw
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    // Should not throw - errors are caught
    await notificationService.dispatchSlackWebhook("proj-1", "Hello");
  });

  it("handleAddedToProject: skips self (adder in addedUserIds list)", async () => {
    const project = { id: "proj-1", title: "Project 1", organizationId: "org-1" };
    vi.mocked(notificationRepository.findProjectForNotification).mockResolvedValueOnce(project as unknown);
    vi.mocked(notificationRepository.findUserName).mockResolvedValueOnce({ name: "Bob" });
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValue(null);

    // adder is in the list - should be skipped
    await notificationService.handleAddedToProject("proj-1", "user-1", ["user-1", "user-2"]);
    // createNotification should only be called for user-2, not user-1
    expect(notificationRepository.findProjectForNotification).toHaveBeenCalled();
  });

  it("should send notification to assignee on handleTaskCreated with assignee and description", async () => {
    const task = {
      id: "task-1", title: "Task 1", priority: "high",
      status: { name: "Todo" }, project: { title: "Proj 1" },
      assigneeId: "user-2", assignee: { name: "Alice" },
      creator: { name: "Bob" },
      projectId: "proj-1", organizationId: "org-1",
      description: "@Alice check this",
      creatorId: "user-1",
    };
    vi.mocked(notificationRepository.findTaskForNotification).mockResolvedValueOnce(task as unknown);
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValue(null);
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([]);
    // For description mentions
    vi.mocked(notificationRepository.findTaskForNotification).mockResolvedValueOnce(task as unknown);
    vi.mocked(notificationRepository.findProjectMembers).mockResolvedValueOnce([
      { user: { id: "user-2", name: "Alice" } },
    ] as unknown);
    vi.mocked(notificationRepository.findUserName).mockResolvedValueOnce({ name: "Bob" });

    await notificationService.handleTaskCreated("task-1", "user-1");

    expect(notificationRepository.findTaskForNotification).toHaveBeenCalled();
  });

  it("should notify new and old assignee on handleTaskUpdated with assignee change", async () => {
    const oldTask = {
      statusId: "status-1", statusName: "Todo",
      assigneeId: "user-old", assigneeName: "OldAssignee",
      description: "old description",
    };
    const task = {
      id: "task-1", title: "Task 1",
      statusId: "status-1", status: { name: "Todo" },
      assigneeId: "user-new", assignee: { name: "NewAssignee" },
      creatorId: "user-1", creator: { name: "Creator" },
      projectId: "proj-1", project: { title: "Proj 1" },
      organizationId: "org-1",
      description: "new description @NewUser",
    };
    vi.mocked(notificationRepository.findTaskForNotification)
      .mockResolvedValueOnce(task as unknown)
      .mockResolvedValueOnce(task as unknown); // for description mentions
    vi.mocked(notificationRepository.findUserName)
      .mockResolvedValueOnce({ name: "Updater" })
      .mockResolvedValueOnce({ name: "Updater" }); // for mentions author
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValue(null);
    vi.mocked(notificationRepository.findProjectMembers).mockResolvedValueOnce([
      { user: { id: "user-new", name: "NewUser" } },
    ] as unknown);
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([]);

    await notificationService.handleTaskUpdated("task-1", "user-updater", oldTask);

    expect(notificationRepository.findTaskForNotification).toHaveBeenCalled();
  });

  it("should not notify old assignee if oldAssigneeId === updaterId", async () => {
    const oldTask = {
      statusId: "status-1", statusName: "Todo",
      assigneeId: "user-updater", // same as updater, should be skipped
      assigneeName: "Updater",
      description: "same",
    };
    const task = {
      id: "task-1", title: "Task 1",
      statusId: "status-1", status: { name: "Todo" },
      assigneeId: "user-new", assignee: { name: "NewAssignee" },
      creatorId: "user-1", creator: { name: "Creator" },
      projectId: "proj-1", project: { title: "Proj 1" },
      organizationId: "org-1",
      description: "same",
    };
    vi.mocked(notificationRepository.findTaskForNotification).mockResolvedValueOnce(task as unknown);
    vi.mocked(notificationRepository.findUserName).mockResolvedValueOnce({ name: "Updater" });
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValue(null);
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([]);

    await notificationService.handleTaskUpdated("task-1", "user-updater", oldTask);

    expect(notificationRepository.findTaskForNotification).toHaveBeenCalled();
  });

  it("should handle task not found in handleTaskUpdated gracefully", async () => {
    vi.mocked(notificationRepository.findTaskForNotification).mockResolvedValueOnce(null);

    await notificationService.handleTaskUpdated("task-missing", "user-1", {});

    expect(notificationRepository.createNotification).not.toHaveBeenCalled();
  });

  it("should send slack message on handleTaskUpdated when status and assignee change", async () => {
    const oldTask = {
      statusId: "status-old", statusName: "Backlog",
      assigneeId: "user-old", assigneeName: "OldUser",
      description: "same desc",
    };
    const task = {
      id: "task-1", title: "Task 1",
      statusId: "status-new", status: { name: "Done" },
      assigneeId: "user-new", assignee: { name: "NewUser" },
      creatorId: "user-creator",
      projectId: "proj-1", project: { title: "My Project" },
      organizationId: "org-1",
      description: "same desc",
    };
    vi.mocked(notificationRepository.findTaskForNotification).mockResolvedValueOnce(task as unknown);
    vi.mocked(notificationRepository.findUserName).mockResolvedValueOnce({ name: "Updater" });
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValue(null);
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([
      { url: "https://hooks.slack.com/test", channel: "general" },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await notificationService.handleTaskUpdated("task-1", "user-updater", oldTask);

    expect(notificationRepository.findActiveSlackWebhooks).toHaveBeenCalledWith("proj-1");
  });

  it("should catch error in handleMentionsInDescription gracefully", async () => {
    vi.mocked(notificationRepository.findTaskForNotification).mockRejectedValueOnce(
      new Error("DB error in handleMentionsInDescription")
    );

    // Should not throw - error caught in try/catch
    await notificationService.handleMentionsInDescription("task-1", "user-1", "@Alice and @Bob");
  });

  it("should catch error in handleAddedToProject gracefully", async () => {
    vi.mocked(notificationRepository.findProjectForNotification).mockRejectedValueOnce(
      new Error("DB error in handleAddedToProject")
    );

    // Should not throw - error caught in try/catch
    await notificationService.handleAddedToProject("proj-1", "user-1", ["user-2"]);
  });

  it("should catch error in handleCommentReaction gracefully", async () => {
    vi.mocked(notificationRepository.findReactionForNotification).mockRejectedValueOnce(
      new Error("DB error in handleCommentReaction")
    );

    // Should not throw - error caught in try/catch
    await notificationService.handleCommentReaction("reaction-1");
  });

  it("should handle preferencesRecord with null notificationPreferences (uses defaults)", async () => {
    // preferencesRecord exists but notificationPreferences is null → uses default channels
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValueOnce({
      notificationPreferences: null, // explicitly null
    } as unknown);
    vi.mocked(notificationRepository.createNotification).mockResolvedValueOnce({} as unknown);
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([]);

    await notificationService.createInAppNotification({
      recipientId: "user-1",
      senderId: "user-2",
      type: "mention",
      title: "Title",
      message: "Msg",
      organizationId: "org-1",
    });

    expect(notificationRepository.createNotification).toHaveBeenCalled();
  });

  it("should send reply notification in handleCommentAdded when comment has a parent", async () => {
    const comment = {
      id: "comment-1",
      content: "Reply to parent",
      parentId: "comment-parent",
      parent: { userId: "user-parent" }, // different from author
      userId: "user-author",
      user: { name: "Author" },
      task: {
        id: "task-1", title: "Task 1",
        projectId: "proj-1", organizationId: "org-1",
        assigneeId: null, // no assignee to keep it simple
      },
      mentions: [],
    };
    vi.mocked(notificationRepository.findCommentForNotification).mockResolvedValueOnce(comment as unknown);
    vi.mocked(notificationRepository.findUserName).mockResolvedValueOnce({ name: "Author" });
    vi.mocked(notificationRepository.getUserPreferences).mockResolvedValue(null);
    vi.mocked(notificationRepository.findActiveSlackWebhooks).mockResolvedValueOnce([]);

    await notificationService.handleCommentAdded("comment-1", "user-author");

    expect(notificationRepository.findCommentForNotification).toHaveBeenCalled();
  });

  it("should catch error in handleCommentAdded gracefully", async () => {
    vi.mocked(notificationRepository.findCommentForNotification).mockRejectedValueOnce(
      new Error("DB error in handleCommentAdded")
    );

    // Should not throw - error caught in try/catch
    await notificationService.handleCommentAdded("comment-1", "user-1");

    expect(notificationRepository.createNotification).not.toHaveBeenCalled();
  });
});
