import "dotenv/config";

import "@/monitoring/tracing";
import { logger } from "@/lib/logger";
import { config } from "@/utils/config";
import { sendMailMessage } from "@/app/services/mail";
import { Worker } from "bullmq";
import Redis from "ioredis";
import type { MailQueuePayload } from "@/queues/mail.queue";

function createBullConnection() {
  return new Redis({
    host: config("database.redis.host"),
    port: config("database.redis.port"),
    username: config("database.redis.username"),
    password: config("database.redis.password") || undefined,
    keyPrefix: config("database.redis.prefix"),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
}

const connection = createBullConnection();

const worker = new Worker<MailQueuePayload>(
  config("mail.queue.name"),
  async (job) => {
    const result = await sendMailMessage(job.data.message);
    if (!result.ok) throw result.error;
    return result;
  },
  {
    connection,
    prefix: config("mail.queue.prefix"),
    concurrency: 5,
  }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "[MAIL][worker] job completed");
});

worker.on("failed", (job, error) => {
  logger.error(
    { jobId: job?.id, error },
    "[MAIL][worker] job failed"
  );
});

async function shutdown(signal: string) {
  logger.info({ signal }, "[MAIL][worker] shutting down");
  try {
    await worker.close();
  } catch (error) {
    logger.error({ error }, "[MAIL][worker] close failed");
  }
  try {
    await connection.quit();
  } catch (error) {
    logger.error({ error }, "[MAIL][worker] redis quit failed");
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

logger.info(
  { queue: config("mail.queue.name"), mailer: config("mail.default") },
  "[MAIL][worker] started"
);

