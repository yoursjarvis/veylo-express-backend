import { NextFunction, Request, Response } from "express";

import { rbacService } from "@/app/services/rbac.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";

type ContextExtractor = (req: Request) =>
  | {
      organizationId?: string | unknown;
      workspaceId?: string | unknown;
      projectId?: string | unknown;
      taskId?: string | unknown;
    }
  | Promise<{
      organizationId?: string | unknown;
      workspaceId?: string | unknown;
      projectId?: string | unknown;
      taskId?: string | unknown;
    }>;

export const requirePermission = (
  requiredPermission: string,
  contextExtractor: ContextExtractor,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({
        headers: betterAuthHeaders(req),
      });

      if (!session?.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userContext = await contextExtractor(req);
      const activeOrganizationId = (
        session.session as { activeOrganizationId?: string }
      )?.activeOrganizationId;

      const context = {
        organizationId: (userContext.organizationId || activeOrganizationId) as
          string | undefined,
        workspaceId: userContext.workspaceId as string | undefined,
        projectId: userContext.projectId as string | undefined,
        taskId: userContext.taskId as string | undefined,
      };

      const hasPermission = await rbacService.authorize(
        session.user.id,
        requiredPermission,
        context,
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: `Forbidden: You do not have the required permissions (${requiredPermission}).`,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const rbacResolver = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      return next(); // Let requireAuth handle it
    }

    const activeOrganizationId = (
      session.session as { activeOrganizationId?: string }
    )?.activeOrganizationId;

    // Extract context from URL
    const projectIdMatch = req.path.match(/\/projects\/([^/]+)/);
    const taskIdMatch = req.path.match(/\/tasks\/([^/]+)/);
    const workspaceIdMatch = req.path.match(/\/workspaces\/([^/]+)/);

    // Some routes might just be /:id
    const parts = req.path.split("/");
    let genericId = undefined;
    if (
      parts.length > 1 &&
      parts[parts.length - 1] !== "" &&
      !["restore", "force", "members", "audit-logs", "export", "kpi"].includes(
        parts[parts.length - 1],
      )
    ) {
      genericId = parts[parts.length - 1];
    }

    const context = {
      organizationId: activeOrganizationId,
      projectId: projectIdMatch ? projectIdMatch[1] : undefined,
      taskId: taskIdMatch ? taskIdMatch[1] : undefined,
      workspaceId: workspaceIdMatch ? workspaceIdMatch[1] : undefined,
    };

    // Now map route + method to requiredPermission
    const reqPerm = mapRouteToPermission(req.method, req.path);
    if (!reqPerm) {
      return next(); // No permission required or not mapped
    }

    const hasPermission = await rbacService.authorize(
      session.user.id,
      reqPerm,
      context,
    );

    if (!hasPermission) {
      return res.status(403).json({
        message: `Forbidden: You do not have the required permissions (${reqPerm}).`,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

function mapRouteToPermission(method: string, path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  let resource = parts[0];
  if (resource.endsWith("s") && resource !== "status") {
    resource = resource.slice(0, -1);
  }

  if (parts.includes("members")) {
    if (parts[0] === "projects") {
      resource = "project-member";
      if (method === "POST") return `${resource}:invite-member`;
      if (method === "DELETE") return `${resource}:remove-member`;
    } else if (parts[0] === "workspaces") {
      resource = "workspace";
      if (method === "POST") return `${resource}:invite-members`;
      if (method === "DELETE") return `${resource}:remove-members`;
    }
  } else if (parts.includes("vault") || parts.includes("vaults")) {
    resource = "project-vault";
  } else if (parts.includes("custom-fields")) {
    resource = "project-custom-field";
  } else if (parts.includes("statuses")) {
    resource = "project-status";
  } else if (parts.includes("labels")) {
    resource = "project-label";
  } else if (parts.includes("webhooks")) {
    resource = "project-webhook";
  } else if (parts.includes("automations")) {
    resource = "project-automation";
  } else if (parts.includes("epics")) {
    resource = "project-epic";
  } else if (parts.includes("milestones")) {
    resource = "project-milestone";
  } else if (parts.includes("docs")) {
    resource = "project-doc";
    if (method === "GET") return `${resource}:view`;
  } else if (parts.includes("comments")) {
    if (method === "POST" || method === "PUT" || method === "PATCH")
      return `task:comment`;
    if (method === "DELETE") return `task:delete-own-comment`;
  }

  let action = "read";
  switch (method.toUpperCase()) {
    case "GET":
      action = "read";
      break;
    case "POST":
      action = "create";
      break;
    case "PUT":
    case "PATCH":
      action = "update";
      break;
    case "DELETE":
      action = "delete";
      break;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart === "restore") action = "restore";
  if (lastPart === "force" || lastPart === "force-delete")
    action = "force-delete";

  return `${resource}:${action}`;
}
