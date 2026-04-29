import type { Response } from "express";

export function ok<T>(
  res: Response,
  message: string,
  data?: T
): Response {
  return res.json({
    success: true,
    message,
    data: data ?? {},
  });
}

export function fail(
  res: Response,
  message: string,
  statusCode = 400
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

