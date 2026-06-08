import type { MailMessage, MailSendResult } from "@/core/mail/mail.types";

export interface MailDriver {
  send(message: MailMessage): Promise<MailSendResult>;
}
