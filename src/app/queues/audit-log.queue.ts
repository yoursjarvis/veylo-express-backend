import { Queue } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import type { AuditLogFilters } from "@/app/services/audit-log.service";
import { config } from "@/utils/config";

export type AuditLogQueuePayload = {
  workspaceId?: string;
  organizationId: string;
  userId: string;
  filters: AuditLogFilters;
};

export const auditLogQueue = new Queue<AuditLogQueuePayload>(
  "audit-log-export",
  {
    connection: {
      host: config("database.redis.host"),
      port: config("database.redis.port"),
      username: config("database.redis.username"),
      password: config("database.redis.password") || undefined,
      maxRetriesPerRequest: null,
    },
    prefix: "veylo_redis_local", // Same prefix as in config/redis or other queues
    telemetry: new BullMQOtel(),
  },
);
