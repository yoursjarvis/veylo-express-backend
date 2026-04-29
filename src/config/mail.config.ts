import { env } from "@/utils/env";

const mailers = ["smtp", "resend"] as const;
type Mailer = (typeof mailers)[number];

export default {
  default: env("MAIL_MAILER").enum(mailers, "smtp" satisfies Mailer),
  from: {
    address: env("MAIL_FROM_ADDRESS").string("no-reply@example.com"),
    name: env("MAIL_FROM_NAME").string("My App"),
  },
  mailers: {
    smtp: {
      host: env("MAIL_HOST").string("127.0.0.1"),
      port: env("MAIL_PORT").int(587),
      username: env("MAIL_USERNAME").raw(),
      password: env("MAIL_PASSWORD").raw(),
      encryption: env("MAIL_ENCRYPTION").enum(["tls", "ssl", "none"] as const, "tls"),
    },
    resend: {
      apiKey: env("RESEND_API_KEY").raw(),
    },
  },
  queue: {
    name: env("MAIL_QUEUE_NAME").string("mail"),
    prefix: env("MAIL_QUEUE_PREFIX").string("mail"),
    attempts: env("MAIL_QUEUE_ATTEMPTS").int(5),
    backoffMs: env("MAIL_QUEUE_BACKOFF_MS").int(5_000),
    // If Redis is down, queueing fails; fallback keeps UX working.
    fallbackToSend: env("MAIL_QUEUE_FALLBACK_TO_SEND").boolean(true),
  },
};

