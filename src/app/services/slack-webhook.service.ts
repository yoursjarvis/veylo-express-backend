import { slackWebhookRepository } from "@/app/repositories/slack-webhook.repository";
import { NotFoundException } from "@/utils/app-error";

export const slackWebhookService = {
  async getWebhooks(projectId: string) {
    return slackWebhookRepository.findByProjectId(projectId);
  },

  async createWebhook(
    projectId: string,
    validatedData: {
      url: string;
      channel?: string | null;
      isActive: boolean;
    }
  ) {
    return slackWebhookRepository.create({
      projectId,
      url: validatedData.url,
      channel: validatedData.channel ?? null,
      isActive: validatedData.isActive,
    });
  },

  async deleteWebhook(webhookId: string) {
    const webhook = await slackWebhookRepository.findById(webhookId);
    if (!webhook) {
      throw new NotFoundException("Slack webhook not found");
    }

    await slackWebhookRepository.delete(webhookId);
  },
};
