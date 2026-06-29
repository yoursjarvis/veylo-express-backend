import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import type { MailDriver } from "@/core/mail/contracts/mail-driver";
import type {
  MailAddress,
  MailMessage,
  MailSendResult,
} from "@/core/mail/mail.types";
import { logger } from "@/lib/logger";
import { config } from "@/utils/config";

function resolveSecure(): boolean {
  const encryption = config("mail.mailers.smtp.encryption");
  if (encryption === "ssl") return true;
  if (encryption === "none") return false;
  // "tls": usually STARTTLS (secure=false)
  return false;
}

function buildTransportOptions(): SMTPTransport.Options {
  const username = config("mail.mailers.smtp.username");
  const password = config("mail.mailers.smtp.password");

  return {
    host: config("mail.mailers.smtp.host"),
    port: config("mail.mailers.smtp.port"),
    secure: resolveSecure(),
    auth:
      username && password
        ? {
            user: username,
            pass: password,
          }
        : undefined,
    requireTLS: config("mail.mailers.smtp.encryption") === "tls",
  };
}

export class SmtpDriver implements MailDriver {
  private transporter = nodemailer.createTransport(buildTransportOptions());

  async send(message: MailMessage): Promise<MailSendResult> {
    try {
      logger.info(
        {
          to: message.to.map((t: MailAddress) => t.address),
          subject: message.subject,
        },
        "[MAIL][smtp] sending email",
      );
      const info = await this.transporter.sendMail({
        from: message.from.name
          ? `"${message.from.name}" <${message.from.address}>`
          : message.from.address,
        to: message.to.map((t) =>
          t.name ? `"${t.name}" <${t.address}>` : t.address,
        ),
        replyTo: message.replyTo
          ? message.replyTo.name
            ? `"${message.replyTo.name}" <${message.replyTo.address}>`
            : message.replyTo.address
          : undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      return { ok: true, messageId: String(info.messageId ?? "") || undefined };
    } catch (error) {
      logger.error({ error }, "[MAIL][smtp] send failed");
      return { ok: false, error };
    }
  }
}
