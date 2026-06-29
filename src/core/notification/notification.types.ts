import type { EmailTemplateName, EmailTemplateData } from "@/templates/emails";

export interface Notifiable {
  id: string;
  email?: string | null;
  [key: string]: unknown;
}

export interface DatabaseNotificationPayload {
  type: string;
  title: string;
  message: string;
  organizationId: string;
  senderId?: string | null;
  taskId?: string | null;
}

export interface BroadcastNotificationPayload {
  event: string;
  data: Record<string, unknown>;
}

export type MailNotificationPayload =
  | {
      to?: string;
      subject?: string;
      template: EmailTemplateName;
      data: EmailTemplateData<EmailTemplateName>;
    }
  | {
      to?: string;
      subject: string;
      html: string;
      text?: string;
    };

export abstract class Notification {
  /**
   * Get the channels the notification should be sent on.
   */
  abstract via(notifiable: Notifiable): string[];

  /**
   * Get the mail representation of the notification.
   */
  toMail?(notifiable: Notifiable): MailNotificationPayload | Promise<MailNotificationPayload>;

  /**
   * Get the database representation of the notification.
   */
  toDatabase?(notifiable: Notifiable): DatabaseNotificationPayload | Promise<DatabaseNotificationPayload>;

  /**
   * Get the broadcast representation of the notification.
   */
  toBroadcast?(notifiable: Notifiable): BroadcastNotificationPayload | Promise<BroadcastNotificationPayload>;
}
