import { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";

import { HTTP_STATUS } from "@/app/constants/http";
import { AppError } from "@/utils/app-error";

// Custom Zod validation error class
export class ZodValidationError extends AppError {
  meta: { errors: { field: string; message: string }[] };

  constructor(zodError: ZodError) {
    super("Validation failed");

    this.name = "ZodValidationError";
    this.errorCode = "VALIDATION_ERROR";
    this.statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;

    this.meta = {
      errors: zodError.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    };
  }
}

export function validateRequest<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        throw result.error;
      }
      req.body = result.data;
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        next(new ZodValidationError(error));
      } else {
        next(error);
      }
    }
  };
}
