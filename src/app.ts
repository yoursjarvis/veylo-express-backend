import { healthController } from "@/app/http/controllers/health.controller";
import { metricsMiddleware } from "@/app/http/middlewares/metrics.middleware";
import { requestIdMiddleware } from "@/app/http/middlewares/request-id.middleware";
import { logger } from "@/lib/logger";
import { register } from "@/monitoring/metrics";
import { routes } from "@/routes";
import { config } from "@/utils/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { errorMiddleware } from "./app/http/middlewares/error-handler.middlware";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());

app.use(requestIdMiddleware);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] as string,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = config("app.origins");
      if (allowed.includes("*")) return callback(null, true);
      if (!origin) return callback(null, true); // non-browser clients
      return callback(null, allowed.includes(origin));
    },
    credentials: config("cors.credentials"),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  })
);

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true }));

app.use(metricsMiddleware);

app.use(routes);

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
    env: config("app.env")
  });
});

app.use(errorMiddleware);

export default app;
