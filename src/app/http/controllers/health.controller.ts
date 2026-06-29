import { Request, Response } from "express";
import Redis from "ioredis";

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { config } from "@/utils/config";

const redisClient = new Redis({
  host: config("database.redis.host"),
  port: config("database.redis.port"),
  username: config("database.redis.username"),
  password: config("database.redis.password"),
  keyPrefix: config("database.redis.prefix"),
});

redisClient.on("error", (error) => {
  logger.error({ error }, "Redis connection error");
});

export const healthController = {
  async livez(req: Request, res: Response) {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  },

  async readyz(req: Request, res: Response) {
    try {
      await Promise.all([
        prisma.$queryRaw`SELECT 1`,
        redisClient.ping()
      ]);
      res.status(200).json({
        status: "ready",
        timestamp: new Date().toISOString(),
        checks: {
          postgres: "ok",
          redis: "ok"
        }
      });
    } catch (error) {
      logger.error({ error }, "Readiness check failed");
      res.status(503).json({
        status: "not ready",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  },

  async healthz(req: Request, res: Response) {
    try {
      await Promise.all([
        prisma.$queryRaw`SELECT 1`,
        redisClient.ping()
      ]);
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
};
