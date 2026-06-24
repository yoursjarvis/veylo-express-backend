import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app";

vi.mock("../../src/lib/auth/auth", async () => {
  const { getSessionMock } = await import("../helpers/auth");
  return {
    auth: {
      api: {
        getSession: getSessionMock,
      },
    },
  };
});

vi.mock("../../src/lib/prisma", async () => {
  const { prismaMock } = await import("../helpers/db");
  return {
    default: prismaMock,
    basePrisma: prismaMock,
  };
});

vi.mock("../../src/app/http/middlewares/rate-limit.middleware", () => ({
  rateLimit: () => (req: any, res: any, next: any) => next(),
}));

const { mockWorkspaceAdmin, mockVerifyProjectAccess, mockVerifyProjectAdmin } = vi.hoisted(() => ({
  mockWorkspaceAdmin: vi.fn().mockResolvedValue({ userId: "user-123", activeOrgId: "org-123" }),
  mockVerifyProjectAccess: vi.fn().mockResolvedValue(undefined),
  mockVerifyProjectAdmin: vi.fn().mockResolvedValue({ project: { id: "proj-123", workspaceId: "ws-123" } }),
}));

vi.mock("../../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
  verifyProjectAdmin: mockVerifyProjectAdmin,
  verifyWorkspaceAdmin: mockWorkspaceAdmin,
  resolveSession: vi.fn().mockResolvedValue({ userId: "user-123" }),
}));

vi.mock("../../src/utils/crypto", () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
  decrypt: vi.fn((val) => val.replace("encrypted_", "")),
}));

import { setMockUser } from "../helpers/auth";
import { prismaMock } from "../helpers/db";
import { createUser, createProject } from "../helpers/factories";

describe("Project API Endpoint Integration Tests (/api/v1/projects)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }));
  });

  describe("GET /api/v1/project-templates", () => {
    it("successfully retrieves templates", async () => {
      prismaMock.projectTemplate.findMany.mockResolvedValueOnce([{ id: "t1", name: "Scrum" }]);

      const res = await request(app).get("/api/v1/project-templates");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("POST /api/v1/workspaces/:workspaceId/projects", () => {
    it("creates project successfully", async () => {
      prismaMock.projectTemplate.findUnique.mockResolvedValueOnce(null); // fallback
      prismaMock.workspace.findUnique.mockResolvedValueOnce({ organizationId: "org-123" });

      const created = createProject({ id: "proj-123", title: "New Project" });
      prismaMock.project.create.mockResolvedValueOnce(created);

      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/projects")
        .send({ title: "New Project", template: "simple" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("proj-123");
    });
  });

  describe("GET /api/v1/projects/:id/members", () => {
    it("retrieves project members", async () => {
      prismaMock.projectMember.findMany.mockResolvedValueOnce([{ id: "m1", userId: "u1" }]);

      const res = await request(app).get("/api/v1/projects/proj-123/members");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });
});
