import {
  httpRequestDuration,
  httpRequestsTotal,
} from "@/monitoring/metrics";
import { type NextFunction, type Request, type Response } from "express";

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const end = httpRequestDuration.startTimer();

  res.setMaxListeners(20);

  res.on("finish", () => {
    const route = req.route?.path || req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    end({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
  });

  next();
};