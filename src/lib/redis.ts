import Redis from "ioredis";

import { logger } from "@/lib/logger";
import { config } from "@/utils/config";

const redis =
  new Redis({
    host: config("database.redis.host"),
    port: config("database.redis.port"),
    username: config("database.redis.username"),
    password: config("database.redis.password") || undefined,
    keyPrefix: config("database.redis.prefix"),
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
  });

redis.on("error", (error) => {
  logger.error({ error }, "Redis error");
});

export { redis };

