import { NextFunction, Request, Response } from "express";
import { ZodError, type ZodIssue } from "zod";

import { logger } from "@/lib/logger";
import { AppError, ValidationException } from "@/utils/app-error";
import { config } from "@/utils/config";
import { parseStack } from "@/utils/parse-stack";

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let error: AppError;

  if (err instanceof ZodError) {
    error = new ValidationException(
      err.issues.map((e: ZodIssue) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    );
  } else if (
    err instanceof AppError ||
    (err &&
      typeof err === "object" &&
      "statusCode" in err &&
      "errorCode" in err)
  ) {
    error = err as AppError;
  } else {
    error = new AppError(
      err instanceof Error ? err.message : "Internal Server Error",
    );
  }

  logger.error({
    requestId: req.headers["x-request-id"],
    method: req.method,
    path: req.originalUrl,
    message: error.message,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    stack: err instanceof Error ? err.stack : undefined,
  });

  const response: Record<string, unknown> = {
    success: false,
    message: error.expose ? error.message : "Something went wrong",
    errorCode: error.errorCode,
    statusCode: error.statusCode,
    requestId: req.headers["x-request-id"],
  };

  if (error.details) {
    response.details = error.details;
  }

  if (config("app.env") !== "production") {
    if (err instanceof Error) {
      response.stack = err.stack;
      response.location = parseStack(err.stack);
    }
  }

  res.status(error.statusCode).json(response);
};
