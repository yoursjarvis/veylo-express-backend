import { logger } from "@/lib/logger";

import { NotificationDriver } from "../contracts/notification-driver";
import { Notifiable, Notification } from "../notification.types";
import { webSocketManager } from "../websocket.manager";

export class BroadcastDriver implements NotificationDriver {
  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    if (typeof notification.toBroadcast !== "function") {
      logger.warn(
        { notification: notification.constructor.name },
        "[NOTIFICATION][broadcast] toBroadcast method not found on notification"
      );
      return;
    }

    try {
      const payload = await notification.toBroadcast(notifiable);

      logger.info(
        {
          recipientId: notifiable.id,
          event: payload.event,
        },
        "[NOTIFICATION][broadcast] Broadcasting real-time notification"
      );

      webSocketManager.broadcastToUser(notifiable.id, payload.event, payload.data);
    } catch (error) {
      logger.error(
        { error, recipientId: notifiable.id, notification: notification.constructor.name },
        "[NOTIFICATION][broadcast] Failed to broadcast notification"
      );
    }
  }
}
