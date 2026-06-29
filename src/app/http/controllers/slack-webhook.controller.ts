import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import { webhookSchema } from "@/app/http/validators/slack-webhook.validator";
import { slackWebhookRepository } from "@/app/repositories/slack-webhook.repository";
import { slackWebhookService } from "@/app/services/slack-webhook.service";
import { NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const slackWebhookController = {
  getWebhooks: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const webhooks = await slackWebhookService.getWebhooks(projectId);

    return ok(res, "Slack webhooks fetched successfully", webhooks);
  }),

  createWebhook: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const validatedData = webhookSchema.parse(req.body);

    const webhook = await slackWebhookService.createWebhook(
      projectId,
      validatedData,
    );

    return ok(res, "Slack webhook registered successfully", webhook);
  }),

  deleteWebhook: asyncHandler(async (req: Request, res: Response) => {
    const webhookId = req.params.id as string;

    const webhook = await slackWebhookRepository.findById(webhookId);
    if (!webhook) {
      throw new NotFoundException("Slack webhook not found");
    }

    await verifyProjectAccess(req, webhook.projectId);

    await slackWebhookService.deleteWebhook(webhookId);

    return ok(res, "Slack webhook deleted successfully");
  }),
};
