import { mailService } from "@/core/mail/mail.service";
import { logger } from "@/lib/logger";

import { NotificationDriver } from "../contracts/notification-driver";
import { Notifiable, Notification } from "../notification.types";

export class MailDriver implements NotificationDriver {
  async send(
    notifiable: Notifiable,
    notification: Notification,
  ): Promise<void> {
    if (typeof notification.toMail !== "function") {
      logger.warn(
        { notification: notification.constructor.name },
        "[NOTIFICATION][mail] toMail method not found on notification",
      );
      return;
    }

    try {
      const payload = await notification.toMail(notifiable);
      const email = payload.to || notifiable.email;

      if (!email) {
        logger.error(
          {
            recipientId: notifiable.id,
            notification: notification.constructor.name,
          },
          "[NOTIFICATION][mail] Recipient has no email address",
        );
        return;
      }

      logger.info(
        {
          recipientId: notifiable.id,
          email,
          notification: notification.constructor.name,
        },
        "[NOTIFICATION][mail] Sending email notification",
      );

      if ("template" in payload) {
        const mailBuilder = mailService
          .to(email)
          .view(payload.template, payload.data);
        if (payload.subject) {
          mailBuilder.subject(payload.subject);
        }
        await mailBuilder.send();
      } else {
        const { sendMailMessage } = await import("@/core/mail/mail.service");
        const { config } = await import("@/utils/config");

        await sendMailMessage({
          to: [{ address: email }],
          from: {
            address: config("mail.from.address"),
            name: config("mail.from.name"),
          },
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        });
      }
    } catch (error) {
      logger.error(
        {
          error,
          recipientId: notifiable.id,
          notification: notification.constructor.name,
        },
        "[NOTIFICATION][mail] Failed to send email notification",
      );
    }
  }
}
