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

import { setMockUser } from "../helpers/auth";
import { prismaMock } from "../helpers/db";
import { createUser } from "../helpers/factories";

describe("Search API Endpoint Integration Tests (/api/v1/search)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(
      createUser({
        id: "user-123",
        email: "user@example.com",
      })
    );
  });

  it("returns search results successfully", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "w-1" }])
      .mockResolvedValueOnce([{ id: "p-1" }])
      .mockResolvedValueOnce([{ id: "t-1" }]);

    const res = await request(app)
      .get("/api/v1/search")
      .query({ q: "my-query" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.workspaces).toHaveLength(1);
    expect(res.body.data.projects).toHaveLength(1);
    expect(res.body.data.tasks).toHaveLength(1);
  });
});
