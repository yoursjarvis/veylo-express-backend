import { randomUUID } from "crypto";

import { type NextFunction, type Request, type Response } from "express";

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const id = randomUUID();

  req.headers["x-request-id"] = id;
  res.setHeader("x-request-id", id);

  next();
};