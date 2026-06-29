import {
  type NextFunction,
  type Request,
  RequestHandler,
  type Response,
} from "express";

export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
