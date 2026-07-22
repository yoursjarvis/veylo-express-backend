import { requirePermission } from "@/app/http/middlewares/rbac.middleware";
import { Router, Request } from "express";

import { rbacController } from "@/app/http/controllers/rbac.controller";

const rbacRoutes = Router();

const extractContext = (req: Request) => ({
  workspaceId: req.params.workspaceId || req.params.id,
  projectId:
    req.params.projectId ||
    (req.baseUrl.includes("projects") ? req.params.id : undefined),
  taskId:
    req.params.taskId ||
    (req.baseUrl.includes("tasks") ? req.params.id : undefined),
  organizationId: req.params.organizationId,
});

// Retrieve all system permissions
rbacRoutes.get(
  "/permissions",
  requirePermission("role:read", extractContext),
  rbacController.getPermissions,
);

// Retrieve current user permissions for a context
rbacRoutes.get("/permissions/me", rbacController.getMyPermissions);

// Roles management (Org level)
rbacRoutes.get(
  "/organizations/:orgId/roles",
  rbacController.getOrganizationRoles,
);
rbacRoutes.post(
  "/roles",
  requirePermission("role:create", extractContext),
  rbacController.createRole,
);
rbacRoutes.put("/roles/hierarchy", rbacController.updateRoleHierarchy);
rbacRoutes.put("/roles/:roleId", rbacController.updateRolePermissions);
rbacRoutes.delete("/roles/:roleId", rbacController.deleteRole);

// Role assignments
rbacRoutes.post("/assignments", rbacController.assignRole);
rbacRoutes.delete("/assignments", rbacController.removeRoleAssignment);
rbacRoutes.get("/assignments", rbacController.getUserAssignments);

export { rbacRoutes };
