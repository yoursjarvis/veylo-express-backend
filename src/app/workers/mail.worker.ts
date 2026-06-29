import "dotenv/config";

import { Worker } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import type { MailQueuePayload } from "@/app/queues/mail.queue";
import { sendMailMessage } from "@/core/mail";
import { logger } from "@/lib/logger";
import "@/monitoring/tracing";
import { config } from "@/utils/config";

const worker = new Worker<MailQueuePayload>(
  config("mail.queue.name"),
  async (job) => {
    const result = await sendMailMessage(job.data.message);
    if (!result.ok) throw result.error;
    return result;
  },
  {
    connection: {
      host: config("database.redis.host"),
      port: config("database.redis.port"),
      username: config("database.redis.username"),
      password: config("database.redis.password") || undefined,
      maxRetriesPerRequest: null,
    },
    prefix: config("mail.queue.prefix"),
    concurrency: 5,
    telemetry: new BullMQOtel(),
  },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "[MAIL][worker] job completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "[MAIL][worker] job failed");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "[MAIL][worker] shutting down");
  try {
    await worker.close();
  } catch (error) {
    logger.error({ error }, "[MAIL][worker] close failed");
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

logger.info(
  { queue: config("mail.queue.name"), mailer: config("mail.default") },
  "[MAIL][worker] started",
);
