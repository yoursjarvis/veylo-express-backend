import type { Response } from "express";

export function ok<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200,
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? {},
  });
}

export function fail(
  res: Response,
  message: string,
  statusCode = 400,
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}
