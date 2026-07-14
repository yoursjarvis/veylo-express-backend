import { env } from "@/utils/env";

const redisPrefix = env("REDIS_PREFIX").string("veylo_redis_local");

export default {
  mail: {
    prefix: env("MAIL_QUEUE_PREFIX").string(`${redisPrefix}_bull_mq_mail`),
  },
  media: {
    prefix: env("MEDIA_QUEUE_PREFIX").string(`${redisPrefix}_bull_mq_media`),
  },
  auditLogExport: {
    prefix: env("AUDIT_LOG_EXPORT_QUEUE_PREFIX").string(
      `${redisPrefix}_bull_mq_audit_logs_export`,
    ),
  },
  auditLogWrite: {
    prefix: env("AUDIT_LOG_WRITE_QUEUE_PREFIX").string(
      `${redisPrefix}_bull_mq_audit_logs_write`,
    ),
  },
};
