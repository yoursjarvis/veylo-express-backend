import { Notifiable, Notification } from "../notification.types";

export interface NotificationDriver {
  send(notifiable: Notifiable, notification: Notification): Promise<void>;
}
