import "dotenv/config";

import { Worker } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import type { AuditLogQueuePayload } from "@/app/queues/audit-log.queue";
import { auditLogService } from "@/app/services/audit-log.service";
import { logger } from "@/lib/logger";
import "@/monitoring/tracing";
import { config } from "@/utils/config";

const worker = new Worker<AuditLogQueuePayload>(
  "audit-log-export",
  async (job) => {
    logger.info({ jobId: job.id }, "[AUDIT_LOG][worker] processing export job");
    await auditLogService.processExportJob(job.data);
  },
  {
    connection: {
      host: config("database.redis.host"),
      port: config("database.redis.port"),
      username: config("database.redis.username"),
      password: config("database.redis.password") || undefined,
      maxRetriesPerRequest: null,
    },
    prefix: "veylo_redis_local",
    concurrency: 2,
    telemetry: new BullMQOtel(),
  },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "[AUDIT_LOG][worker] job completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "[AUDIT_LOG][worker] job failed");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "[AUDIT_LOG][worker] shutting down");
  try {
    await worker.close();
  } catch (error) {
    logger.error({ error }, "[AUDIT_LOG][worker] close failed");
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

logger.info(
  { queue: "audit-log-export" },
  "[AUDIT_LOG][worker] started",
);
