import crypto from "crypto";

import { NextFunction, Request, Response } from "express";

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestId = crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  next();
};
