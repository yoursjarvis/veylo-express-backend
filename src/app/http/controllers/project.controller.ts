import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { z } from "zod";
import { encrypt, decrypt } from "@/utils/crypto";
import { mediaService } from "@/core/media";
import path from "path";
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";

// Relax prisma type checks for newly added models to bypass local/global schema mismatch
const db = prisma as any;

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

/**
 * Verify if the caller is an Org Admin/Owner, or a Workspace Admin.
 */
async function verifyWorkspaceAdmin(req: Request, workspaceId: string) {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    throw new BadRequestException("No active organization found");
  }

  // Check Org Admin/Owner
  const callerOrgMember = await db.member.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: session.user.id,
      role: { in: ["owner", "admin"] },
    },
  });

  if (callerOrgMember) {
    return { activeOrgId, userId: session.user.id };
  }

  // Check Workspace Admin
  const callerWorkspaceMember = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
      role: "admin",
      workspace: { organizationId: activeOrgId },
    },
  });

  if (!callerWorkspaceMember) {
    throw new ForbiddenException("Forbidden: You must be an organization or workspace admin");
  }

  return { activeOrgId, userId: session.user.id };
}

/**
 * Verify if caller is Workspace Admin / Org Admin for a specific project.
 */
async function verifyProjectAdmin(req: Request, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }

  const verified = await verifyWorkspaceAdmin(req, project.workspaceId);
  return { ...verified, project };
}

/**
 * Verify if the caller has access to the project (Org Admin, Workspace Admin, or Project Member).
 */
async function verifyProjectAccess(req: Request, projectId: string) {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    throw new BadRequestException("No active organization found");
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }

  // Check Org Admin/Owner
  const callerOrgMember = await db.member.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: session.user.id,
      role: { in: ["owner", "admin"] },
    },
  });

  if (callerOrgMember) {
    return { activeOrgId, userId: session.user.id, project };
  }

  // Check Workspace Admin
  const callerWorkspaceMember = await db.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspaceId,
      userId: session.user.id,
      role: "admin",
      workspace: { organizationId: activeOrgId },
    },
  });

  if (callerWorkspaceMember) {
    return { activeOrgId, userId: session.user.id, project };
  }

  // Check Project Member
  const projectMember = await db.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: session.user.id,
      },
    },
  });

  if (!projectMember) {
    throw new ForbiddenException("Forbidden: You must be a project member or workspace/org admin");
  }

  return { activeOrgId, userId: session.user.id, project };
}

const projectCreateSchema = z.object({
  title: z.string().min(2, "Project title must be at least 2 characters long"),
  description: z.string().optional(),
  icon: z.string().optional(),
  template: z.enum(["simple", "kanban", "scrum"]).optional().default("simple"),
});

const DEFAULT_STATUSES = {
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
    await verifyWorkspaceAdmin(req, workspaceId);

    const validatedData = projectCreateSchema.parse(req.body);
    const template = validatedData.template;

    const project = await db.project.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        icon: validatedData.icon,
        template,
        workspaceId,
        vault: {
          create: {},
        },
        taskStatuses: {
          createMany: {
            data: DEFAULT_STATUSES[template],
          },
        },
      },
      include: {
        taskStatuses: true,
      },
    });

    return ok(res, "Project created successfully", project);
  }),

  getProjects: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string;

    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
      return res.status(400).json({ message: "No active organization found" });
    }

    // Check if user can see all projects in the workspace (Admins/Owners)
    let canSeeAll = false;
    try {
      await verifyWorkspaceAdmin(req, workspaceId);
      canSeeAll = true;
    } catch {
      // User is not an admin, we will filter by project membership
    }

    const projects = await db.project.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(canSeeAll
          ? {}
          : {
              members: {
                some: {
                  userId: session.user.id,
                },
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

    const projectDetails = await db.project.findUnique({
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
    await db.project.findUnique({ where: { id: projectId } }); // Just verify project exists
    await verifyProjectAdmin(req, projectId);

    const validatedData = projectCreateSchema.partial().parse(req.body);

    const updatedProject = await db.project.update({
      where: { id: projectId },
      data: validatedData,
    });

    return ok(res, "Project updated successfully", updatedProject);
  }),

  deleteProject: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAdmin(req, projectId);

    // Delete project and all related cascades
    await db.project.delete({
      where: { id: projectId },
    });

    return ok(res, "Project deleted successfully");
  }),

  // PROJECT MEMBERS
  getProjectMembers: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    const members = await db.projectMember.findMany({
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
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "User IDs are required" });
    }

    // Verify all users are members of the Workspace (Requirement 4)
    const workspaceMembers = await db.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        userId: { in: userIds },
      },
    });

    if (workspaceMembers.length !== userIds.length) {
      return res.status(400).json({
        message: "One or more users are not members of this workspace. Assign them to the workspace first.",
      });
    }

    const members = await Promise.all(
      userIds.map((userId) =>
        db.projectMember.upsert({
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

    await db.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });

    return ok(res, "Member removed from project");
  }),

  // VAULT MANAGEMENT
  getProjectVault: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    await verifyProjectAccess(req, projectId);

    let vault = await db.vault.findUnique({
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
      vault = await db.vault.create({
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
    const services = vault.services.map((service: any) => ({
      ...service,
      items: service.items.map((item: any) => {
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

    const vault = await db.vault.findUnique({
      where: { projectId },
    });

    if (!vault) {
      throw new NotFoundException("Vault not found for this project");
    }

    // Check if service name already exists in this vault
    const existing = await db.vaultService.findFirst({
      where: { vaultId: vault.id, name },
    });

    if (existing) {
      throw new BadRequestException("Service already exists");
    }

    const service = await db.vaultService.create({
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

    await db.vaultService.delete({
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

    // Encrypt the sensitive fields securely!
    const encryptedValue = encrypt(value);
    const encryptedNote = note ? encrypt(note) : null;

    const item = await db.vaultItem.upsert({
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

    const updateData: any = {};
    if (value !== undefined) {
      updateData.value = encrypt(value);
    }
    if (note !== undefined) {
      updateData.note = note ? encrypt(note) : null;
    }

    const item = await db.vaultItem.update({
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

    await db.vaultItem.delete({
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

    // Malicious File Filtering
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
      false // Do not replace, keep multiple files
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

    // Verify file belongs to project
    const file = await db.media.findFirst({
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
