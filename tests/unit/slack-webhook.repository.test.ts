import { describe, it, expect, vi } from "vitest";
import { slackWebhookRepository } from "@/app/repositories/slack-webhook.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("SlackWebhookRepository", () => {
  it("should find webhooks by projectId", async () => {
    prismaMock.slackWebhook.findMany.mockResolvedValueOnce([{ id: "hook-1" }]);
    const result = await slackWebhookRepository.findByProjectId("proj-1");
    expect(prismaMock.slackWebhook.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should create webhook if project exists", async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    prismaMock.slackWebhook.create.mockResolvedValueOnce({ id: "hook-1" });

    const result = await slackWebhookRepository.create({
      projectId: "proj-1",
      url: "https://slack.com/webhook",
      isActive: true,
    });
    expect(prismaMock.project.findUnique).toHaveBeenCalled();
    expect(prismaMock.slackWebhook.create).toHaveBeenCalled();
    expect(result.id).toBe("hook-1");
  });

  it("should throw error when creating webhook for non-existent project", async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    await expect(
      slackWebhookRepository.create({
        projectId: "proj-non-existent",
        url: "https://slack.com/webhook",
        isActive: true,
      }),
    ).rejects.toThrow("Project not found");
  });

  it("should find webhook by id", async () => {
    prismaMock.slackWebhook.findUnique.mockResolvedValueOnce({ id: "hook-1" });
    const result = await slackWebhookRepository.findById("hook-1");
    expect(prismaMock.slackWebhook.findUnique).toHaveBeenCalledWith({
      where: { id: "hook-1" },
    });
    expect(result?.id).toBe("hook-1");
  });

  it("should delete webhook", async () => {
    prismaMock.slackWebhook.delete.mockResolvedValueOnce({ id: "hook-1" });
    const result = await slackWebhookRepository.delete("hook-1");
    expect(prismaMock.slackWebhook.delete).toHaveBeenCalledWith({
      where: { id: "hook-1" },
    });
    expect(result.id).toBe("hook-1");
  });
});
