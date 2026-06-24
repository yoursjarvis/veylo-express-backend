import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";

const webhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  channel: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const slackWebhookController = {
  getWebhooks: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const webhooks = await prisma.slackWebhook.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return ok(res, "Slack webhooks fetched successfully", webhooks);
  }),

  createWebhook: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const validatedData = webhookSchema.parse(req.body);

    const webhook = await prisma.slackWebhook.create({
      data: {
        projectId,
        url: validatedData.url,
        channel: validatedData.channel ?? null,
        isActive: validatedData.isActive,
      },
    });

    return ok(res, "Slack webhook registered successfully", webhook);
  }),

  deleteWebhook: asyncHandler(async (req: Request, res: Response) => {
    const webhookId = req.params.id as string;

    const webhook = await prisma.slackWebhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new NotFoundException("Slack webhook not found");
    }

    await verifyProjectAccess(req, webhook.projectId);

    await prisma.slackWebhook.delete({ where: { id: webhookId } });

    return ok(res, "Slack webhook deleted successfully");
  }),
};
