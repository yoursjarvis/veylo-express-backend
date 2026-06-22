import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { z } from "zod";
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";

// Local helper to verify access
async function verifyProjectAccess(req: Request, projectId: string) {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    throw new BadRequestException("No active organization found");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }

  // Check Org Admin/Owner
  const callerOrgMember = await prisma.member.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: session.user.id,
      role: { in: ["owner", "admin"] },
    },
  });

  if (callerOrgMember) {
    return { activeOrgId, userId: session.user.id, project };
  }

  // Check Workspace Admin
  const callerWorkspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspaceId,
      userId: session.user.id,
      role: "admin",
      workspace: { organizationId: activeOrgId },
    },
  });

  if (callerWorkspaceMember) {
    return { activeOrgId, userId: session.user.id, project };
  }

  // Check Project Member
  const projectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: session.user.id,
      },
    },
  });

  if (!projectMember) {
    throw new ForbiddenException("Forbidden: You must be a project member or workspace/org admin");
  }

  return { activeOrgId, userId: session.user.id, project };
}

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
        channel: validatedData.channel || null,
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

    await prisma.slackWebhook.delete({
      where: { id: webhookId },
    });

    return ok(res, "Slack webhook deleted successfully");
  }),
};
