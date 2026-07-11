import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock middlewares
vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const {
  mockWorkspaceAdmin,
  mockVerifyProjectAccess,
  mockVerifyProjectAdmin,
  mockResolveSession,
  prismaMock,
  mockMediaService,
} = vi.hoisted(() => ({
  mockWorkspaceAdmin: vi
    .fn()
    .mockResolvedValue({ userId: "user-123", activeOrgId: "org-123" }),
  mockVerifyProjectAccess: vi.fn().mockResolvedValue(undefined),
  mockVerifyProjectAdmin: vi
    .fn()
    .mockResolvedValue({ project: { id: "proj-123", workspaceId: "ws-123" } }),
  mockResolveSession: vi.fn().mockResolvedValue({ userId: "user-123" }),
  prismaMock: {
    projectTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findMany: vi.fn(),
    },
    project: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectMember: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    vault: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    vaultService: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    vaultItem: {
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    media: {
      findFirst: vi.fn(),
    },
  },
  mockMediaService: {
    addMedia: vi.fn(),
    getUrl: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
    generateUrl: vi.fn().mockReturnValue("http://localhost/files/dummy.png"),
  },
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
  verifyProjectAdmin: mockVerifyProjectAdmin,
  verifyWorkspaceAdmin: mockWorkspaceAdmin,
  resolveSession: mockResolveSession,
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
  basePrisma: prismaMock,
}));
vi.mock("../src/core/media", () => ({ mediaService: mockMediaService }));
vi.mock("../src/utils/crypto", () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
  decrypt: vi.fn((val) => val.replace("encrypted_", "")),
}));

import { projectController } from "../src/app/http/controllers/project.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("projectController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProjectTemplates", () => {
    it("returns list of templates", async () => {
      const templates = [
        {
          id: "1",
          name: "Software Scrum",
          slug: "software-scrum",
          icon: "Layers",
          category: "software",
        },
      ];
      prismaMock.projectTemplate.findMany.mockResolvedValueOnce(templates);

      const req: any = {};
      const res = createRes();

      await (projectController.getProjectTemplates as any)(req, res);

      expect(prismaMock.projectTemplate.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Project templates fetched successfully",
        data: templates,
      });
    });
  });

  describe("getProjectTemplateBySlug", () => {
    it("returns template or throws 404", async () => {
      const template = {
        id: "1",
        name: "Software Scrum",
        slug: "software-scrum",
        icon: "Layers",
        category: "software",
      };
      prismaMock.projectTemplate.findUnique.mockResolvedValueOnce(template);

      const req: any = { params: { slug: "software-scrum" } };
      const res = createRes();

      await (projectController.getProjectTemplateBySlug as any)(req, res);

      expect(prismaMock.projectTemplate.findUnique).toHaveBeenCalledWith({
        where: { slug: "software-scrum" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Project template fetched successfully",
        data: template,
      });
    });

    it("throws NotFoundException when template is not found", async () => {
      prismaMock.projectTemplate.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { slug: "non-existent" } };
      const res = createRes();

      await expect(
        (projectController.getProjectTemplateBySlug as any)(req, res),
      ).rejects.toThrow("Project template not found");
    });
  });

  describe("createProject", () => {
    it("uses template config to create status and custom fields", async () => {
      const template = {
        id: "1",
        name: "Software Scrum",
        slug: "software-scrum",
        config: {
          teamMode: "software",
          statuses: [{ name: "Backlog", category: "backlog", order: 0 }],
          customFields: [{ name: "Story Points", type: "number" }],
        },
      };
      prismaMock.projectTemplate.findUnique.mockResolvedValueOnce(template);
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        organizationId: "org-123",
      });

      const createdProject = {
        id: "proj-123",
        title: "New Project",
        template: "software-scrum",
        teamMode: "software",
      };
      prismaMock.project.create.mockResolvedValueOnce(createdProject);

      const req: any = {
        params: { workspaceId: "ws-123" },
        body: {
          title: "New Project",
          template: "software-scrum",
          projectKey: "PR",
        },
      };
      const res = createRes();

      await (projectController.createProject as any)(req, res);

      expect(prismaMock.projectTemplate.findUnique).toHaveBeenCalledWith({
        where: { slug: "software-scrum" },
      });
      expect(prismaMock.project.create).toHaveBeenCalledWith({
        data: {
          title: "New Project",
          projectKey: "PR",
          description: undefined,
          icon: undefined,
          template: "software-scrum",
          teamMode: "software",
          workspaceId: "ws-123",
          organizationId: "org-123",
          vault: { create: {} },
          taskStatuses: {
            createMany: {
              data: [
                {
                  name: "Backlog",
                  category: "backlog",
                  order: 0,
                  organizationId: "org-123",
                },
              ],
            },
          },
          customFields: {
            createMany: {
              data: [
                {
                  name: "Story Points",
                  type: "number",
                  organizationId: "org-123",
                },
              ],
            },
          },
        },
        include: {
          taskStatuses: true,
          customFields: true,
        },
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Project created successfully",
        data: createdProject,
      });
    });

    it("uses simple template fallback when templateSlug is not found in database", async () => {
      prismaMock.projectTemplate.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null); // falls back to activeOrgId

      const createdProject = {
        id: "proj-123",
        title: "New Project",
        template: "custom-slug",
        teamMode: "general",
      };
      prismaMock.project.create.mockResolvedValueOnce(createdProject);

      const req: any = {
        params: { workspaceId: "ws-123" },
        body: {
          title: "New Project",
          template: "custom-slug",
          projectKey: "PR",
        },
      };
      const res = createRes();

      await (projectController.createProject as any)(req, res);

      expect(prismaMock.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            template: "custom-slug",
            taskStatuses: {
              createMany: {
                data: [
                  {
                    name: "To Do",
                    category: "todo",
                    order: 0,
                    organizationId: "org-123",
                  },
                  {
                    name: "Done",
                    category: "done",
                    order: 1,
                    organizationId: "org-123",
                  },
                ],
              },
            },
          }),
        }),
      );
    });
  });

  describe("getProjects", () => {
    it("returns all projects for workspace admin", async () => {
      const mockProjects = [{ id: "p1", title: "Project 1" }];
      mockWorkspaceAdmin.mockResolvedValueOnce({
        userId: "admin-123",
        activeOrgId: "org-123",
      });
      prismaMock.project.findMany.mockResolvedValueOnce(mockProjects);

      const req: any = { params: { workspaceId: "ws-123" } };
      const res = createRes();

      await (projectController.getProjects as any)(req, res);

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws-123",
          deletedAt: null,
        },
        include: {
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Projects fetched successfully",
        data: mockProjects,
      });
    });

    it("returns member-only projects when workspace admin verification fails", async () => {
      const mockProjects = [{ id: "p1", title: "Project 1" }];
      mockWorkspaceAdmin.mockRejectedValueOnce(new Error("Not admin"));
      mockResolveSession.mockResolvedValueOnce({ userId: "user-123" });
      prismaMock.project.findMany.mockResolvedValueOnce(mockProjects);

      const req: any = { params: { workspaceId: "ws-123" } };
      const res = createRes();

      await (projectController.getProjects as any)(req, res);

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "ws-123",
          deletedAt: null,
          members: {
            some: { userId: "user-123" },
          },
        },
        include: {
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("getProject", () => {
    it("verifies project access and returns details", async () => {
      const projectDetails = {
        id: "proj-123",
        title: "Test Project",
        members: [],
      };
      prismaMock.project.findUnique.mockResolvedValueOnce(projectDetails);

      const req: any = { params: { id: "proj-123" } };
      const res = createRes();

      await (projectController.getProject as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "proj-123");
      expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
        where: { id: "proj-123" },
        include: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Project fetched successfully",
        data: projectDetails,
      });
    });
  });

  describe("updateProject", () => {
    it("verifies admin access and updates details", async () => {
      const updatedProject = { id: "proj-123", title: "Updated Project" };
      prismaMock.project.update.mockResolvedValueOnce(updatedProject);

      const req: any = {
        params: { id: "proj-123" },
        body: { title: "Updated Project" },
      };
      const res = createRes();

      await (projectController.updateProject as any)(req, res);

      expect(mockVerifyProjectAdmin).toHaveBeenCalledWith(req, "proj-123");
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: "proj-123" },
        data: { title: "Updated Project" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Project updated successfully",
        data: updatedProject,
      });
    });
  });

  describe("deleteProject", () => {
    it("verifies admin access and deletes project", async () => {
      prismaMock.project.delete.mockResolvedValueOnce({ id: "proj-123" });

      const req: any = { params: { id: "proj-123" } };
      const res = createRes();

      await (projectController.deleteProject as any)(req, res);

      expect(mockVerifyProjectAdmin).toHaveBeenCalledWith(req, "proj-123");
      expect(prismaMock.project.delete).toHaveBeenCalledWith({
        where: { id: "proj-123" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Project deleted successfully",
        data: {},
      });
    });
  });

  describe("getProjectMembers", () => {
    it("verifies access and returns list", async () => {
      const members = [{ id: "m1", userId: "u1", user: { name: "User" } }];
      prismaMock.projectMember.findMany.mockResolvedValueOnce(members);

      const req: any = { params: { id: "proj-123" } };
      const res = createRes();

      await (projectController.getProjectMembers as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "proj-123");
      expect(prismaMock.projectMember.findMany).toHaveBeenCalledWith({
        where: { projectId: "proj-123" },
        include: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Project members fetched",
        data: members,
      });
    });
  });

  describe("addProjectMembers", () => {
    it("throws BadRequestException if userIds is empty or not array", async () => {
      const req: any = { params: { id: "proj-123" }, body: { userIds: [] } };
      const res = createRes();

      await expect(
        (projectController.addProjectMembers as any)(req, res),
      ).rejects.toThrow("User IDs are required");
    });

    it("throws BadRequestException if user is not in workspace", async () => {
      prismaMock.workspaceMember.findMany.mockResolvedValueOnce([]); // only 0 members match

      const req: any = {
        params: { id: "proj-123" },
        body: { userIds: ["user-123"] },
      };
      const res = createRes();

      await expect(
        (projectController.addProjectMembers as any)(req, res),
      ).rejects.toThrow("One or more users are not members of this workspace");
    });

    it("upserts project member records if in workspace", async () => {
      prismaMock.workspaceMember.findMany.mockResolvedValueOnce([
        { userId: "user-123" },
      ]);
      prismaMock.projectMember.upsert.mockResolvedValueOnce({ id: "pm-1" });

      const req: any = {
        params: { id: "proj-123" },
        body: { userIds: ["user-123"] },
      };
      const res = createRes();

      await (projectController.addProjectMembers as any)(req, res);

      expect(prismaMock.projectMember.upsert).toHaveBeenCalledWith({
        where: {
          projectId_userId: { projectId: "proj-123", userId: "user-123" },
        },
        update: {},
        create: { projectId: "proj-123", userId: "user-123" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Members assigned to project",
        data: [{ id: "pm-1" }],
      });
    });
  });

  describe("removeProjectMember", () => {
    it("verifies project admin access and deletes project member", async () => {
      prismaMock.projectMember.delete.mockResolvedValueOnce({ id: "pm-1" });

      const req: any = { params: { id: "proj-123", userId: "user-123" } };
      const res = createRes();

      await (projectController.removeProjectMember as any)(req, res);

      expect(mockVerifyProjectAdmin).toHaveBeenCalledWith(req, "proj-123");
      expect(prismaMock.projectMember.delete).toHaveBeenCalledWith({
        where: {
          projectId_userId: { projectId: "proj-123", userId: "user-123" },
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Member removed from project",
        data: {},
      });
    });
  });

  describe("getProjectVault", () => {
    it("decrypts values/notes when vault exists", async () => {
      const mockVault = {
        id: "v-123",
        projectId: "proj-123",
        services: [
          {
            id: "s-123",
            name: "service",
            items: [
              {
                id: "i1",
                key: "k1",
                value: "encrypted_plainValue",
                note: "encrypted_plainNote",
              },
              {
                id: "i2",
                key: "k2",
                value: "encrypted_plainValue",
                note: null,
              },
            ],
          },
        ],
      };
      prismaMock.vault.findUnique.mockResolvedValueOnce(mockVault);

      const req: any = { params: { id: "proj-123" } };
      const res = createRes();

      await (projectController.getProjectVault as any)(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Vault fetched successfully",
        data: expect.objectContaining({
          services: [
            expect.objectContaining({
              items: [
                expect.objectContaining({
                  value: "plainValue",
                  note: "plainNote",
                }),
                expect.objectContaining({ value: "plainValue", note: null }),
              ],
            }),
          ],
        }),
      });
    });

    it("creates vault automatically if not present", async () => {
      prismaMock.vault.findUnique.mockResolvedValueOnce(null);
      const createdVault = { id: "v-123", projectId: "proj-123", services: [] };
      prismaMock.vault.create.mockResolvedValueOnce(createdVault);

      const req: any = { params: { id: "proj-123" } };
      const res = createRes();

      await (projectController.getProjectVault as any)(req, res);

      expect(prismaMock.vault.create).toHaveBeenCalledWith({
        data: { projectId: "proj-123" },
        include: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Vault fetched successfully",
        data: createdVault,
      });
    });

    it("returns '[Decryption Failed]' fallback when decryption throws", async () => {
      const { decrypt } = await import("../src/utils/crypto");
      (decrypt as any).mockImplementation(() => {
        throw new Error("Tampered data");
      });

      const mockVault = {
        id: "v-123",
        projectId: "proj-123",
        services: [
          {
            id: "s-123",
            name: "service",
            items: [
              {
                id: "i1",
                key: "k1",
                value: "invalid_ciphertext",
                note: "invalid_note",
              },
            ],
          },
        ],
      };
      prismaMock.vault.findUnique.mockResolvedValueOnce(mockVault);

      const req: any = { params: { id: "proj-123" } };
      const res = createRes();

      await (projectController.getProjectVault as any)(req, res);

      // Restore mock decryption
      (decrypt as any).mockImplementation((val: string) =>
        val.replace("encrypted_", ""),
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Vault fetched successfully",
        data: expect.objectContaining({
          services: [
            expect.objectContaining({
              items: [
                expect.objectContaining({
                  value: "[Decryption Failed]",
                  note: "[Decryption Failed]",
                }),
              ],
            }),
          ],
        }),
      });
    });
  });

  describe("addVaultService", () => {
    it("throws NotFoundException if vault does not exist", async () => {
      prismaMock.vault.findUnique.mockResolvedValueOnce(null);

      const req: any = {
        params: { id: "proj-123" },
        body: { name: "service-1" },
      };
      const res = createRes();

      await expect(
        (projectController.addVaultService as any)(req, res),
      ).rejects.toThrow("Vault not found for this project");
    });

    it("throws BadRequestException if service already exists", async () => {
      prismaMock.vault.findUnique.mockResolvedValueOnce({ id: "v-123" });
      prismaMock.vaultService.findFirst.mockResolvedValueOnce({
        id: "s-123",
        name: "service-1",
      });

      const req: any = {
        params: { id: "proj-123" },
        body: { name: "service-1" },
      };
      const res = createRes();

      await expect(
        (projectController.addVaultService as any)(req, res),
      ).rejects.toThrow("Service already exists");
    });

    it("creates service successfully", async () => {
      prismaMock.vault.findUnique.mockResolvedValueOnce({ id: "v-123" });
      prismaMock.vaultService.findFirst.mockResolvedValueOnce(null);
      const newService = { id: "s-new", name: "service-1" };
      prismaMock.vaultService.create.mockResolvedValueOnce(newService);

      const req: any = {
        params: { id: "proj-123" },
        body: { name: "service-1" },
      };
      const res = createRes();

      await (projectController.addVaultService as any)(req, res);

      expect(prismaMock.vaultService.create).toHaveBeenCalledWith({
        data: { vaultId: "v-123", name: "service-1" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Vault service added successfully",
        data: newService,
      });
    });
  });

  describe("deleteVaultService", () => {
    it("deletes service successfully", async () => {
      prismaMock.vaultService.delete.mockResolvedValueOnce({ id: "s-123" });

      const req: any = { params: { id: "proj-123", serviceId: "s-123" } };
      const res = createRes();

      await (projectController.deleteVaultService as any)(req, res);

      expect(prismaMock.vaultService.delete).toHaveBeenCalledWith({
        where: { id: "s-123" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Vault service and its secrets deleted successfully",
        data: {},
      });
    });
  });

  describe("addOrUpdateVaultItem", () => {
    it("encrypts and upserts vault item", async () => {
      const upsertedItem = {
        id: "i-123",
        key: "apiKey",
        value: "encrypted_plainSecret",
        note: "encrypted_plainNote",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.vaultItem.upsert.mockResolvedValueOnce(upsertedItem);

      const req: any = {
        params: { id: "proj-123", serviceId: "s-123" },
        body: { key: "apiKey", value: "plainSecret", note: "plainNote" },
      };
      const res = createRes();

      await (projectController.addOrUpdateVaultItem as any)(req, res);

      expect(prismaMock.vaultItem.upsert).toHaveBeenCalledWith({
        where: { serviceId_key: { serviceId: "s-123", key: "apiKey" } },
        update: { value: "encrypted_plainSecret", note: "encrypted_plainNote" },
        create: {
          serviceId: "s-123",
          key: "apiKey",
          value: "encrypted_plainSecret",
          note: "encrypted_plainNote",
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Vault item saved successfully",
        data: expect.objectContaining({
          key: "apiKey",
          value: "plainSecret",
          note: "plainNote",
        }),
      });
    });
  });

  describe("updateVaultItem", () => {
    it("updates only requested vault item details", async () => {
      const updatedItem = {
        id: "i-123",
        key: "apiKey",
        value: "encrypted_plainSecret",
        note: null,
      };
      prismaMock.vaultItem.update.mockResolvedValueOnce(updatedItem);

      const req: any = {
        params: { id: "proj-123", itemId: "i-123" },
        body: { value: "plainSecret" },
      };
      const res = createRes();

      await (projectController.updateVaultItem as any)(req, res);

      expect(prismaMock.vaultItem.update).toHaveBeenCalledWith({
        where: { id: "i-123" },
        data: { value: "encrypted_plainSecret" },
      });
    });

    it("updates vault item note and handles non-null / null notes", async () => {
      const updatedItem1 = {
        id: "i-123",
        key: "apiKey",
        value: "encrypted_plainSecret",
        note: "encrypted_newNote",
      };
      prismaMock.vaultItem.update.mockResolvedValueOnce(updatedItem1);

      const req1: any = {
        params: { id: "proj-123", itemId: "i-123" },
        body: { note: "newNote" },
      };
      const res1 = createRes();

      await (projectController.updateVaultItem as any)(req1, res1);

      expect(prismaMock.vaultItem.update).toHaveBeenCalledWith({
        where: { id: "i-123" },
        data: { note: "encrypted_newNote" },
      });

      const updatedItem2 = {
        id: "i-123",
        key: "apiKey",
        value: "encrypted_plainSecret",
        note: null,
      };
      prismaMock.vaultItem.update.mockResolvedValueOnce(updatedItem2);

      const req2: any = {
        params: { id: "proj-123", itemId: "i-123" },
        body: { note: null },
      };
      const res2 = createRes();

      await (projectController.updateVaultItem as any)(req2, res2);

      expect(prismaMock.vaultItem.update).toHaveBeenCalledWith({
        where: { id: "i-123" },
        data: { note: null },
      });
    });
  });

  describe("deleteVaultItem", () => {
    it("deletes vault item successfully", async () => {
      prismaMock.vaultItem.delete.mockResolvedValueOnce({ id: "i-123" });

      const req: any = { params: { id: "proj-123", itemId: "i-123" } };
      const res = createRes();

      await (projectController.deleteVaultItem as any)(req, res);

      expect(prismaMock.vaultItem.delete).toHaveBeenCalledWith({
        where: { id: "i-123" },
      });
    });
  });

  describe("uploadProjectFile", () => {
    it("throws BadRequestException if no file uploaded", async () => {
      const req: any = { params: { id: "proj-123" } }; // no req.file
      const res = createRes();

      await expect(
        (projectController.uploadProjectFile as any)(req, res),
      ).rejects.toThrow("No file uploaded");
    });

    it("throws BadRequestException if extension is disallowed", async () => {
      const req: any = {
        params: { id: "proj-123" },
        file: {
          originalname: "malicious.exe",
          mimetype: "application/octet-stream",
          buffer: Buffer.from(""),
          size: 100,
        },
      };
      const res = createRes();

      await expect(
        (projectController.uploadProjectFile as any)(req, res),
      ).rejects.toThrow("File type not allowed or is potentially malicious");
    });

    it("uploads using mediaService and returns URL", async () => {
      const mockMedia = {
        id: "m-123",
        name: "doc.pdf",
        fileName: "uuid-doc.pdf",
        mimeType: "application/pdf",
        size: 100,
        createdAt: new Date(),
      };
      mockMediaService.addMedia.mockResolvedValueOnce(mockMedia);
      mockMediaService.generateUrl.mockReturnValueOnce("http://s3/doc.pdf");

      const req: any = {
        params: { id: "proj-123" },
        file: {
          originalname: "doc.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.from("content"),
          size: 100,
        },
      };
      const res = createRes();

      await (projectController.uploadProjectFile as any)(req, res);

      expect(mockMediaService.addMedia).toHaveBeenCalledWith(
        "Project",
        "proj-123",
        {
          buffer: req.file.buffer,
          originalname: "doc.pdf",
          mimetype: "application/pdf",
          size: 100,
        },
        "project_files",
        false,
      );
      expect(mockMediaService.generateUrl).toHaveBeenCalledWith(mockMedia);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "File uploaded successfully",
        data: expect.objectContaining({
          id: "m-123",
          url: "http://s3/doc.pdf",
        }),
      });
    });
  });

  describe("getProjectFiles", () => {
    it("fetches project files with their signed URLs", async () => {
      const mockFiles = [
        {
          id: "m-1",
          name: "doc.pdf",
          fileName: "f1.pdf",
          mimeType: "application/pdf",
          size: 50,
          createdAt: new Date(),
        },
      ];
      mockMediaService.getMedia.mockResolvedValueOnce(mockFiles);
      mockMediaService.generateUrl.mockReturnValueOnce("http://s3/f1.pdf");

      const req: any = { params: { id: "proj-123" } };
      const res = createRes();

      await (projectController.getProjectFiles as any)(req, res);

      expect(mockMediaService.getMedia).toHaveBeenCalledWith(
        "Project",
        "proj-123",
        "project_files",
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Project files fetched successfully",
        data: [expect.objectContaining({ id: "m-1", url: "http://s3/f1.pdf" })],
      });
    });
  });

  describe("deleteProjectFile", () => {
    it("throws NotFoundException if file is not part of project", async () => {
      prismaMock.media.findFirst.mockResolvedValueOnce(null);

      const req: any = { params: { id: "proj-123", fileId: "m-missing" } };
      const res = createRes();

      await expect(
        (projectController.deleteProjectFile as any)(req, res),
      ).rejects.toThrow("File not found in this project");
    });

    it("deletes media if file exists in project", async () => {
      prismaMock.media.findFirst.mockResolvedValueOnce({ id: "m-1" });
      mockMediaService.deleteMedia.mockResolvedValueOnce(undefined);

      const req: any = { params: { id: "proj-123", fileId: "m-1" } };
      const res = createRes();

      await (projectController.deleteProjectFile as any)(req, res);

      expect(prismaMock.media.findFirst).toHaveBeenCalledWith({
        where: { id: "m-1", modelType: "Project", modelId: "proj-123" },
      });
      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith("m-1");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Project file deleted successfully",
        data: {},
      });
    });
  });
});
