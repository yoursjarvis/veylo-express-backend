export type MailAddress = {
  address: string;
  name?: string;
};

export type MailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

export type MailMessage = {
  to: MailAddress[];
  from: MailAddress;
  subject: string;
  html: string;
  text?: string;
  replyTo?: MailAddress;
  attachments?: MailAttachment[];
  metadata?: Record<string, string>;
};

export type MailSendResult =
  { ok: true; messageId?: string } | { ok: false; error: unknown };
