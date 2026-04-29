import type { Response } from "express";

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

export function forwardSetCookie(res: Response, headers: Headers): void {
  // `getSetCookie` is available in undici Headers (Node 18+)
  // and is used by Better Auth to expose all Set-Cookie values.
  const setCookies = (headers as HeadersWithSetCookie).getSetCookie?.();

  if (!setCookies || setCookies.length === 0) return;

  res.setHeader("set-cookie", setCookies);
}
