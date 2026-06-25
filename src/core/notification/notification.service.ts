import { NotificationDriver } from "./contracts/notification-driver";
import { DatabaseDriver } from "./drivers/database.driver";
import { MailDriver } from "./drivers/mail.driver";
import { BroadcastDriver } from "./drivers/broadcast.driver";
import { Notifiable, Notification } from "./notification.types";
import { logger } from "@/lib/logger";

export class NotificationService {
  private drivers: Map<string, NotificationDriver> = new Map();

  constructor() {
    // Register the standard drivers
    this.drivers.set("database", new DatabaseDriver());
    this.drivers.set("mail", new MailDriver());
    this.drivers.set("broadcast", new BroadcastDriver());
  }

  /**
   * Register a custom notification driver.
   */
  public extend(name: string, driver: NotificationDriver): this {
    this.drivers.set(name, driver);
    return this;
  }

  /**
   * Get a driver instance by name.
   */
  public driver(name: string): NotificationDriver {
    const driver = this.drivers.get(name);
    if (!driver) {
      throw new Error(`Notification driver [${name}] is not supported.`);
    }
    return driver;
  }

  /**
   * Send the given notification to the given notifiable(s).
   */
  async send(
    notifiables: Notifiable | Notifiable[],
    notification: Notification
  ): Promise<void> {
    const notifiableList = Array.isArray(notifiables) ? notifiables : [notifiables];

    const promises = notifiableList.flatMap((notifiable) => {
      // Resolve the channels to send via
      const channels = notification.via(notifiable);

      return channels.map(async (channel) => {
        try {
          const driverInstance = this.driver(channel);
          await driverInstance.send(notifiable, notification);
        } catch (error) {
          logger.error(
            {
              error,
              channel,
              recipientId: notifiable.id,
              notification: notification.constructor.name,
            },
            `[NOTIFICATION] Failed to send notification via channel [${channel}]`
          );
        }
      });
    });

    await Promise.allSettled(promises);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
