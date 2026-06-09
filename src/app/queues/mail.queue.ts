import type { MailMessage } from "@/core/mail/mail.types";
import { config } from "@/utils/config";
import { Queue } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

export type MailQueuePayload = {
  message: MailMessage;
};

export const mailQueue = new Queue<MailQueuePayload>(config("mail.queue.name"), {
  connection: {
    host: config("database.redis.host"),
    port: config("database.redis.port"),
    username: config("database.redis.username"),
    password: config("database.redis.password") || undefined,
    maxRetriesPerRequest: null,
  },
  prefix: config("mail.queue.prefix"),
  telemetry: new BullMQOtel(),
});

