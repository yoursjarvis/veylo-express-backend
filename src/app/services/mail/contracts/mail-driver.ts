import type { MailMessage, MailSendResult } from "@/app/services/mail/mail.types";

export interface MailDriver {
  send(message: MailMessage): Promise<MailSendResult>;
}

