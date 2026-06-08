import type { MailDriver } from "@/core/mail/contracts/mail-driver";
import type { MailMessage, MailSendResult } from "@/core/mail/mail.types";
import { logger } from "@/lib/logger";
import { config } from "@/utils/config";
import { Resend } from "resend";

function resolveResendApiKey(): string | undefined {
  const apiKey = config("mail.mailers.resend.apiKey")?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : undefined;
}

export class ResendDriver implements MailDriver {
  private client: Resend | null;

  constructor() {
    const apiKey = resolveResendApiKey();
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    if (!this.client) {
      const error = new Error(
        "[MAIL][resend] RESEND_API_KEY is missing; cannot send with resend driver",
      );
      logger.error({ error }, "[MAIL][resend] send failed");
      return { ok: false, error };
    }

    try {
      const result = await this.client.emails.send({
        from: message.from.name
          ? `"${message.from.name}" <${message.from.address}>`
          : message.from.address,
        to: message.to.map((t) =>
          t.name ? `"${t.name}" <${t.address}>` : t.address,
        ),
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo
          ? message.replyTo.name
            ? `"${message.replyTo.name}" <${message.replyTo.address}>`
            : message.replyTo.address
          : undefined,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content:
            typeof a.content === "string"
              ? a.content
              : Buffer.isBuffer(a.content)
                ? a.content.toString("base64")
                : String(a.content),
          contentType: a.contentType,
        })),
        headers: message.metadata,
      });

      const messageId =
        "data" in result && result.data && "id" in result.data
          ? String((result.data as { id?: string }).id ?? "")
          : undefined;

      return { ok: true, messageId: messageId || undefined };
    } catch (error) {
      logger.error({ error }, "[MAIL][resend] send failed");
      return { ok: false, error };
    }
  }
}
