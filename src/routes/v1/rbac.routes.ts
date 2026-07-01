import { Router } from "express";

import { rbacController } from "@/app/http/controllers/rbac.controller";

const rbacRoutes = Router();

// Retrieve all system permissions
rbacRoutes.get("/permissions", rbacController.getPermissions);

// Retrieve current user permissions for a context
rbacRoutes.get("/permissions/me", rbacController.getMyPermissions);

// Roles management (Org level)
rbacRoutes.get(
  "/organizations/:orgId/roles",
  rbacController.getOrganizationRoles,
);
rbacRoutes.post("/roles", rbacController.createRole);
rbacRoutes.put("/roles/:roleId", rbacController.updateRolePermissions);
rbacRoutes.delete("/roles/:roleId", rbacController.deleteRole);

// Role assignments
rbacRoutes.post("/assignments", rbacController.assignRole);
rbacRoutes.delete("/assignments", rbacController.removeRoleAssignment);
rbacRoutes.get("/assignments", rbacController.getUserAssignments);

export { rbacRoutes };
