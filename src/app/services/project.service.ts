import { projectRepository } from "@/app/repositories/project.repository";
import { mediaService } from "@/core/media";
import { BadRequestException, NotFoundException } from "@/utils/app-error";
import { decrypt, encrypt } from "@/utils/crypto";
import path from "path";
import { notificationService } from "@/app/services/notification.service";
import prisma from "@/lib/prisma";

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

export const projectService = {
  async createProject(
    workspaceId: string,
    activeOrgId: string,
    data: {
      title: string;
      description?: string;
      icon?: string;
      template: string;
      teamMode?: string;
      projectKey: string;
    }
  ) {
    const existingProject = await prisma.project.findUnique({
      where: { projectKey: data.projectKey },
    });
    if (existingProject) {
      throw new BadRequestException("Project Key already exists");
    }

    const templateSlug = data.template;

    // Load template configuration from database
    const dbTemplate = await projectRepository.findTemplateBySlug(templateSlug);

    let resolvedStatuses: { name: string; category: string; order: number }[] = [];
    let resolvedCustomFields: { name: string; type: string }[] = [];
    let resolvedTeamMode = data.teamMode || "general";

    if (dbTemplate) {
      const config = dbTemplate.config as any;
      if (config.statuses) resolvedStatuses = config.statuses;
      if (config.customFields) resolvedCustomFields = config.customFields;
      if (config.teamMode) resolvedTeamMode = data.teamMode || config.teamMode;
    } else {
      // Fallback for custom or legacy templates
      resolvedStatuses = DEFAULT_STATUSES[templateSlug] || DEFAULT_STATUSES["simple"];
    }

    // Retrieve workspace to get its organizationId
    const workspace = await projectRepository.findWorkspaceById(workspaceId);
    const organizationId = workspace?.organizationId ?? activeOrgId;

    return projectRepository.createProject(
      {
        title: data.title,
        projectKey: data.projectKey,
        description: data.description,
        icon: data.icon,
        template: templateSlug,
        teamMode: resolvedTeamMode,
        workspaceId,
        organizationId,
      },
      resolvedStatuses,
      resolvedCustomFields
    );
  },

  getProjectTemplates() {
    return projectRepository.getTemplates();
  },

  async getProjectTemplateBySlug(slug: string) {
    const template = await projectRepository.findTemplateBySlug(slug);
    if (!template) {
      throw new NotFoundException("Project template not found");
    }
    return template;
  },

  getProjects(workspaceId: string, canSeeAll: boolean, userId: string) {
    return projectRepository.getProjects(workspaceId, canSeeAll, userId);
  },

  async getProject(projectId: string) {
    const projectDetails = await projectRepository.getProjectDetails(projectId);
    if (!projectDetails) {
      throw new NotFoundException("Project not found");
    }
    return projectDetails;
  },

  updateProject(projectId: string, data: any) {
    return projectRepository.updateProject(projectId, data);
  },

  deleteProject(projectId: string) {
    return projectRepository.deleteProject(projectId);
  },

  // PROJECT MEMBERS
  getProjectMembers(projectId: string) {
    return projectRepository.getProjectMembers(projectId);
  },

  async addProjectMembers(projectId: string, projectWorkspaceId: string, userIds: string[], adderId: string) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestException("User IDs are required");
    }

    // Verify all users are members of the Workspace
    const workspaceMembers = await projectRepository.findWorkspaceMembers(projectWorkspaceId, userIds);
    if (workspaceMembers.length !== userIds.length) {
      throw new BadRequestException(
        "One or more users are not members of this workspace. Assign them to the workspace first."
      );
    }

    const members = await Promise.all(
      userIds.map((userId) => projectRepository.upsertProjectMember(projectId, userId, "member"))
    );

    // Trigger notification (fire-and-forget)
    notificationService.handleAddedToProject(projectId, adderId, userIds);

    return members;
  },

  removeProjectMember(projectId: string, userId: string) {
    return projectRepository.deleteProjectMember(projectId, userId);
  },

  // VAULT MANAGEMENT
  async getProjectVault(projectId: string) {
    let vault = await projectRepository.findVault(projectId);

    if (!vault) {
      vault = await projectRepository.createVault(projectId);
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

    return { ...vault, services };
  },

  async addVaultService(projectId: string, name: string) {
    const vault = await projectRepository.findVault(projectId);
    if (!vault) {
      throw new NotFoundException("Vault not found for this project");
    }

    const existing = await projectRepository.findVaultService(vault.id, name);
    if (existing) {
      throw new BadRequestException("Service already exists");
    }

    return projectRepository.createVaultService(vault.id, name);
  },

  deleteVaultService(serviceId: string) {
    return projectRepository.deleteVaultService(serviceId);
  },

  async addOrUpdateVaultItem(serviceId: string, data: { key: string; value: string; note?: string | null }) {
    const encryptedValue = encrypt(data.value);
    const encryptedNote = data.note ? encrypt(data.note) : null;

    const item = await projectRepository.upsertVaultItem(
      serviceId,
      data.key,
      encryptedValue,
      encryptedNote
    );

    return {
      id: item.id,
      key: item.key,
      value: data.value,
      note: data.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  },

  async updateVaultItem(itemId: string, data: { value?: string; note?: string | null }) {
    const updateData: Record<string, string | null> = {};
    if (data.value !== undefined) {
      updateData.value = encrypt(data.value);
    }
    if (data.note !== undefined) {
      updateData.note = data.note ? encrypt(data.note) : null;
    }

    const item = await projectRepository.updateVaultItem(itemId, updateData);

    return {
      id: item.id,
      key: item.key,
      value: data.value ?? null,
      note: data.note ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  },

  deleteVaultItem(itemId: string) {
    return projectRepository.deleteVaultItem(itemId);
  },

  // FILE UPLOAD AND MANAGEMENT
  async uploadProjectFile(projectId: string, file: Express.Multer.File) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (DISALLOWED_EXTENSIONS.includes(ext) || DISALLOWED_MIMETYPES.includes(mime)) {
      throw new BadRequestException("File type not allowed or is potentially malicious");
    }

    const media = await mediaService.addMedia(
      "Project",
      projectId,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      "project_files",
      false
    );

    const url = await mediaService.getUrl(media.id);

    return {
      id: media.id,
      name: media.name,
      fileName: media.fileName,
      mimeType: media.mimeType,
      size: media.size,
      createdAt: media.createdAt,
      url,
    };
  },

  async getProjectFiles(projectId: string) {
    const mediaFiles = await mediaService.getMedia("Project", projectId, "project_files");
    return Promise.all(
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
  },

  async deleteProjectFile(projectId: string, fileId: string) {
    const file = await projectRepository.findProjectFile(projectId, fileId);
    if (!file) {
      throw new NotFoundException("File not found in this project");
    }

    await mediaService.deleteMedia(fileId);
  },

  getAutomationRules(projectId: string) {
    return projectRepository.findAutomationRules(projectId);
  },

  createAutomationRule(projectId: string, data: any) {
    if (!data.name || !data.trigger || !data.action) {
      throw new BadRequestException("Name, trigger, and action are required");
    }
    return projectRepository.createAutomationRule(projectId, data);
  },

  async updateAutomationRule(ruleId: string, data: any) {
    const existing = await projectRepository.findAutomationRuleById(ruleId);
    if (!existing) {
      throw new NotFoundException("Automation rule not found");
    }
    return projectRepository.updateAutomationRule(ruleId, data);
  },

  async deleteAutomationRule(ruleId: string) {
    const existing = await projectRepository.findAutomationRuleById(ruleId);
    if (!existing) {
      throw new NotFoundException("Automation rule not found");
    }
    return projectRepository.deleteAutomationRule(ruleId);
  },
};
