import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import {
  verifyProjectAccess,
  verifyProjectAdmin,
  verifyWorkspaceAdmin,
  resolveSession,
} from "@/app/http/middlewares/project-access.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { z } from "zod";
import { encrypt, decrypt } from "@/utils/crypto";
import { mediaService } from "@/core/media";
import path from "path";
import {
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";

// Malicious files filtering constants
const DISALLOWED_EXTENSIONS = [
  ".exe", ".dll", ".so", ".elf", ".dmg", ".pkg", ".app", ".deb", ".rpm", ".msi", ".msp",
  ".sh", ".bash", ".bat", ".cmd", ".vbs", ".vbe", ".js", ".ts", ".html", ".htm", ".php",
  ".py", ".pl", ".rb", ".ps1", ".jar", ".lnk", ".sys", ".com", ".scr"
];

const DISALLOWED_MIMETYPES = [
  "application/x-msdownload",
  "application/x-sh",
  "application/x-bash",
  "application/javascript",
  "text/javascript",
  "text/html",
  "application/x-php",
  "application/x-python",
  "application/x-perl",
  "application/x-ruby",
  "application/x-executable",
  "application/x-sharedlib"
];

const projectCreateSchema = z.object({
  title: z.string().min(2, "Project title must be at least 2 characters long"),
  description: z.string().optional(),
  icon: z.string().optional(),
  template: z.string().optional().default("general-project"),
  teamMode: z.string().optional(),
});

const projectUpdateSchema = z.object({
  title: z.string().min(2, "Project title must be at least 2 characters long").optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  template: z.string().optional(),
  teamMode: z.string().optional(),
});

const DEFAULT_STATUSES: Record<string, { name: string; category: string; order: number }[]> = {
  simple: [
    { name: "To Do", category: "todo", order: 0 },
    { name: "Done", category: "done", order: 1 },
  ],
  kanban: [
    { name: "To Do", category: "todo", order: 0 },
    { name: "In Progress", category: "in_progress", order: 1 },
    { name: "In Review", category: "in_progress", order: 2 },
    { name: "Done", category: "done", order: 3 },
  ],
  scrum: [
    { name: "Backlog", category: "backlog", order: 0 },
    { name: "To Do", category: "todo", order: 1 },
    { name: "In Progress", category: "in_progress", order: 2 },
    { name: "QA", category: "in_progress", order: 3 },
    { name: "Done", category: "done", order: 4 },
  ],
};

export const projectController = {
  createProject: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const { activeOrgId } = await verifyWorkspaceAdmin(req, workspaceId);

    const validatedData = projectCreateSchema.parse(req.body);
    const templateSlug = validatedData.template;

    // Load template configuration from database
    const dbTemplate = await prisma.projectTemplate.findUnique({
      where: { slug: templateSlug },
    });

    let resolvedStatuses: { name: string; category: string; order: number }[] = [];
    let resolvedCustomFields: { name: string; type: string }[] = [];
    let resolvedTeamMode = validatedData.teamMode || "general";

    if (dbTemplate) {
      const config = dbTemplate.config as any;
      if (config.statuses) resolvedStatuses = config.statuses;
      if (config.customFields) resolvedCustomFields = config.customFields;
      if (config.teamMode) resolvedTeamMode = validatedData.teamMode || config.teamMode;
    } else {
      // Fallback for custom or legacy templates
      resolvedStatuses = DEFAULT_STATUSES[templateSlug] || DEFAULT_STATUSES["simple"];
    }

    // Retrieve workspace to get its organizationId
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });

    const organizationId = workspace?.organizationId ?? activeOrgId;

    const project = await prisma.project.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        icon: validatedData.icon,
        template: templateSlug,
        teamMode: resolvedTeamMode,
        workspaceId,
        organizationId,
        vault: {
          create: {},
        },
        taskStatuses: {
          createMany: {
            data: resolvedStatuses.map((s) => ({ ...s, organizationId })),
          },
        },
        customFields: resolvedCustomFields.length > 0 ? {
          createMany: {
            data: resolvedCustomFields.map((cf) => ({
              name: cf.name,
              type: cf.type,
              organizationId,
            })),
          },
        } : undefined,
      },
      include: {
        taskStatuses: true,
        customFields: true,
      },
    });

    return ok(res, "Project created successfully", project);
  }),

  getProjectTemplates: asyncHandler(async (req: Request, res: Response) => {
    const templates = await prisma.projectTemplate.findMany({
      orderBy: { name: "asc" },
    });
    return ok(res, "Project templates fetched successfully", templates);
  }),

  getProjectTemplateBySlug: asyncHandler(async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const template = await prisma.projectTemplate.findUnique({
      where: { slug },
    });
    if (!template) {
      throw new NotFoundException("Project template not found");
    }
    return ok(res, "Project template fetched successfully", template);
  }),

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

    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(canSeeAll
          ? {}
          : {
              members: {
                some: { userId },
              },
            }),
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(res, "Projects fetched successfully", projects);
  }),

  getProject: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const projectDetails = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return ok(res, "Project fetched successfully", projectDetails);
  }),

  updateProject: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);

    const validatedData = projectUpdateSchema.parse(req.body);

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: validatedData,
    });

    return ok(res, "Project updated successfully", updatedProject);
  }),

  deleteProject: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);

    await prisma.project.delete({
      where: { id: projectId },
    });

    return ok(res, "Project deleted successfully");
  }),

  // PROJECT MEMBERS
  getProjectMembers: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return ok(res, "Project members fetched", members);
  }),

  addProjectMembers: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    const { project } = await verifyProjectAdmin(req, projectId);
    const { userIds } = req.body as { userIds: string[] };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestException("User IDs are required");
    }

    // Verify all users are members of the Workspace
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        userId: { in: userIds },
      },
    });

    if (workspaceMembers.length !== userIds.length) {
      throw new BadRequestException(
        "One or more users are not members of this workspace. Assign them to the workspace first."
      );
    }

    const members = await Promise.all(
      userIds.map((userId) =>
        prisma.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          update: {},
          create: { projectId, userId, role: "member" },
        })
      )
    );

    return ok(res, "Members assigned to project", members);
  }),

  removeProjectMember: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    const userId = req.params.userId as string;
    await verifyProjectAdmin(req, projectId);

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });

    return ok(res, "Member removed from project");
  }),

  // VAULT MANAGEMENT
  getProjectVault: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    let vault = await prisma.vault.findUnique({
      where: { projectId },
      include: {
        services: {
          include: {
            items: {
              orderBy: { key: "asc" },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!vault) {
      vault = await prisma.vault.create({
        data: { projectId },
        include: {
          services: {
            include: {
              items: {
                orderBy: { key: "asc" },
              },
            },
            orderBy: { name: "asc" },
          },
        },
      });
    }

    // Decrypt confidential values and notes securely
    const services = vault.services.map((service) => ({
      ...service,
      items: service.items.map((item) => {
        let decryptedValue = "";
        let decryptedNote: string | null = null;
        try {
          decryptedValue = decrypt(item.value);
        } catch {
          decryptedValue = "[Decryption Failed]";
        }
        if (item.note) {
          try {
            decryptedNote = decrypt(item.note);
          } catch {
            decryptedNote = "[Decryption Failed]";
          }
        }
        return {
          ...item,
          value: decryptedValue,
          note: decryptedNote,
        };
      }),
    }));

    return ok(res, "Vault fetched successfully", { ...vault, services });
  }),

  addVaultService: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);

    const vault = await prisma.vault.findUnique({
      where: { projectId },
    });

    if (!vault) {
      throw new NotFoundException("Vault not found for this project");
    }

    const existing = await prisma.vaultService.findFirst({
      where: { vaultId: vault.id, name },
    });

    if (existing) {
      throw new BadRequestException("Service already exists");
    }

    const service = await prisma.vaultService.create({
      data: {
        vaultId: vault.id,
        name,
      },
    });

    return ok(res, "Vault service added successfully", service);
  }),

  deleteVaultService: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const serviceId = req.params.serviceId as string;

    await prisma.vaultService.delete({
      where: { id: serviceId },
    });

    return ok(res, "Vault service and its secrets deleted successfully");
  }),

  addOrUpdateVaultItem: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const serviceId = req.params.serviceId as string;
    const { key, value, note } = z
      .object({
        key: z.string().min(1, "Key name is required"),
        value: z.string().min(1, "Value is required"),
        note: z.string().optional().nullable(),
      })
      .parse(req.body);

    const encryptedValue = encrypt(value);
    const encryptedNote = note ? encrypt(note) : null;

    const item = await prisma.vaultItem.upsert({
      where: {
        serviceId_key: { serviceId, key },
      },
      update: {
        value: encryptedValue,
        note: encryptedNote,
      },
      create: {
        serviceId,
        key,
        value: encryptedValue,
        note: encryptedNote,
      },
    });

    return ok(res, "Vault item saved successfully", {
      id: item.id,
      key: item.key,
      value, // Return plaintext to client immediately after success
      note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }),

  updateVaultItem: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const itemId = req.params.itemId as string;
    const { value, note } = z
      .object({
        value: z.string().optional(),
        note: z.string().optional().nullable(),
      })
      .parse(req.body);

    const updateData: Record<string, string | null> = {};
    if (value !== undefined) {
      updateData.value = encrypt(value);
    }
    if (note !== undefined) {
      updateData.note = note ? encrypt(note) : null;
    }

    const item = await prisma.vaultItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return ok(res, "Vault item updated successfully", {
      id: item.id,
      key: item.key,
      value: value ?? null,
      note: note ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }),

  deleteVaultItem: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const itemId = req.params.itemId as string;

    await prisma.vaultItem.delete({
      where: { id: itemId },
    });

    return ok(res, "Vault item deleted successfully");
  }),

  // FILE UPLOAD AND MANAGEMENT
  uploadProjectFile: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    if (!req.file) {
      throw new BadRequestException("No file uploaded");
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const mime = req.file.mimetype.toLowerCase();

    if (DISALLOWED_EXTENSIONS.includes(ext) || DISALLOWED_MIMETYPES.includes(mime)) {
      throw new BadRequestException("File type not allowed or is potentially malicious");
    }

    const media = await mediaService.addMedia(
      "Project",
      projectId,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      "project_files",
      false
    );

    const url = await mediaService.getUrl(media.id);

    return ok(res, "File uploaded successfully", {
      id: media.id,
      name: media.name,
      fileName: media.fileName,
      mimeType: media.mimeType,
      size: media.size,
      createdAt: media.createdAt,
      url,
    });
  }),

  getProjectFiles: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const mediaFiles = await mediaService.getMedia("Project", projectId, "project_files");
    const filesWithUrls = await Promise.all(
      mediaFiles.map(async (file) => {
        const url = await mediaService.getUrl(file.id);
        return {
          id: file.id,
          name: file.name,
          fileName: file.fileName,
          mimeType: file.mimeType,
          size: file.size,
          createdAt: file.createdAt,
          url,
        };
      })
    );

    return ok(res, "Project files fetched successfully", filesWithUrls);
  }),

  deleteProjectFile: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    const fileId = req.params.fileId as string;
    await verifyProjectAccess(req, projectId);

    const file = await prisma.media.findFirst({
      where: {
        id: fileId,
        modelType: "Project",
        modelId: projectId,
      },
    });

    if (!file) {
      throw new NotFoundException("File not found in this project");
    }

    await mediaService.deleteMedia(fileId);

    return ok(res, "Project file deleted successfully");
  }),
};
