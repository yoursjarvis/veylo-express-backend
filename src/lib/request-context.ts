import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContextStore {
  userId?: string;
  userEmail?: string;
  activeOrganizationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const requestContextStorage =
  new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContextStorage.getStore();
}
