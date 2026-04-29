import type { MailMessage } from "@/app/services/mail/mail.types";
import { config } from "@/utils/config";
import { Queue } from "bullmq";
import Redis from "ioredis";

export type MailQueuePayload = {
  message: MailMessage;
};

function createBullConnection() {
  return new Redis({
    host: config("database.redis.host"),
    port: config("database.redis.port"),
    username: config("database.redis.username"),
    password: config("database.redis.password") || undefined,
    // BullMQ uses blocking commands; `null` avoids "max retries per request" issues.
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
}

const connection = createBullConnection();

export const mailQueue = new Queue<MailQueuePayload>(config("mail.queue.name"), {
  connection,
  prefix: config("mail.queue.prefix"),
});
