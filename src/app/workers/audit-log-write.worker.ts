import "dotenv/config";

import { Worker } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import type { AuditLogWritePayload } from "@/app/services/audit-log.service";
import { auditLogService } from "@/app/services/audit-log.service";
import { logger } from "@/lib/logger";
import "@/monitoring/tracing";
import { config } from "@/utils/config";

const worker = new Worker<AuditLogWritePayload>(
  "audit-log-write",
  async (job) => {
    logger.debug(
      { jobId: job.id },
      "[AUDIT_LOG_WRITE][worker] processing write log job",
    );
    await auditLogService.processWriteJob(job.data);
  },
  {
    connection: {
      host: config("database.redis.host"),
      port: config("database.redis.port"),
      username: config("database.redis.username"),
      password: config("database.redis.password") || undefined,
      maxRetriesPerRequest: null,
    },
    prefix: config("queue.auditLogWrite.prefix"),
    concurrency: 10, // Process up to 10 logs concurrently to handle bursts
    telemetry: new BullMQOtel(),
  },
);

worker.on("completed", (job) => {
  logger.debug({ jobId: job.id }, "[AUDIT_LOG_WRITE][worker] job completed");
});

worker.on("failed", (job, error) => {
  logger.error(
    { jobId: job?.id, error },
    "[AUDIT_LOG_WRITE][worker] job failed",
  );
});

async function shutdown(signal: string) {
  logger.info({ signal }, "[AUDIT_LOG_WRITE][worker] shutting down");
  try {
    await worker.close();
  } catch (error) {
    logger.error({ error }, "[AUDIT_LOG_WRITE][worker] close failed");
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

logger.info({ queue: "audit-log-write" }, "[AUDIT_LOG_WRITE][worker] started");
