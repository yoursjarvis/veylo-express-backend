import { config } from "@/utils/config";
import type { NextFunction, Request, Response } from "express";

type RateLimitKey = string;

interface Bucket {
  resetAt: number;
  count: number;
}

const buckets = new Map<RateLimitKey, Bucket>();
let lastCleanupAt = 0;

function nowMs(): number {
  return Date.now();
}

export function rateLimit(options: {
  keyPrefix: string;
  windowMs: number;
  max: number;
  key: (req: Request) => string;
  message?: string;
}) {
  const message = options.message ?? "Too many requests";

  return (req: Request, res: Response, next: NextFunction) => {
    // If disabled globally
    if (config("app.env") === "test") return next();

    const key = `${options.keyPrefix}:${options.key(req)}`;
    const ts = nowMs();

    // Opportunistic cleanup to avoid unbounded memory growth.
    if (ts - lastCleanupAt > 60_000 && buckets.size > 10_000) {
      for (const [k, v] of buckets.entries()) {
        if (v.resetAt <= ts) buckets.delete(k);
      }
      lastCleanupAt = ts;
    }

    const entry = buckets.get(key);

    if (!entry || entry.resetAt <= ts) {
      buckets.set(key, { resetAt: ts + options.windowMs, count: 1 });
      return next();
    }

    entry.count += 1;
    buckets.set(key, entry);

    if (entry.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - ts) / 1000));
      return res.status(429).json({ success: false, message });
    }

    return next();
  };
}
