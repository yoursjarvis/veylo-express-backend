import { Request, Response, NextFunction } from "express";

import { rbacService } from "@/app/services/rbac.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";

type ContextExtractor = (req: Request) => {
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
} | Promise<{
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
}>;

export const requirePermission = (
  requiredPermission: string,
  contextExtractor: ContextExtractor
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({
        headers: betterAuthHeaders(req),
      });

      if (!session?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const context = await contextExtractor(req);

      const hasPermission = await rbacService.authorize(
        session.user.id,
        requiredPermission,
        context
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: "Forbidden: You do not have the required permissions.",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
