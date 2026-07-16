import { Queue } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import type { AuditLogFilters, AuditLogWritePayload } from "@/app/services/audit-log.service";
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
    prefix: config("queue.auditLogExport.prefix"),
    telemetry: new BullMQOtel(),
  },
);

export const auditLogWriteQueue = new Queue<AuditLogWritePayload>(
  "audit-log-write",
  {
    connection: {
      host: config("database.redis.host"),
      port: config("database.redis.port"),
      username: config("database.redis.username"),
      password: config("database.redis.password") || undefined,
      maxRetriesPerRequest: null,
    },
    prefix: config("queue.auditLogWrite.prefix"),
    telemetry: new BullMQOtel(),
  },
);
