import type { NextFunction, Request, Response } from "express";
import { RateLimiterRedis } from "rate-limiter-flexible";

import { redis } from "@/lib/redis";
import { config } from "@/utils/config";

export function rateLimit(options: {
  keyPrefix: string;
  windowMs: number;
  max: number;
  key: (req: Request) => string;
  message?: string;
}) {
  const message = options.message ?? "Too many requests";

  const rlr = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: options.keyPrefix,
    points: options.max,
    duration: options.windowMs / 1000,
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    // If disabled globally
    if (config("app.env") === "test") return next();

    const key = options.key(req);

    try {
      await rlr.consume(key);
      return next();
    } catch (error: unknown) {
      if (error && typeof error === "object" && "msBeforeNext" in error) {
        const msBeforeNext = (error as { msBeforeNext: number }).msBeforeNext;
        res.setHeader("Retry-After", Math.ceil(msBeforeNext / 1000));
        return res.status(429).json({ success: false, message });
      }

      // Fallback for unexpected errors to not block the request
      return next();
    }
  };
}
