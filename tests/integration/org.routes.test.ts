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

import { setMockUser } from "../helpers/auth";
import { prismaMock } from "../helpers/db";
import { createUser, createOrganization } from "../helpers/factories";

describe("Org API Endpoint Integration Tests (/api/v1/org)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }));
  });

  describe("POST /api/v1/org/setup", () => {
    it("successfully sets up org", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-123" });
      prismaMock.session.findUnique.mockResolvedValueOnce({ id: "session-123" });
      prismaMock.member.findFirst.mockResolvedValueOnce(null);
      prismaMock.organization.findUnique.mockResolvedValueOnce(null);

      const createdOrg = createOrganization({ id: "org-new", name: "Acme", slug: "acme" });
      prismaMock.organization.create.mockResolvedValueOnce(createdOrg);
      prismaMock.member.create.mockResolvedValueOnce({ id: "mem-new" });
      prismaMock.workspace.create.mockResolvedValueOnce({ id: "ws-new", name: "Acme Ws" });
      prismaMock.session.update.mockResolvedValueOnce({ id: "session-123" });

      const res = await request(app)
        .post("/api/v1/org/setup")
        .send({ name: "Acme", slug: "acme", workspaceName: "Acme Ws" });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Organization created successfully");
    });
  });

  describe("POST /api/v1/org/members/:id/ban", () => {
    it("bans user successfully", async () => {
      prismaMock.member.findFirst
        .mockResolvedValueOnce({ id: "caller", role: "owner" })
        .mockResolvedValueOnce({ id: "target", role: "member" });
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.session.deleteMany.mockResolvedValueOnce({});

      const res = await request(app)
        .post("/api/v1/org/members/target-user/ban")
        .send({ reason: "spam" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Member banned successfully");
    });
  });

  describe("POST /api/v1/org/members/invite", () => {
    it("returns 400 if email is missing", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "caller", role: "owner" });

      const res = await request(app)
        .post("/api/v1/org/members/invite")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email is required");
    });
  });
});
