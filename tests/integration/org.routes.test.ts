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

vi.mock("../../src/app/http/middlewares/rate-limit.middleware", () => ({
  rateLimit: () => (req: unknown, res: unknown, next: unknown) => next(),
}));

import prisma from "@/lib/prisma";

const prismaMock = prisma as unknown;
import { setMockUser } from "../helpers/auth";
import { createUser, createOrganization } from "../helpers/factories";

describe("Org API Endpoint Integration Tests (/api/v1/org)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }));
  });

  describe("POST /api/v1/org/setup", () => {
    it("successfully sets up org", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-123" });
      prismaMock.session.findUnique.mockResolvedValueOnce({
        id: "session-123",
      });
      prismaMock.member.findFirst.mockResolvedValueOnce(null);
      prismaMock.organization.findUnique.mockResolvedValueOnce(null);

      const createdOrg = createOrganization({
        id: "org-new",
        name: "Acme",
        slug: "acme",
      });
      prismaMock.organization.create.mockResolvedValueOnce(createdOrg);
      prismaMock.member.create.mockResolvedValueOnce({ id: "mem-new" });
      prismaMock.workspace.create.mockResolvedValueOnce({
        id: "ws-new",
        name: "Acme Ws",
      });
      prismaMock.session.update.mockResolvedValueOnce({ id: "session-123" });

      const res = await request(app)
        .post("/api/v1/org/setup")
        .send({ name: "Acme", slug: "acme", workspaceName: "Acme Ws" });

      console.log("SETUP ORG RESPONSE:", res.status, res.body);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Organization created successfully");
    });
  });

  describe("POST /api/v1/org/members/:id/ban", () => {
    it("bans user successfully", async () => {
      prismaMock.member.findFirst.mockReset();
      prismaMock.member.findFirst.mockImplementation((args: unknown) => {
        console.log(
          "DEBUG Mock findFirst called with:",
          JSON.stringify(args, null, 2),
        );
        if (args?.where?.userId === "user-123") {
          return Promise.resolve({ id: "caller", role: "owner" });
        }
        if (args?.where?.userId === "target-user") {
          return Promise.resolve({ id: "target", role: "member" });
        }
        return Promise.resolve(null);
      });
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.session.deleteMany.mockResolvedValueOnce({});

      const res = await request(app)
        .post("/api/v1/org/members/target-user/ban")
        .send({ reason: "spam" });

      console.log("BAN USER RESPONSE:", res.status, res.body);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Member banned successfully");
    });
  });

  describe("POST /api/v1/org/members/invite", () => {
    it("returns 400 if email is missing", async () => {
      prismaMock.member.findFirst.mockImplementation((args: unknown) => {
        if (args?.where?.userId === "user-123") {
          return Promise.resolve({ id: "caller", role: "owner" });
        }
        return Promise.resolve(null);
      });

      const res = await request(app)
        .post("/api/v1/org/members/invite")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email is required");
    });
  });
});
