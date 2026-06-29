import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import app from "@/app";

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

vi.mock("@/lib/prisma", async () => {
  const { prismaMock } = await import("../helpers/db");
  return {
    default: prismaMock,
    basePrisma: prismaMock,
  };
});

vi.mock("../../src/app/http/middlewares/rate-limit.middleware", () => ({
  rateLimit: () => (req: any, res: any, next: any) => next(),
}));

const { mockVerifyProjectAccess, mockNotificationService } = vi.hoisted(() => ({
  mockVerifyProjectAccess: vi.fn().mockResolvedValue({
    userId: "user-123",
    project: { organizationId: "org-123" },
  }),
  mockNotificationService: {
    handleTaskCreated: vi.fn(),
    handleTaskUpdated: vi.fn(),
    handleCommentAdded: vi.fn(),
    handleCommentReaction: vi.fn(),
    handleAddedToProject: vi.fn(),
  },
}));

vi.mock("../../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
  resolveSession: vi
    .fn()
    .mockResolvedValue({ activeOrgId: "org-123", userId: "u1" }),
}));

vi.mock("../../src/app/services/notification.service", () => ({
  notificationService: mockNotificationService,
}));

import { setMockUser } from "../helpers/auth";
import { prismaMock } from "../helpers/db";
import { createUser } from "../helpers/factories";

describe("Task API Endpoint Integration Tests (/api/v1/tasks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }));
  });

  describe("POST /api/v1/projects/:projectId/tasks", () => {
    it("creates task successfully", async () => {
      prismaMock.taskStatus.findFirst.mockResolvedValueOnce({ id: "status-1" });
      prismaMock.project.update.mockResolvedValueOnce({
        projectKey: "PROJ",
        taskSequence: 1,
      });
      prismaMock.task.create.mockResolvedValueOnce({
        id: "t1",
        title: "New Task",
      });

      const res = await request(app).post("/api/v1/projects/p1/tasks").send({
        title: "New Task",
        statusId: "550e8400-e29b-41d4-a716-446655440001",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("t1");
    });
  });

  describe("GET /api/v1/projects/:projectId/tasks", () => {
    it("fetches tasks successfully", async () => {
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: "p1",
        organizationId: "org-123",
        workspaceId: "ws-123",
      });
      prismaMock.task.findMany.mockResolvedValueOnce([{ id: "t1" }]);

      const res = await request(app).get("/api/v1/projects/p1/tasks");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("POST /api/v1/projects/:projectId/sprints", () => {
    it("creates sprint successfully", async () => {
      prismaMock.sprint.create.mockResolvedValueOnce({
        id: "s1",
        name: "Sprint 1",
      });

      const res = await request(app)
        .post("/api/v1/projects/p1/sprints")
        .send({ name: "Sprint 1" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
