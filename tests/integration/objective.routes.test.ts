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
  rateLimit: () => (req: unknown, res: unknown, next: unknown) => next(),
}));

import { setMockUser } from "../helpers/auth";
import { prismaMock } from "../helpers/db";
import { createUser } from "../helpers/factories";

describe("Objective API Endpoint Integration Tests (/api/v1/objectives)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(
      createUser({
        id: "user-123",
        email: "user@example.com",
      })
    );
  });

  describe("GET /api/v1/workspaces/:workspaceId/objectives", () => {
    it("fetches objectives successfully", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        id: "550e8400-e29b-41d4-a716-446655440003",
        organizationId: "org-123",
      });
      prismaMock.objective.findMany.mockResolvedValueOnce([{ id: "550e8400-e29b-41d4-a716-446655440002", title: "Objective 1" }]);

      const res = await request(app).get("/api/v1/workspaces/550e8400-e29b-41d4-a716-446655440003/objectives");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("POST /api/v1/objectives", () => {
    it("creates objective successfully", async () => {
      prismaMock.project.findUnique.mockResolvedValue({
        id: "550e8400-e29b-41d4-a716-446655440001",
        workspaceId: "550e8400-e29b-41d4-a716-446655440003",
        organizationId: "org-123",
      });
      prismaMock.objective.create.mockResolvedValueOnce({
        id: "550e8400-e29b-41d4-a716-446655440002",
        title: "New Objective",
      });

      const res = await request(app)
        .post("/api/v1/objectives")
        .send({
          title: "New Objective",
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          krTitle: "KR Title",
          krTarget: "KR Target",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("550e8400-e29b-41d4-a716-446655440002");
    });
  });

  describe("DELETE /api/v1/objectives/:id", () => {
    it("deletes objective successfully", async () => {
      const mockObj = {
        id: "550e8400-e29b-41d4-a716-446655440002",
        projectId: "550e8400-e29b-41d4-a716-446655440001",
        project: {
          workspaceId: "550e8400-e29b-41d4-a716-446655440003",
          organizationId: "org-123",
        },
      };
      prismaMock.objective.findFirstWithTrashed.mockResolvedValue(mockObj);
      prismaMock.objective.findUniqueWithTrashed.mockResolvedValue(mockObj);
      prismaMock.objective.delete.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002" });

      const res = await request(app).delete("/api/v1/objectives/550e8400-e29b-41d4-a716-446655440002");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
