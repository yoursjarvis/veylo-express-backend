import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";

export function betterAuthHeaders(req: Request): Headers {
  return fromNodeHeaders(req.headers);
}

