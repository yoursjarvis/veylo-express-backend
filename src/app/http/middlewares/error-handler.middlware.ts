import { logger } from "@/lib/logger";
import { AppError } from "@/utils/app-error";
import { config } from "@/utils/config";
import { parseStack } from "@/utils/parse-stack";
import { NextFunction, Request, Response } from "express";

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const error =
    err instanceof AppError
      ? err
      : new AppError(
          err instanceof Error ? err.message : "Internal Server Error"
        );

  logger.error({
    requestId: req.headers["x-request-id"],
    method: req.method,
    path: req.originalUrl,
    message: error.message,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    stack: err instanceof Error ? err.stack : undefined,
  });

  const response: any = {
    success: false,
    message: error.expose
      ? error.message
      : "Something went wrong",
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
