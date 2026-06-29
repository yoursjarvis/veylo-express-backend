import path from "path";

import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { healthController } from "@/app/http/controllers/health.controller";
import { metricsMiddleware } from "@/app/http/middlewares/metrics.middleware";
import { requestIdMiddleware } from "@/app/http/middlewares/request-id.middleware";
import { auth } from "@/lib/auth/auth";
import { logger } from "@/lib/logger";
import { register } from "@/monitoring/metrics";
import { routes } from "@/routes";
import { config } from "@/utils/config";

import { errorMiddleware } from "./app/http/middlewares/error-handler.middlware";
import { rateLimit } from "./app/http/middlewares/rate-limit.middleware";
import { bullBoardAdapter } from "./lib/bull-board";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow loading images from different origins if needed
    xFrameOptions: false, // Allow frontend to frame PDFs for preview
    contentSecurityPolicy: false, // Allow browser to render PDFs
  }),
);

app.use(requestIdMiddleware);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] as string,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = config("app.origins");
      if (allowed.includes("*")) return callback(null, true);
      if (!origin) return callback(null, true); // non-browser clients

      if (allowed.includes(origin)) return callback(null, true);

      try {
        const originUrl = new URL(origin);
        for (const allowedStr of allowed) {
          if (allowedStr === "*") continue;
          const allowedUrl = new URL(allowedStr);
          if (
            originUrl.protocol === allowedUrl.protocol &&
            originUrl.port === allowedUrl.port &&
            (originUrl.hostname === allowedUrl.hostname ||
              originUrl.hostname.endsWith(`.${allowedUrl.hostname}`))
          ) {
            return callback(null, true);
          }
        }
      } catch (_e) {
        // Ignore invalid URLs
      }

      return callback(null, false);
    },
    credentials: config("cors.credentials"),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  }),
);

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from storage directory
const storageRoot = config("storage.disks.local.root") || "storage/app";
app.use("/storage", express.static(path.join(process.cwd(), storageRoot)));

app.use(metricsMiddleware);

app.use(
  rateLimit({
    keyPrefix: "global",
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 100 requests per window
    key: (req) => req.ip || "unknown",
  }),
);

// BullMQ Admin Dashboard
app.use("/admin/queues", bullBoardAdapter.getRouter());

// Main API Routes
app.use(routes);

// Better Auth handler (catches what routes doesn't, like social callbacks)
app.use("/api/v1/auth", toNodeHandler(auth));

app.get("/healthz", healthController.healthz);
app.get("/readyz", healthController.readyz);
app.get("/livez", healthController.livez);
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    env: config("app.env"),
  });
});

app.use(errorMiddleware);

export default app;
