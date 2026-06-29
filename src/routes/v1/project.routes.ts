import { Router } from "express";

import { projectController } from "@/app/http/controllers/project.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { upload } from "@/app/http/middlewares/upload.middleware";

export const projectRoutes = Router();

// Projects management
projectRoutes.post("/workspaces/:workspaceId/projects", requireAuth, projectController.createProject);
projectRoutes.get("/workspaces/:workspaceId/projects", requireAuth, projectController.getProjects);
projectRoutes.get("/project-templates", projectController.getProjectTemplates);
projectRoutes.get("/project-templates/:slug", projectController.getProjectTemplateBySlug);

projectRoutes.get("/projects/:id", requireAuth, projectController.getProject);
projectRoutes.patch("/projects/:id", requireAuth, projectController.updateProject);
projectRoutes.delete("/projects/:id", requireAuth, projectController.deleteProject);

// Project Members
projectRoutes.get("/projects/:id/members", requireAuth, projectController.getProjectMembers);
projectRoutes.post("/projects/:id/members", requireAuth, projectController.addProjectMembers);
projectRoutes.delete("/projects/:id/members/:userId", requireAuth, projectController.removeProjectMember);

// Project Vault
projectRoutes.get("/projects/:id/vault", requireAuth, projectController.getProjectVault);
projectRoutes.post("/projects/:id/vault/services", requireAuth, projectController.addVaultService);
projectRoutes.delete("/projects/:id/vault/services/:serviceId", requireAuth, projectController.deleteVaultService);

// Vault Items
projectRoutes.post("/projects/:id/vault/services/:serviceId/items", requireAuth, projectController.addOrUpdateVaultItem);
projectRoutes.patch("/projects/:id/vault/items/:itemId", requireAuth, projectController.updateVaultItem);
projectRoutes.delete("/projects/:id/vault/items/:itemId", requireAuth, projectController.deleteVaultItem);

// Project Files
projectRoutes.post("/projects/:id/files", requireAuth, upload.single("file"), projectController.uploadProjectFile);
projectRoutes.get("/projects/:id/files", requireAuth, projectController.getProjectFiles);
projectRoutes.delete("/projects/:id/files/:fileId", requireAuth, projectController.deleteProjectFile);

// Project Automation Rules
projectRoutes.get("/projects/:id/automation-rules", requireAuth, projectController.getAutomationRules);
projectRoutes.post("/projects/:id/automation-rules", requireAuth, projectController.createAutomationRule);
projectRoutes.put("/projects/:id/automation-rules/:ruleId", requireAuth, projectController.updateAutomationRule);
projectRoutes.delete("/projects/:id/automation-rules/:ruleId", requireAuth, projectController.deleteAutomationRule);
