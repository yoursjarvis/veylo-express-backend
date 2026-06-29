import { HTTP_STATUS, HttpStatusCodeType } from "@/app/constants/http";
import { ErrorCodeEnum, ErrorCodeEnumType } from "@/app/enums/error-code.enum";

export interface AppErrorOptions {
  statusCode?: HttpStatusCodeType;
  errorCode?: ErrorCodeEnumType;
  details?: unknown;
  cause?: unknown;
  expose?: boolean;
  isOperational?: boolean;
}

export class AppError extends Error {
  public statusCode: HttpStatusCodeType;
  public errorCode: ErrorCodeEnumType;
  public details?: unknown;
  public cause?: unknown;
  public expose: boolean;
  public isOperational: boolean;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);

    this.name = this.constructor.name;

    this.statusCode = options.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR;

    this.errorCode = options.errorCode ?? ErrorCodeEnum.INTERNAL_SERVER_ERROR;

    this.details = options.details;
    this.cause = options.cause;

    this.expose =
      options.expose ?? (this.statusCode >= 400 && this.statusCode < 500);

    this.isOperational = options.isOperational ?? true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/* Common Errors */

export class BadRequestException extends AppError {
  constructor(message = "Bad Request", details?: unknown) {
    super(message, {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ErrorCodeEnum.BAD_REQUEST,
      details,
    });
  }
}

export class UnauthorizedException extends AppError {
  constructor(message = "Unauthorized") {
    super(message, {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      errorCode: ErrorCodeEnum.UNAUTHORIZED,
    });
  }
}

export class ForbiddenException extends AppError {
  constructor(message = "Forbidden") {
    super(message, {
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ErrorCodeEnum.FORBIDDEN,
    });
  }
}

export class NotFoundException extends AppError {
  constructor(message = "Not Found") {
    super(message, {
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ErrorCodeEnum.RESOURCE_NOT_FOUND,
    });
  }
}

export class ValidationException extends AppError {
  constructor(details?: unknown) {
    super("Validation Failed", {
      statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
      details,
    });
  }
}

export class DatabaseException extends AppError {
  constructor(message = "Database Error", cause?: unknown) {
    super(message, {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCodeEnum.DATABASE_ERROR,
      expose: false,
      cause,
    });
  }
}
