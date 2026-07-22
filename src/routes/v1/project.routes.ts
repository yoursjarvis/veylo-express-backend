import { requirePermission } from "@/app/http/middlewares/rbac.middleware";
import { Router, Request } from "express";

import { projectController } from "@/app/http/controllers/project.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { upload } from "@/app/http/middlewares/upload.middleware";

export const projectRoutes = Router();

const extractContext = (req: Request) => ({
  workspaceId: req.params.workspaceId || req.params.id,
  projectId: req.params.projectId || (req.baseUrl.includes('projects') ? req.params.id : undefined),
  taskId: req.params.taskId || (req.baseUrl.includes('tasks') ? req.params.id : undefined),
  organizationId: req.params.organizationId
});


// Projects management
projectRoutes.post(
  "/workspaces/:workspaceId/projects",
  requireAuth,
  projectController.createProject,
);
projectRoutes.get(
  "/workspaces/:workspaceId/projects",
  requireAuth,
  projectController.getProjects,
);
projectRoutes.get(
  "/organizations/:organizationId/projects",
  requireAuth,
  projectController.getOrgProjects,
);

import { workspaceController } from "@/app/http/controllers/workspace.controller";
projectRoutes.get(
  "/organizations/:organizationId/workspaces",
  requireAuth,
  workspaceController.getOrgWorkspaces,
);

projectRoutes.get("/project-templates", projectController.getProjectTemplates);
projectRoutes.get(
  "/project-templates/:slug",
  projectController.getProjectTemplateBySlug,
);

projectRoutes.get("\/projects\/:id", requireAuth, requirePermission("project:read", extractContext), requirePermission("project:read", extractContext), projectController.getProject);
projectRoutes.patch("\/projects\/:id",
  requireAuth, requirePermission("project:update", extractContext),
  projectController.updateProject,
);
projectRoutes.delete("\/projects\/:id",
  requireAuth, requirePermission("project:delete", extractContext),
  projectController.deleteProject,
);
projectRoutes.post("\/projects\/:id\/restore",
  requireAuth, requirePermission("project:restore", extractContext),
  projectController.restoreProject,
);
projectRoutes.delete("\/projects\/:id\/force",
  requireAuth, requirePermission("project:force-delete", extractContext),
  projectController.forceDeleteProject,
);

// Project Members
projectRoutes.get(
  "/projects/:id/members",
  requireAuth,
  projectController.getProjectMembers,
);
projectRoutes.post(
  "/projects/:id/members",
  requireAuth,
  projectController.addProjectMembers,
);
projectRoutes.delete(
  "/projects/:id/members/:userId",
  requireAuth,
  projectController.removeProjectMember,
);

// Project Vault
projectRoutes.get("\/projects\/:id\/vault",
  requireAuth, requirePermission("project-vault:read", extractContext),
  projectController.getProjectVault,
);
projectRoutes.post(
  "/projects/:id/vault/services",
  requireAuth,
  projectController.addVaultService,
);
projectRoutes.delete(
  "/projects/:id/vault/services/:serviceId",
  requireAuth,
  projectController.deleteVaultService,
);
projectRoutes.post(
  "/projects/:id/vault/services/:serviceId/restore",
  requireAuth,
  projectController.restoreVaultService,
);
projectRoutes.delete(
  "/projects/:id/vault/services/:serviceId/force",
  requireAuth,
  projectController.forceDeleteVaultService,
);

// Vault Items
projectRoutes.post(
  "/projects/:id/vault/services/:serviceId/items",
  requireAuth,
  projectController.addOrUpdateVaultItem,
);
projectRoutes.patch(
  "/projects/:id/vault/items/:itemId",
  requireAuth,
  projectController.updateVaultItem,
);
projectRoutes.delete(
  "/projects/:id/vault/items/:itemId",
  requireAuth,
  projectController.deleteVaultItem,
);
projectRoutes.post(
  "/projects/:id/vault/items/:itemId/restore",
  requireAuth,
  projectController.restoreVaultItem,
);
projectRoutes.delete(
  "/projects/:id/vault/items/:itemId/force",
  requireAuth,
  projectController.forceDeleteVaultItem,
);

// Project Files
projectRoutes.post(
  "/projects/:id/files",
  requireAuth,
  upload.single("file"),
  projectController.uploadProjectFile,
);
projectRoutes.get(
  "/projects/:id/files",
  requireAuth,
  projectController.getProjectFiles,
);
projectRoutes.delete(
  "/projects/:id/files/:fileId",
  requireAuth,
  projectController.deleteProjectFile,
);

// Project Automation Rules
projectRoutes.get(
  "/projects/:id/automation-rules",
  requireAuth,
  projectController.getAutomationRules,
);
projectRoutes.post(
  "/projects/:id/automation-rules",
  requireAuth,
  projectController.createAutomationRule,
);
projectRoutes.put(
  "/projects/:id/automation-rules/:ruleId",
  requireAuth,
  projectController.updateAutomationRule,
);
projectRoutes.delete(
  "/projects/:id/automation-rules/:ruleId",
  requireAuth,
  projectController.deleteAutomationRule,
);
projectRoutes.post(
  "/projects/:id/automation-rules/:ruleId/restore",
  requireAuth,
  projectController.restoreAutomationRule,
);
projectRoutes.delete(
  "/projects/:id/automation-rules/:ruleId/force",
  requireAuth,
  projectController.forceDeleteAutomationRule,
);
