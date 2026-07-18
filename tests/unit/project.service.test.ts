import { describe, expect, it, vi, beforeEach } from "vitest";
import { projectService } from "../../src/app/services/project.service";
import { prismaMock } from "../../tests/helpers/db";

const { projectRepositoryMock } = vi.hoisted(() => ({
  projectRepositoryMock: {
    findTemplateBySlug: vi.fn(),
    findWorkspaceById: vi.fn(),
    createProject: vi.fn(),
    getTemplates: vi.fn(),
    getProjects: vi.fn(),
    getOrgProjects: vi.fn(),
    getProjectDetails: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    findProjectByIdWithTrashed: vi.fn(),
    restoreProject: vi.fn(),
    forceDeleteProject: vi.fn(),
    getProjectMembers: vi.fn(),
    findWorkspaceMembers: vi.fn(),
    upsertProjectMember: vi.fn(),
    deleteProjectMember: vi.fn(),
    findVault: vi.fn(),
    createVault: vi.fn(),
    findVaultService: vi.fn(),
    createVaultService: vi.fn(),
    deleteVaultService: vi.fn(),
    findVaultServiceByIdWithTrashed: vi.fn(),
    restoreVaultService: vi.fn(),
    forceDeleteVaultService: vi.fn(),
    upsertVaultItem: vi.fn(),
    updateVaultItem: vi.fn(),
    deleteVaultItem: vi.fn(),
    findVaultItemByIdWithTrashed: vi.fn(),
    restoreVaultItem: vi.fn(),
    forceDeleteVaultItem: vi.fn(),
    findProjectFile: vi.fn(),
    findAutomationRules: vi.fn(),
    createAutomationRule: vi.fn(),
    findAutomationRuleById: vi.fn(),
    updateAutomationRule: vi.fn(),
    deleteAutomationRule: vi.fn(),
    findAutomationRuleByIdWithTrashed: vi.fn(),
    restoreAutomationRule: vi.fn(),
    forceDeleteAutomationRule: vi.fn(),
  },
}));

const { notificationServiceMock } = vi.hoisted(() => ({
  notificationServiceMock: {
    handleAddedToProject: vi.fn(),
  },
}));

const { mediaServiceMock } = vi.hoisted(() => ({
  mediaServiceMock: {
    addMedia: vi.fn(),
    generateUrl: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
  },
}));

const { rbacServiceMock } = vi.hoisted(() => ({
  rbacServiceMock: {
    authorize: vi.fn(),
  },
}));

const { cryptoMock } = vi.hoisted(() => ({
  cryptoMock: {
    encrypt: vi.fn((val: string) => `encrypted:${val}`),
    decrypt: vi.fn((val: string) => val.replace("encrypted:", "")),
  },
}));

vi.mock("@/app/repositories/project.repository", () => ({
  projectRepository: projectRepositoryMock,
}));

vi.mock("@/app/services/notification.service", () => ({
  notificationService: notificationServiceMock,
}));

vi.mock("@/core/media", () => ({
  mediaService: mediaServiceMock,
}));

vi.mock("@/app/services/rbac.service", () => ({
  rbacService: rbacServiceMock,
}));

vi.mock("@/utils/crypto", () => ({
  encrypt: (val: string) => `encrypted:${val}`,
  decrypt: (val: string) => val.replace("encrypted:", ""),
}));

describe("ProjectService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- CREATE PROJECT ---
  describe("createProject", () => {
    it("throws BadRequestException if project key already exists", async () => {
      prismaMock.project.findUnique.mockResolvedValueOnce({ id: "p-existing" } as any);

      await expect(
        projectService.createProject("ws-1", "org-1", {
          title: "My Project", template: "scrum", projectKey: "PROJ",
        })
      ).rejects.toThrow("Project Key already exists");
    });

    it("creates project with DB template (config statuses)", async () => {
      prismaMock.project.findUnique.mockResolvedValueOnce(null);
      projectRepositoryMock.findTemplateBySlug.mockResolvedValueOnce({
        id: "tmpl-1",
        config: {
          statuses: [{ name: "Todo", category: "todo", order: 0 }],
          customFields: [{ name: "Priority", type: "text" }],
          teamMode: "scrum",
        },
      });
      projectRepositoryMock.findWorkspaceById.mockResolvedValueOnce({ organizationId: "org-1" });
      projectRepositoryMock.createProject.mockResolvedValueOnce({ id: "proj-1", organizationId: "org-1", ownerId: "user-1" });
      prismaMock.projectDoc.create.mockResolvedValueOnce({ id: "doc-1" } as any);

      const result = await projectService.createProject("ws-1", "org-1", {
        title: "My Project", template: "scrum", projectKey: "PROJ",
      }, "user-1");

      expect(projectRepositoryMock.createProject).toHaveBeenCalled();
      expect(result).toEqual({ id: "proj-1", organizationId: "org-1", ownerId: "user-1" });
    });

    it("creates project with fallback DEFAULT_STATUSES when no DB template", async () => {
      prismaMock.project.findUnique.mockResolvedValueOnce(null);
      projectRepositoryMock.findTemplateBySlug.mockResolvedValueOnce(null); // no DB template
      projectRepositoryMock.findWorkspaceById.mockResolvedValueOnce({ organizationId: "org-1" });
      projectRepositoryMock.createProject.mockResolvedValueOnce({ id: "proj-2", organizationId: "org-1", ownerId: null });
      prismaMock.user.findFirst.mockResolvedValueOnce({ id: "user-1" } as any);
      prismaMock.projectDoc.create.mockResolvedValueOnce({ id: "doc-1" } as any);

      const result = await projectService.createProject("ws-1", "org-1", {
        title: "Kanban Project", template: "kanban", projectKey: "KAN",
      });

      expect(result.id).toBe("proj-2");
      expect(prismaMock.user.findFirst).toHaveBeenCalled(); // fallback user lookup
    });

    it("skips doc creation when no creatorId available", async () => {
      prismaMock.project.findUnique.mockResolvedValueOnce(null);
      projectRepositoryMock.findTemplateBySlug.mockResolvedValueOnce(null);
      projectRepositoryMock.findWorkspaceById.mockResolvedValueOnce({ organizationId: "org-1" });
      projectRepositoryMock.createProject.mockResolvedValueOnce({ id: "proj-3", organizationId: "org-1", ownerId: null });
      prismaMock.user.findFirst.mockResolvedValueOnce(null); // no user found

      const result = await projectService.createProject("ws-1", "org-1", {
        title: "No Doc Project", template: "simple", projectKey: "SIM",
      });

      expect(result.id).toBe("proj-3");
      expect(prismaMock.projectDoc.create).not.toHaveBeenCalled();
    });
  });

  // --- GET OPERATIONS ---
  describe("getProjectTemplates", () => {
    it("returns templates", async () => {
      projectRepositoryMock.getTemplates.mockResolvedValueOnce([{ id: "t-1" }]);
      const result = await projectService.getProjectTemplates();
      expect(result).toHaveLength(1);
    });
  });

  describe("getProjectTemplateBySlug", () => {
    it("throws NotFoundException if template not found", async () => {
      projectRepositoryMock.findTemplateBySlug.mockResolvedValueOnce(null);
      await expect(projectService.getProjectTemplateBySlug("missing")).rejects.toThrow("Project template not found");
    });

    it("returns template", async () => {
      projectRepositoryMock.findTemplateBySlug.mockResolvedValueOnce({ id: "t-1", slug: "scrum" });
      const result = await projectService.getProjectTemplateBySlug("scrum");
      expect(result).toEqual({ id: "t-1", slug: "scrum" });
    });
  });

  describe("getProject", () => {
    it("throws NotFoundException if project not found", async () => {
      projectRepositoryMock.getProjectDetails.mockResolvedValueOnce(null);
      await expect(projectService.getProject("proj-missing")).rejects.toThrow("Project not found");
    });

    it("returns project details", async () => {
      projectRepositoryMock.getProjectDetails.mockResolvedValueOnce({ id: "proj-1" });
      const result = await projectService.getProject("proj-1");
      expect(result).toEqual({ id: "proj-1" });
    });
  });

  describe("getProjects / getOrgProjects", () => {
    it("getProjects delegates to repository", async () => {
      projectRepositoryMock.getProjects.mockResolvedValueOnce([{ id: "proj-1" }]);
      const result = await projectService.getProjects("ws-1", true, "user-1");
      expect(result).toHaveLength(1);
    });

    it("getOrgProjects checks RBAC then delegates", async () => {
      rbacServiceMock.authorize.mockResolvedValueOnce(true);
      projectRepositoryMock.getOrgProjects.mockResolvedValueOnce([{ id: "proj-1" }]);
      const result = await projectService.getOrgProjects("org-1", "user-1");
      expect(result).toHaveLength(1);
      expect(rbacServiceMock.authorize).toHaveBeenCalledWith("user-1", "project:read", expect.any(Object));
    });
  });

  // --- UPDATE / DELETE ---
  describe("updateProject / deleteProject", () => {
    it("updates project", async () => {
      projectRepositoryMock.updateProject.mockResolvedValueOnce({ id: "proj-1", title: "Updated" });
      const result = await projectService.updateProject("proj-1", { title: "Updated" });
      expect(result).toEqual({ id: "proj-1", title: "Updated" });
    });

    it("deletes project", async () => {
      projectRepositoryMock.deleteProject.mockResolvedValueOnce({ id: "proj-1" });
      const result = await projectService.deleteProject("proj-1");
      expect(result).toEqual({ id: "proj-1" });
    });
  });

  describe("restoreProject / forceDeleteProject", () => {
    it("throws NotFoundException for restore if project not found", async () => {
      projectRepositoryMock.findProjectByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(projectService.restoreProject("proj-missing")).rejects.toThrow("Project not found");
    });

    it("restores a project", async () => {
      projectRepositoryMock.findProjectByIdWithTrashed.mockResolvedValueOnce({ id: "proj-1" });
      projectRepositoryMock.restoreProject.mockResolvedValueOnce({ id: "proj-1" });
      const result = await projectService.restoreProject("proj-1");
      expect(result).toEqual({ id: "proj-1" });
    });

    it("throws NotFoundException for force delete if project not found", async () => {
      projectRepositoryMock.findProjectByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(projectService.forceDeleteProject("proj-missing")).rejects.toThrow("Project not found");
    });

    it("force deletes a project", async () => {
      projectRepositoryMock.findProjectByIdWithTrashed.mockResolvedValueOnce({ id: "proj-1" });
      projectRepositoryMock.forceDeleteProject.mockResolvedValueOnce({ id: "proj-1" });
      const result = await projectService.forceDeleteProject("proj-1");
      expect(result).toEqual({ id: "proj-1" });
    });
  });

  // --- MEMBERS ---
  describe("addProjectMembers", () => {
    it("throws BadRequestException if userIds is empty", async () => {
      await expect(
        projectService.addProjectMembers("proj-1", "ws-1", [], "adder-1")
      ).rejects.toThrow("User IDs are required");
    });

    it("throws BadRequestException if some users not in workspace", async () => {
      projectRepositoryMock.findWorkspaceMembers.mockResolvedValueOnce([{ userId: "user-1" }]); // 1 found, 2 requested
      await expect(
        projectService.addProjectMembers("proj-1", "ws-1", ["user-1", "user-2"], "adder-1")
      ).rejects.toThrow("One or more users are not members of this workspace");
    });

    it("adds members and triggers notification", async () => {
      projectRepositoryMock.findWorkspaceMembers.mockResolvedValueOnce([
        { userId: "user-1" }, { userId: "user-2" },
      ]);
      projectRepositoryMock.upsertProjectMember.mockResolvedValue({ id: "pm-1" });
      notificationServiceMock.handleAddedToProject.mockResolvedValueOnce(undefined);

      const result = await projectService.addProjectMembers("proj-1", "ws-1", ["user-1", "user-2"], "adder-1");
      expect(result).toHaveLength(2);
      expect(notificationServiceMock.handleAddedToProject).toHaveBeenCalledWith("proj-1", "adder-1", ["user-1", "user-2"]);
    });
  });

  describe("getProjectMembers / removeProjectMember", () => {
    it("gets project members", async () => {
      projectRepositoryMock.getProjectMembers.mockResolvedValueOnce([{ id: "pm-1" }]);
      const result = await projectService.getProjectMembers("proj-1");
      expect(result).toHaveLength(1);
    });

    it("removes a project member", async () => {
      projectRepositoryMock.deleteProjectMember.mockResolvedValueOnce({ id: "pm-1" });
      const result = await projectService.removeProjectMember("proj-1", "user-1");
      expect(result).toEqual({ id: "pm-1" });
    });
  });

  // --- VAULT ---
  describe("getProjectVault", () => {
    it("creates vault if not existing", async () => {
      projectRepositoryMock.findVault.mockResolvedValueOnce(null);
      projectRepositoryMock.createVault.mockResolvedValueOnce({ id: "vault-1", services: [] });

      const result = await projectService.getProjectVault("proj-1");
      expect(projectRepositoryMock.createVault).toHaveBeenCalledWith("proj-1");
      expect(result.services).toEqual([]);
    });

    it("returns vault with decrypted items", async () => {
      projectRepositoryMock.findVault.mockResolvedValueOnce({
        id: "vault-1",
        services: [{
          id: "svc-1",
          items: [
            { id: "item-1", value: "encrypted:secret", note: "encrypted:mynote" },
            { id: "item-2", value: "encrypted:val2", note: null },
          ],
        }],
      });

      const result = await projectService.getProjectVault("proj-1");
      expect(result.services[0].items[0].value).toBe("secret");
      expect(result.services[0].items[0].note).toBe("mynote");
      expect(result.services[0].items[1].note).toBeNull();
    });
  });

  describe("addVaultService", () => {
    it("throws NotFoundException if vault not found", async () => {
      projectRepositoryMock.findVault.mockResolvedValueOnce(null);
      await expect(projectService.addVaultService("proj-1", "Stripe")).rejects.toThrow("Vault not found for this project");
    });

    it("throws BadRequestException if service already exists", async () => {
      projectRepositoryMock.findVault.mockResolvedValueOnce({ id: "vault-1" });
      projectRepositoryMock.findVaultService.mockResolvedValueOnce({ id: "svc-existing" });
      await expect(projectService.addVaultService("proj-1", "Stripe")).rejects.toThrow("Service already exists");
    });

    it("creates vault service successfully", async () => {
      projectRepositoryMock.findVault.mockResolvedValueOnce({ id: "vault-1" });
      projectRepositoryMock.findVaultService.mockResolvedValueOnce(null);
      projectRepositoryMock.createVaultService.mockResolvedValueOnce({ id: "svc-1" });
      const result = await projectService.addVaultService("proj-1", "Stripe");
      expect(result).toEqual({ id: "svc-1" });
    });
  });

  describe("restoreVaultService / forceDeleteVaultService", () => {
    it("throws NotFoundException for restore if service not found", async () => {
      projectRepositoryMock.findVaultServiceByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(projectService.restoreVaultService("svc-missing")).rejects.toThrow("Vault service not found");
    });

    it("restores vault service", async () => {
      projectRepositoryMock.findVaultServiceByIdWithTrashed.mockResolvedValueOnce({ id: "svc-1" });
      projectRepositoryMock.restoreVaultService.mockResolvedValueOnce({ id: "svc-1" });
      const result = await projectService.restoreVaultService("svc-1");
      expect(result).toEqual({ id: "svc-1" });
    });

    it("throws NotFoundException for force delete if service not found", async () => {
      projectRepositoryMock.findVaultServiceByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(projectService.forceDeleteVaultService("svc-missing")).rejects.toThrow("Vault service not found");
    });

    it("force deletes vault service", async () => {
      projectRepositoryMock.findVaultServiceByIdWithTrashed.mockResolvedValueOnce({ id: "svc-1" });
      projectRepositoryMock.forceDeleteVaultService.mockResolvedValueOnce({ id: "svc-1" });
      const result = await projectService.forceDeleteVaultService("svc-1");
      expect(result).toEqual({ id: "svc-1" });
    });
  });

  describe("addOrUpdateVaultItem / updateVaultItem", () => {
    it("adds vault item and returns decrypted values", async () => {
      projectRepositoryMock.upsertVaultItem.mockResolvedValueOnce({
        id: "item-1", key: "API_KEY", createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await projectService.addOrUpdateVaultItem("svc-1", {
        key: "API_KEY", value: "my-secret", note: "Dev key",
      });

      expect(result.value).toBe("my-secret");
      expect(result.note).toBe("Dev key");
    });

    it("updates vault item values", async () => {
      projectRepositoryMock.updateVaultItem.mockResolvedValueOnce({
        id: "item-1", key: "API_KEY", createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await projectService.updateVaultItem("item-1", { value: "new-secret", note: null });
      expect(result.value).toBe("new-secret");
      expect(result.note).toBeNull();
    });

    it("updates vault item with note", async () => {
      projectRepositoryMock.updateVaultItem.mockResolvedValueOnce({
        id: "item-1", key: "KEY", createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await projectService.updateVaultItem("item-1", { value: "val", note: "my note" });
      expect(result.note).toBe("my note");
    });
  });

  describe("restoreVaultItem / forceDeleteVaultItem", () => {
    it("throws NotFoundException for restore if item not found", async () => {
      projectRepositoryMock.findVaultItemByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(projectService.restoreVaultItem("item-missing")).rejects.toThrow("Vault item not found");
    });

    it("restores vault item", async () => {
      projectRepositoryMock.findVaultItemByIdWithTrashed.mockResolvedValueOnce({ id: "item-1" });
      projectRepositoryMock.restoreVaultItem.mockResolvedValueOnce({ id: "item-1" });
      const result = await projectService.restoreVaultItem("item-1");
      expect(result).toEqual({ id: "item-1" });
    });

    it("throws NotFoundException for force delete if item not found", async () => {
      projectRepositoryMock.findVaultItemByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(projectService.forceDeleteVaultItem("item-missing")).rejects.toThrow("Vault item not found");
    });

    it("force deletes vault item", async () => {
      projectRepositoryMock.findVaultItemByIdWithTrashed.mockResolvedValueOnce({ id: "item-1" });
      projectRepositoryMock.forceDeleteVaultItem.mockResolvedValueOnce({ id: "item-1" });
      const result = await projectService.forceDeleteVaultItem("item-1");
      expect(result).toEqual({ id: "item-1" });
    });
  });

  // --- FILE UPLOAD ---
  describe("uploadProjectFile", () => {
    it("throws BadRequestException for disallowed file extension", async () => {
      const file = { originalname: "malware.exe", mimetype: "application/octet-stream", buffer: Buffer.from(""), size: 100 } as Express.Multer.File;
      await expect(projectService.uploadProjectFile("proj-1", file)).rejects.toThrow("File type not allowed");
    });

    it("throws BadRequestException for disallowed mimetype", async () => {
      const file = { originalname: "script.txt", mimetype: "application/javascript", buffer: Buffer.from(""), size: 100 } as Express.Multer.File;
      await expect(projectService.uploadProjectFile("proj-1", file)).rejects.toThrow("File type not allowed");
    });

    it("uploads allowed file and returns media info", async () => {
      mediaServiceMock.addMedia.mockResolvedValueOnce({
        id: "media-1", name: "doc.pdf", fileName: "doc.pdf",
        mimeType: "application/pdf", size: 1024, createdAt: new Date(),
      });
      mediaServiceMock.generateUrl.mockReturnValueOnce("https://cdn.example.com/doc.pdf");

      const file = { originalname: "doc.pdf", mimetype: "application/pdf", buffer: Buffer.from("pdf"), size: 1024 } as Express.Multer.File;
      const result = await projectService.uploadProjectFile("proj-1", file);

      expect(result.url).toBe("https://cdn.example.com/doc.pdf");
    });
  });

  describe("getProjectFiles", () => {
    it("returns project files with URLs", async () => {
      mediaServiceMock.getMedia.mockResolvedValueOnce([
        { id: "f-1", name: "file.pdf", fileName: "file.pdf", mimeType: "application/pdf", size: 100, createdAt: new Date() },
      ]);
      mediaServiceMock.generateUrl.mockReturnValue("https://cdn.example.com/file.pdf");

      const result = await projectService.getProjectFiles("proj-1");
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://cdn.example.com/file.pdf");
    });
  });

  describe("deleteProjectFile", () => {
    it("throws NotFoundException if file not found", async () => {
      projectRepositoryMock.findProjectFile.mockResolvedValueOnce(null);
      await expect(projectService.deleteProjectFile("proj-1", "file-missing")).rejects.toThrow("File not found in this project");
    });

    it("deletes a project file", async () => {
      projectRepositoryMock.findProjectFile.mockResolvedValueOnce({ id: "file-1" });
      mediaServiceMock.deleteMedia.mockResolvedValueOnce(undefined);
      await projectService.deleteProjectFile("proj-1", "file-1");
      expect(mediaServiceMock.deleteMedia).toHaveBeenCalledWith("file-1");
    });
  });

  // --- AUTOMATION RULES ---
  describe("getAutomationRules / createAutomationRule", () => {
    it("returns automation rules", async () => {
      projectRepositoryMock.findAutomationRules.mockResolvedValueOnce([{ id: "rule-1" }]);
      const result = await projectService.getAutomationRules("proj-1");
      expect(result).toHaveLength(1);
    });

    it("throws BadRequestException if rule data is incomplete", () => {
      expect(() =>
        projectService.createAutomationRule("proj-1", { name: "Rule", trigger: "task_created" }) // missing action
      ).toThrow("Name, trigger, and action are required");
    });

    it("creates automation rule", async () => {
      projectRepositoryMock.createAutomationRule.mockResolvedValueOnce({ id: "rule-1" });
      const result = await projectService.createAutomationRule("proj-1", {
        name: "Rule 1", trigger: "task_created", action: "add_comment",
      });
      expect(result).toEqual({ id: "rule-1" });
    });
  });

  describe("updateAutomationRule / deleteAutomationRule", () => {
    it("throws NotFoundException when updating nonexistent rule", async () => {
      projectRepositoryMock.findAutomationRuleById.mockResolvedValueOnce(null);
      await expect(projectService.updateAutomationRule("rule-missing", {})).rejects.toThrow("Automation rule not found");
    });

    it("updates automation rule", async () => {
      projectRepositoryMock.findAutomationRuleById.mockResolvedValueOnce({ id: "rule-1" });
      projectRepositoryMock.updateAutomationRule.mockResolvedValueOnce({ id: "rule-1" });
      const result = await projectService.updateAutomationRule("rule-1", { isActive: false });
      expect(result).toEqual({ id: "rule-1" });
    });

    it("throws NotFoundException when deleting nonexistent rule", async () => {
      projectRepositoryMock.findAutomationRuleById.mockResolvedValueOnce(null);
      await expect(projectService.deleteAutomationRule("rule-missing")).rejects.toThrow("Automation rule not found");
    });

    it("deletes automation rule", async () => {
      projectRepositoryMock.findAutomationRuleById.mockResolvedValueOnce({ id: "rule-1" });
      projectRepositoryMock.deleteAutomationRule.mockResolvedValueOnce({ id: "rule-1" });
      const result = await projectService.deleteAutomationRule("rule-1");
      expect(result).toEqual({ id: "rule-1" });
    });
  });

  describe("restoreAutomationRule / forceDeleteAutomationRule", () => {
    it("throws NotFoundException for restore if rule not found", async () => {
      projectRepositoryMock.findAutomationRuleByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(projectService.restoreAutomationRule("rule-missing")).rejects.toThrow("Automation rule not found");
    });

    it("restores automation rule", async () => {
      projectRepositoryMock.findAutomationRuleByIdWithTrashed.mockResolvedValueOnce({ id: "rule-1" });
      projectRepositoryMock.restoreAutomationRule.mockResolvedValueOnce({ id: "rule-1" });
      const result = await projectService.restoreAutomationRule("rule-1");
      expect(result).toEqual({ id: "rule-1" });
    });

    it("throws NotFoundException for force delete if rule not found", async () => {
      projectRepositoryMock.findAutomationRuleByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(projectService.forceDeleteAutomationRule("rule-missing")).rejects.toThrow("Automation rule not found");
    });

    it("force deletes automation rule", async () => {
      projectRepositoryMock.findAutomationRuleByIdWithTrashed.mockResolvedValueOnce({ id: "rule-1" });
      projectRepositoryMock.forceDeleteAutomationRule.mockResolvedValueOnce({ id: "rule-1" });
      const result = await projectService.forceDeleteAutomationRule("rule-1");
      expect(result).toEqual({ id: "rule-1" });
    });
  });
});
