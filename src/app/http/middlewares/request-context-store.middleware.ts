import { NextFunction, Request, Response } from "express";

import { requestContextStorage, RequestContextStore } from "@/lib/request-context";

export const requestContextStoreMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const store: RequestContextStore = {
    get userId() {
      return req.auth?.user?.id ? String(req.auth.user.id) : undefined;
    },
    get userEmail() {
      return req.auth?.user?.email || undefined;
    },
    get activeOrganizationId() {
      return (
        (req.auth?.session as Record<string, unknown>)?.activeOrganizationId as string ||
        (req.body?.organizationId as string) ||
        (req.query?.organizationId as string) ||
        (req.params?.organizationId as string)
      );
    },
    get ipAddress() {
      return req.ip || req.socket.remoteAddress;
    },
    get userAgent() {
      return req.headers["user-agent"];
    },
  };

  requestContextStorage.run(store, () => {
    next();
  });
};
