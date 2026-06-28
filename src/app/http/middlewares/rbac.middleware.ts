import { Request, Response, NextFunction } from "express";
import { rbacService } from "@/app/services/rbac.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";

export const requirePermission = (
  requiredPermission: string,
  scopeTypeExtractor: (req: Request) => "ORGANIZATION" | "PROJECT",
  scopeIdExtractor: (req: Request) => string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({
        headers: betterAuthHeaders(req),
      });

      if (!session?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const scopeType = scopeTypeExtractor(req);
      const scopeId = scopeIdExtractor(req);

      if (!scopeId) {
        return res.status(400).json({ message: "Scope ID is missing in request" });
      }

      const hasPermission = await rbacService.checkPermission(
        session.user.id,
        scopeType,
        scopeId,
        requiredPermission
      );

      if (!hasPermission) {
        return res.status(403).json({ message: "Forbidden: You do not have the required permissions." });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
