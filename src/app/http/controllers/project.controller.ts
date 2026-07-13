import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import {
  verifyProjectAccess,
  verifyProjectAdmin,
  verifyWorkspaceAdmin,
  resolveSession,
} from "@/app/http/middlewares/project-access.middleware";
import {
  projectCreateSchema,
  projectUpdateSchema,
  vaultServiceSchema,
  vaultItemSchema,
  updateVaultItemSchema,
} from "@/app/http/validators/project.validator";
import { auditLogService } from "@/app/services/audit-log.service";
import { projectService } from "@/app/services/project.service";
import prisma from "@/lib/prisma";
import { BadRequestException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const projectController = {
  createProject: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const { activeOrgId } = await verifyWorkspaceAdmin(req, workspaceId);

    const validatedData = projectCreateSchema.parse(req.body);

    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    const project = await projectService.createProject(
      workspaceId,
      activeOrgId,
      validatedData,
      session?.user?.id,
    );

    if (session?.user) {
      await auditLogService.log({
        workspaceId,
        organizationId: activeOrgId,
        userId: session.user.id,
        action: "CREATE_PROJECT",
        entityType: "PROJECT",
        entityId: project.id,
        entityName: project.title,
        description: `User "${session.user.name}" created project "${project.title}".`,
        req,
      });
    }

    return ok(res, "Project created successfully", project);
  }),

  getProjectTemplates: asyncHandler(async (req: Request, res: Response) => {
    const templates = await projectService.getProjectTemplates();
    return ok(res, "Project templates fetched successfully", templates);
  }),

  getProjectTemplateBySlug: asyncHandler(
    async (req: Request, res: Response) => {
      const slug = req.params.slug as string;
      const template = await projectService.getProjectTemplateBySlug(slug);
      return ok(res, "Project template fetched successfully", template);
    },
  ),

  getProjects: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string;

    let canSeeAll = false;
    let userId: string;

    try {
      const ctx = await verifyWorkspaceAdmin(req, workspaceId);
      canSeeAll = true;
      userId = ctx.userId;
    } catch {
      // Not an admin — fall back to member-only access
      const ctx = await resolveSession(req);
      userId = ctx.userId;
    }

    const projects = await projectService.getProjects(
      workspaceId,
      canSeeAll,
      userId,
    );

    return ok(res, "Projects fetched successfully", projects);
  }),

  getOrgProjects: asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.params.organizationId as string;
    const ctx = await resolveSession(req);

    // For organization-level project listing, we can either check if they are org admins
    // or just return projects they have access to.
    // Here we'll just check if they are members of the org.
    // The service handles returning projects they are members of or all if admin.
    const projects = await projectService.getOrgProjects(
      organizationId,
      ctx.userId,
    );

    return ok(res, "Projects fetched successfully", projects);
  }),

  getProject: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const projectDetails = await projectService.getProject(projectId);

    return ok(res, "Project fetched successfully", projectDetails);
  }),

  updateProject: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);

    const validatedData = projectUpdateSchema.parse(req.body);

    const updatedProject = await projectService.updateProject(
      projectId,
      validatedData,
    );

    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (session?.user) {
      await auditLogService.log({
        workspaceId: updatedProject.workspaceId,
        organizationId: updatedProject.organizationId,
        userId: session.user.id,
        action: "UPDATE_PROJECT",
        entityType: "PROJECT",
        entityId: updatedProject.id,
        entityName: updatedProject.title,
        description: `User "${session.user.name}" updated settings for project "${updatedProject.title}".`,
        metadata: validatedData,
        req,
      });
    }

    return ok(res, "Project updated successfully", updatedProject);
  }),

  deleteProject: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);

    const deletedProject = await projectService.deleteProject(projectId);

    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (session?.user) {
      await auditLogService.log({
        workspaceId: deletedProject.workspaceId,
        organizationId: deletedProject.organizationId,
        userId: session.user.id,
        action: "DELETE_PROJECT",
        entityType: "PROJECT",
        entityId: deletedProject.id,
        entityName: deletedProject.title,
        description: `User "${session.user.name}" soft-deleted project "${deletedProject.title}".`,
        req,
      });
    }

    return ok(res, "Project deleted successfully");
  }),

  restoreProject: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);

    const restoredProject = await projectService.restoreProject(projectId);

    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (session?.user) {
      await auditLogService.log({
        workspaceId: restoredProject.workspaceId,
        organizationId: restoredProject.organizationId,
        userId: session.user.id,
        action: "RESTORE_PROJECT",
        entityType: "PROJECT",
        entityId: restoredProject.id,
        entityName: restoredProject.title,
        description: `User "${session.user.name}" restored project "${restoredProject.title}".`,
        req,
      });
    }

    return ok(res, "Project restored successfully");
  }),

  forceDeleteProject: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);

    const deletedProject = await projectService.forceDeleteProject(projectId);

    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (session?.user) {
      await auditLogService.log({
        workspaceId: deletedProject.workspaceId,
        organizationId: deletedProject.organizationId,
        userId: session.user.id,
        action: "FORCE_DELETE_PROJECT",
        entityType: "PROJECT",
        entityId: deletedProject.id,
        entityName: deletedProject.title,
        description: `User "${session.user.name}" permanently deleted project "${deletedProject.title}".`,
        req,
      });
    }

    return ok(res, "Project permanently deleted");
  }),

  // PROJECT MEMBERS
  getProjectMembers: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const members = await projectService.getProjectMembers(projectId);

    return ok(res, "Project members fetched", members);
  }),

  addProjectMembers: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    const { project, userId } = await verifyProjectAdmin(req, projectId);
    const { userIds } = req.body as { userIds: string[] };

    const members = await projectService.addProjectMembers(
      projectId,
      project.workspaceId,
      userIds,
      userId,
    );

    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (session?.user) {
      await auditLogService.log({
        workspaceId: project.workspaceId,
        organizationId: project.organizationId,
        userId: session.user.id,
        action: "ADD_PROJECT_MEMBERS",
        entityType: "PROJECT",
        entityId: project.id,
        entityName: project.title,
        description: `User "${session.user.name}" added ${userIds.length} members to project "${project.title}".`,
        metadata: { addedUserIds: userIds },
        req,
      });
    }

    return ok(res, "Members assigned to project", members);
  }),

  removeProjectMember: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    const userId = req.params.userId as string;
    const { project } = await verifyProjectAdmin(req, projectId);

    await projectService.removeProjectMember(projectId, userId);

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const { auth } = await import("@/lib/auth/auth");
    const { betterAuthHeaders } = await import("@/lib/auth/node-headers");
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (session?.user && targetUser) {
      await auditLogService.log({
        workspaceId: project.workspaceId,
        organizationId: project.organizationId,
        userId: session.user.id,
        action: "REMOVE_PROJECT_MEMBER",
        entityType: "PROJECT",
        entityId: project.id,
        entityName: project.title,
        description: `User "${session.user.name}" removed member "${targetUser.name}" from project "${project.title}".`,
        metadata: { removedUserId: userId },
        req,
      });
    }

    return ok(res, "Member removed from project");
  }),

  // VAULT MANAGEMENT
  getProjectVault: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const vault = await projectService.getProjectVault(projectId);

    return ok(res, "Vault fetched successfully", vault);
  }),

  addVaultService: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const { name } = vaultServiceSchema.parse(req.body);

    const service = await projectService.addVaultService(projectId, name);

    return ok(res, "Vault service added successfully", service);
  }),

  deleteVaultService: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const serviceId = req.params.serviceId as string;

    await projectService.deleteVaultService(serviceId);

    return ok(res, "Vault service and its secrets deleted successfully");
  }),

  restoreVaultService: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const serviceId = req.params.serviceId as string;

    await projectService.restoreVaultService(serviceId);

    return ok(res, "Vault service restored successfully");
  }),

  forceDeleteVaultService: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const serviceId = req.params.serviceId as string;

    await projectService.forceDeleteVaultService(serviceId);

    return ok(res, "Vault service permanently deleted");
  }),

  addOrUpdateVaultItem: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const serviceId = req.params.serviceId as string;
    const { key, value, note } = vaultItemSchema.parse(req.body);

    const result = await projectService.addOrUpdateVaultItem(serviceId, {
      key,
      value,
      note,
    });

    return ok(res, "Vault item saved successfully", result);
  }),

  updateVaultItem: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const itemId = req.params.itemId as string;
    const { value, note } = updateVaultItemSchema.parse(req.body);

    const result = await projectService.updateVaultItem(itemId, {
      value,
      note,
    });

    return ok(res, "Vault item updated successfully", result);
  }),

  deleteVaultItem: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const itemId = req.params.itemId as string;

    await projectService.deleteVaultItem(itemId);

    return ok(res, "Vault item deleted successfully");
  }),

  restoreVaultItem: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const itemId = req.params.itemId as string;

    await projectService.restoreVaultItem(itemId);

    return ok(res, "Vault item restored successfully");
  }),

  forceDeleteVaultItem: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const itemId = req.params.itemId as string;

    await projectService.forceDeleteVaultItem(itemId);

    return ok(res, "Vault item permanently deleted");
  }),

  // FILE UPLOAD AND MANAGEMENT
  uploadProjectFile: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    if (!req.file) {
      throw new BadRequestException("No file uploaded");
    }

    const fileDetails = await projectService.uploadProjectFile(
      projectId,
      req.file,
    );

    return ok(res, "File uploaded successfully", fileDetails);
  }),

  getProjectFiles: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const files = await projectService.getProjectFiles(projectId);

    return ok(res, "Project files fetched successfully", files);
  }),

  deleteProjectFile: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    const fileId = req.params.fileId as string;
    await verifyProjectAccess(req, projectId);

    await projectService.deleteProjectFile(projectId, fileId);

    return ok(res, "Project file deleted successfully");
  }),

  getAutomationRules: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const rules = await projectService.getAutomationRules(projectId);

    return ok(res, "Automation rules fetched successfully", rules);
  }),

  createAutomationRule: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);

    const rule = await projectService.createAutomationRule(projectId, req.body);

    return ok(res, "Automation rule created successfully", rule);
  }),

  updateAutomationRule: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);
    const ruleId = req.params.ruleId as string;

    const rule = await projectService.updateAutomationRule(ruleId, req.body);

    return ok(res, "Automation rule updated successfully", rule);
  }),

  deleteAutomationRule: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);
    const ruleId = req.params.ruleId as string;

    await projectService.deleteAutomationRule(ruleId);

    return ok(res, "Automation rule deleted successfully");
  }),

  restoreAutomationRule: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);
    const ruleId = req.params.ruleId as string;

    await projectService.restoreAutomationRule(ruleId);

    return ok(res, "Automation rule restored successfully");
  }),

  forceDeleteAutomationRule: asyncHandler(
    async (req: Request, res: Response) => {
      const projectId = req.params.id as string;
      await verifyProjectAdmin(req, projectId);
      const ruleId = req.params.ruleId as string;

      await projectService.forceDeleteAutomationRule(ruleId);

      return ok(res, "Automation rule permanently deleted");
    },
  ),
};
