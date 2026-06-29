import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

import { NotificationDriver } from "../contracts/notification-driver";
import { Notifiable, Notification } from "../notification.types";

export class DatabaseDriver implements NotificationDriver {
  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    if (typeof notification.toDatabase !== "function") {
      logger.warn(
        { notification: notification.constructor.name },
        "[NOTIFICATION][database] toDatabase method not found on notification"
      );
      return;
    }

    try {
      const payload = await notification.toDatabase(notifiable);

      logger.info(
        {
          recipientId: notifiable.id,
          type: payload.type,
        },
        "[NOTIFICATION][database] Storing notification in database"
      );

      await prisma.notification.create({
        data: {
          recipientId: notifiable.id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          organizationId: payload.organizationId,
          senderId: payload.senderId ?? null,
          taskId: payload.taskId ?? null,
        },
      });
    } catch (error) {
      logger.error(
        { error, recipientId: notifiable.id, notification: notification.constructor.name },
        "[NOTIFICATION][database] Failed to save notification to database"
      );
    }
  }
}
