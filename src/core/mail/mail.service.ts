import { mailQueue } from "@/app/queues/mail.queue";
import type { MailDriver } from "@/core/mail/contracts/mail-driver";
import type {
  MailAddress,
  MailAttachment,
  MailMessage,
  MailSendResult,
} from "@/core/mail/mail.types";
import { logger } from "@/lib/logger";
import {
  renderEmail,
  type EmailTemplateData,
  type EmailTemplateName,
} from "@/templates/emails";
import { config } from "@/utils/config";

import { ResendDriver } from "./drivers/resend.driver";
import { SmtpDriver } from "./drivers/smtp.driver";

type MailerName = "smtp" | "resend";

function normalizeAddress(address: string): string {
  return String(address ?? "").trim();
}

function resolveFrom(): MailAddress {
  return {
    address: config("mail.from.address"),
    name: config("mail.from.name"),
  };
}

const drivers: Record<MailerName, MailDriver> = {
  smtp: new SmtpDriver(),
  resend: new ResendDriver(),
};

function resolveDriver(): { name: MailerName; driver: MailDriver } {
  const defaultMailer = config("mail.default");
  const name: MailerName = defaultMailer === "resend" ? "resend" : "smtp";

  return { name, driver: drivers[name] ?? drivers.smtp };
}

export async function sendMailMessage(
  message: MailMessage,
): Promise<MailSendResult> {
  const { name, driver } = resolveDriver();
  const result = await driver.send(message);
  if (!result.ok) {
    logger.error({ error: result.error, mailer: name }, "[MAIL] send failed");
  }
  return result;
}

class MailBuilder<_N extends EmailTemplateName | undefined = undefined> {
  private toList: MailAddress[] = [];
  private fromAddress: MailAddress = resolveFrom();
  private subjectLine: string | undefined;
  private templateName: EmailTemplateName | undefined;
  private templateData: unknown;
  private attachmentsList: MailAttachment[] = [];

  to(email: string, name?: string) {
    const address = normalizeAddress(email);
    if (address) this.toList.push({ address, name });
    return this;
  }

  from(email: string, name?: string) {
    const address = normalizeAddress(email);
    if (address) this.fromAddress = { address, name };
    return this;
  }

  subject(subject: string) {
    this.subjectLine = subject;
    return this;
  }

  view<TName extends EmailTemplateName>(
    name: TName,
    data: EmailTemplateData<TName>,
  ): MailBuilder<TName> {
    (this as unknown as MailBuilder<TName>).templateName = name;
    (this as unknown as MailBuilder<TName>).templateData = data;
    return this as unknown as MailBuilder<TName>;
  }

  attach(attachment: MailAttachment) {
    this.attachmentsList.push(attachment);
    return this;
  }

  private buildMessage(): MailMessage {
    if (this.toList.length === 0) {
      throw new Error("[MAIL] Missing recipient; call .to(email) first");
    }
    if (!this.templateName) {
      throw new Error("[MAIL] Missing template; call .view(name, data) first");
    }

    const rendered = renderEmail(this.templateName, this.templateData as never);

    return {
      to: this.toList,
      from: this.fromAddress,
      subject: this.subjectLine ?? rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments:
        this.attachmentsList.length > 0 ? this.attachmentsList : undefined,
      metadata: rendered.headers,
    };
  }

  async send(): Promise<MailSendResult> {
    let message: MailMessage;
    try {
      message = this.buildMessage();
    } catch (error) {
      logger.error({ error }, "[MAIL] invalid message");
      return { ok: false, error };
    }

    return await sendMailMessage(message);
  }

  async queue(): Promise<
    { ok: true; jobId: string } | { ok: false; error: unknown }
  > {
    let message: MailMessage;
    try {
      message = this.buildMessage();
    } catch (error) {
      logger.error({ error }, "[MAIL] invalid message");
      return { ok: false, error };
    }

    try {
      const job = await mailQueue.add(
        "send",
        { message },
        {
          attempts: config("mail.queue.attempts"),
          backoff: {
            type: "exponential",
            delay: config("mail.queue.backoffMs"),
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      return { ok: true, jobId: String(job.id) };
    } catch (error) {
      logger.error({ error }, "[MAIL][queue] enqueue failed");

      if (config("mail.queue.fallbackToSend")) {
        // Best-effort fallback: attempt direct send rather than failing auth flows.
        void this.send();
        return { ok: true, jobId: "fallback:send" };
      }

      return { ok: false, error };
    }
  }
}

export class MailService {
  to(email: string, name?: string) {
    return new MailBuilder().to(email, name);
  }
}

export const mailService = new MailService();
