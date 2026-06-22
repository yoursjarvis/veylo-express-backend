import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { UnauthorizedException, NotFoundException } from "@/utils/app-error";

export const notificationController = {
  // Get notifications for logged-in user
  getNotifications: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const notifications = await prisma.notification.findMany({
      where: { recipientId: session.user.id },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        task: { select: { id: true, title: true, projectId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(res, "Notifications fetched successfully", notifications);
  }),

  // Mark notification as read
  markAsRead: asyncHandler(async (req: Request, res: Response) => {
    const notificationId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.recipientId !== session.user.id) {
      throw new NotFoundException("Notification not found");
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return ok(res, "Notification marked as read", updated);
  }),

  // Mark all notifications as read
  markAllAsRead: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    await prisma.notification.updateMany({
      where: { recipientId: session.user.id, isRead: false },
      data: { isRead: true },
    });

    return ok(res, "All notifications marked as read");
  }),
};
