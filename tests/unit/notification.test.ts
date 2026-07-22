import { beforeEach, describe, expect, it, vi } from "vitest";

import { Notification, notificationService } from "../../src/core/notification";

// Mock prisma
const mockPrismaNotificationCreate = vi.fn();
vi.mock("../../src/lib/prisma", () => ({
  default: {
    notification: {
      create: (...args: unknown[]) => mockPrismaNotificationCreate(...args),
    },
  },
}));

// Mock mailService
const mockMailSend = vi.fn().mockResolvedValue({ ok: true });
const mockMailView = vi.fn().mockReturnValue({
  subject: vi.fn().mockReturnThis(),
  send: mockMailSend,
});
const mockMailTo = vi.fn().mockReturnValue({
  view: mockMailView,
});
vi.mock("../../src/core/mail/mail.service", () => ({
  mailService: {
    to: (...args: unknown[]) => mockMailTo(...args),
  },
  sendMailMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

// Mock webSocketManager
const mockBroadcastToUser = vi.fn();
vi.mock("../../src/core/notification/websocket.manager", () => ({
  webSocketManager: {
    broadcastToUser: (...args: unknown[]) => mockBroadcastToUser(...args),
  },
}));

// Mock config
vi.mock("../../src/utils/config", () => ({
  config: (key: string) => {
    if (key === "mail.from.address") return "no-reply@example.com";
    if (key === "mail.from.name") return "Test Sender";
    return undefined;
  },
}));

class TestNotification extends Notification {
  via() {
    return ["database", "mail", "broadcast"];
  }

  toDatabase() {
    return {
      type: "test_notification",
      title: "Test Title",
      message: "Test Message",
      organizationId: "org-123-uuid",
      senderId: "sender-456-uuid",
      taskId: "task-789-uuid",
    };
  }

  toMail() {
    return {
      subject: "Test Mail Subject",
      template: "welcome" as unknown,
      data: { firstName: "TestUser" },
    };
  }

  toBroadcast() {
    return {
      event: "test.event",
      data: { foo: "bar" },
    };
  }
}

describe("Notification System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("UT-NOT-01: sends notifications across all channels successfully", async () => {
    const notifiable = {
      id: "recipient-123-uuid",
      email: "recipient@example.com",
    };

    const notification = new TestNotification();
    await notificationService.send(notifiable, notification);

    // Assert database channel was called
    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith({
      data: {
        recipientId: "recipient-123-uuid",
        type: "test_notification",
        title: "Test Title",
        message: "Test Message",
        organizationId: "org-123-uuid",
        senderId: "sender-456-uuid",
        taskId: "task-789-uuid",
      },
    });

    // Assert mail channel was called
    expect(mockMailTo).toHaveBeenCalledWith("recipient@example.com");
    expect(mockMailView).toHaveBeenCalledWith("welcome", {
      firstName: "TestUser",
    });
    expect(mockMailSend).toHaveBeenCalled();

    // Assert broadcast channel was called
    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      "recipient-123-uuid",
      "test.event",
      { foo: "bar" },
    );
  });

  it("should extend and register custom drivers", () => {
    const customDriver = { send: vi.fn() };
    notificationService.extend("custom", customDriver);
    expect(notificationService.driver("custom")).toBe(customDriver);
  });

  it("should throw error for unsupported driver names", () => {
    expect(() => notificationService.driver("unsupported")).toThrow(
      "Notification driver [unsupported] is not supported.",
    );
  });

  it("should handle error gracefully if a driver execution fails", async () => {
    const brokenDriver = {
      send: vi.fn().mockRejectedValueOnce(new Error("Driver failed")),
    };
    notificationService.extend("broken", brokenDriver);

    class BrokenNotification extends Notification {
      via() {
        return ["broken"];
      }
    }

    const notifiable = {
      id: "recipient-123-uuid",
      email: "recipient@example.com",
    };

    // Should not throw, promise is caught in try-catch in send()
    await expect(
      notificationService.send(notifiable, new BrokenNotification()),
    ).resolves.not.toThrow();
  });
});
