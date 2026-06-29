import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { notificationService } from "@/app/services/notification.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { UnauthorizedException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const notificationController = {
  // Get notifications for logged-in user
  getNotifications: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const notifications = await notificationService.getUserNotifications(
      session.user.id,
    );

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

    const updated = await notificationService.markNotificationAsRead(
      session.user.id,
      notificationId,
    );

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

    await notificationService.markAllUserNotificationsAsRead(session.user.id);

    return ok(res, "All notifications marked as read");
  }),
};
