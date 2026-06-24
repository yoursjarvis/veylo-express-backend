import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock middlewares
vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockWorkspaceAdmin, prismaMock } = vi.hoisted(() => ({
  mockWorkspaceAdmin: vi.fn().mockResolvedValue({ userId: "user-123", activeOrgId: "org-123" }),
  prismaMock: {
    projectTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
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
  }
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: vi.fn(),
  verifyProjectAdmin: vi.fn(),
  verifyWorkspaceAdmin: mockWorkspaceAdmin,
  resolveSession: vi.fn(),
}));

vi.mock("../src/lib/prisma", () => ({ default: prismaMock }));

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

  it("getProjectTemplates: returns list of templates", async () => {
    const templates = [
      { id: "1", name: "Software Scrum", slug: "software-scrum", icon: "Layers", category: "software" },
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

  it("getProjectTemplateBySlug: returns template or 404", async () => {
    const template = { id: "1", name: "Software Scrum", slug: "software-scrum", icon: "Layers", category: "software" };
    prismaMock.projectTemplate.findUnique.mockResolvedValueOnce(template);

    const req: any = { params: { slug: "software-scrum" } };
    const res = createRes();

    await (projectController.getProjectTemplateBySlug as any)(req, res);

    expect(prismaMock.projectTemplate.findUnique).toHaveBeenCalledWith({ where: { slug: "software-scrum" } });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Project template fetched successfully",
      data: template,
    });
  });

  it("createProject: uses template config to create status and custom fields", async () => {
    const template = {
      id: "1",
      name: "Software Scrum",
      slug: "software-scrum",
      config: {
        teamMode: "software",
        statuses: [
          { name: "Backlog", category: "backlog", order: 0 },
        ],
        customFields: [
          { name: "Story Points", type: "number" },
        ],
      },
    };
    prismaMock.projectTemplate.findUnique.mockResolvedValueOnce(template);
    prismaMock.workspace.findUnique.mockResolvedValueOnce({ organizationId: "org-123" });
    
    const createdProject = {
      id: "proj-123",
      title: "New Project",
      template: "software-scrum",
      teamMode: "software",
    };
    prismaMock.project.create.mockResolvedValueOnce(createdProject);

    const req: any = {
      params: { workspaceId: "ws-123" },
      body: { title: "New Project", template: "software-scrum" },
    };
    const res = createRes();

    await (projectController.createProject as any)(req, res);

    expect(prismaMock.projectTemplate.findUnique).toHaveBeenCalledWith({ where: { slug: "software-scrum" } });
    expect(prismaMock.project.create).toHaveBeenCalledWith({
      data: {
        title: "New Project",
        description: undefined,
        icon: undefined,
        template: "software-scrum",
        teamMode: "software",
        workspaceId: "ws-123",
        organizationId: "org-123",
        vault: { create: {} },
        taskStatuses: {
          createMany: {
            data: [{ name: "Backlog", category: "backlog", order: 0, organizationId: "org-123" }],
          },
        },
        customFields: {
          createMany: {
            data: [{ name: "Story Points", type: "number", organizationId: "org-123" }],
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
});
