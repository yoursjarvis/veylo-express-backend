import { describe, expect, it, vi, beforeEach } from "vitest";
import { slackWebhookService } from "../../src/app/services/slack-webhook.service";

const { slackWebhookRepositoryMock } = vi.hoisted(() => ({
  slackWebhookRepositoryMock: {
    findByProjectId: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/app/repositories/slack-webhook.repository", () => ({
  slackWebhookRepository: slackWebhookRepositoryMock,
}));

describe("SlackWebhookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWebhooks", () => {
    it("UT-SWH-01: retrieves webhooks by project ID", async () => {
      slackWebhookRepositoryMock.findByProjectId.mockResolvedValueOnce([{ id: "wh1" }]);
      const res = await slackWebhookService.getWebhooks("p1");
      expect(slackWebhookRepositoryMock.findByProjectId).toHaveBeenCalledWith("p1");
      expect(res).toEqual([{ id: "wh1" }]);
    });
  });

  describe("createWebhook", () => {
    it("UT-SWH-02: creates a webhook successfully", async () => {
      slackWebhookRepositoryMock.create.mockResolvedValueOnce({ id: "wh1" });
      const res = await slackWebhookService.createWebhook("p1", {
        url: "https://slack.com/hook",
        isActive: true,
      });
      expect(slackWebhookRepositoryMock.create).toHaveBeenCalledWith({
        projectId: "p1",
        url: "https://slack.com/hook",
        channel: null,
        isActive: true,
      });
      expect(res).toEqual({ id: "wh1" });
    });
  });

  describe("deleteWebhook", () => {
    it("UT-SWH-03: throws NotFoundException if webhook does not exist", async () => {
      slackWebhookRepositoryMock.findById.mockResolvedValueOnce(null);
      await expect(slackWebhookService.deleteWebhook("wh1")).rejects.toThrow("Slack webhook not found");
    });

    it("UT-SWH-04: deletes webhook if it exists", async () => {
      slackWebhookRepositoryMock.findById.mockResolvedValueOnce({ id: "wh1" });
      await slackWebhookService.deleteWebhook("wh1");
      expect(slackWebhookRepositoryMock.delete).toHaveBeenCalledWith("wh1");
    });
  });
});
