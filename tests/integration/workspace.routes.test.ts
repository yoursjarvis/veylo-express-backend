import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app";

// 1. Register Global Mocks with dynamic imports to avoid hoisting ReferenceError
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

// Now safely import helpers for use inside test assertions
import { setMockUser, clearMockUser } from "../helpers/auth";
import { prismaMock } from "../helpers/db";
import { createUser, createWorkspace } from "../helpers/factories";

describe("Workspace API Endpoint Integration Tests (/api/v1/workspaces)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Configure default mock user/session
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }));

    // Stub the sync org admins findMany to return nothing by default
    prismaMock.member.findMany.mockResolvedValue([]);
  });

  describe("GET /api/v1/workspaces", () => {
    it("INT-WS-GET-01: successfully retrieves all workspaces that a user has access to", async () => {
      const mockWorkspaces = [
        createWorkspace({ id: "ws-1", name: "Workspace One", slug: "ws-one", organizationId: "org-123" }),
        createWorkspace({ id: "ws-2", name: "Workspace Two", slug: "ws-two", organizationId: "org-123" }),
      ];
      prismaMock.workspace.findMany.mockResolvedValueOnce(mockWorkspaces);

      const res = await request(app)
        .get("/api/v1/workspaces")
        .set("Authorization", "Bearer mock-token");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Workspaces fetched",
        data: expect.any(Array),
      });
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].id).toBe("ws-1");
      expect(prismaMock.workspace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-123",
          }),
        })
      );
    });

    it("INT-WS-GET-02: returns 401 Unauthorized if no active user session is resolved", async () => {
      clearMockUser(); // simulate unauthenticated

      const res = await request(app).get("/api/v1/workspaces");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("INT-WS-GET-03: returns 400 Bad Request if user has no active organization", async () => {
      setMockUser({ id: "user-123" }, { activeOrganizationId: null });

      const res = await request(app).get("/api/v1/workspaces");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("No active organization found");
    });
  });

  describe("POST /api/v1/workspaces", () => {
    it("INT-WS-POST-01: creates workspace successfully for an organization admin", async () => {
      // User is Org Admin
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-123", role: "admin" });
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null); // No slug conflict
      
      const createdWorkspace = createWorkspace({ id: "ws-new", name: "Acme Web", slug: "acme-web", organizationId: "org-123" });
      prismaMock.workspace.create.mockResolvedValueOnce(createdWorkspace);

      const res = await request(app)
        .post("/api/v1/workspaces")
        .send({ name: "Acme Web", slug: "acme-web" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Workspace created successfully",
        data: {
          id: "ws-new",
          name: "Acme Web",
          slug: "acme-web",
          organizationId: "org-123",
          createdAt: expect.any(String),
        },
      });
      expect(prismaMock.workspace.create).toHaveBeenCalledWith({
        data: {
          name: "Acme Web",
          slug: "acme-web",
          organizationId: "org-123",
          members: {
            create: {
              userId: "user-123",
              role: "admin",
            },
          },
        },
      });
    });

    it("INT-WS-POST-02: returns 422 validation failure if required body fields are missing", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-123", role: "admin" });

      const res = await request(app)
        .post("/api/v1/workspaces")
        .send({ name: "Only Name" }); // Missing slug

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Validation Failed");
      expect(res.body.details).toContainEqual(
        expect.objectContaining({ field: "slug" })
      );
    });

    it("INT-WS-POST-03: returns 422 validation failure if slug format is invalid", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-123", role: "admin" });

      const res = await request(app)
        .post("/api/v1/workspaces")
        .send({ name: "Acme Web", slug: "Acme_Web!Spaces" }); // Capitals and special symbols not allowed in schema regex

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toContainEqual(
        expect.objectContaining({ field: "slug", message: "Slug can only contain lowercase letters, numbers, and hyphens" })
      );
    });

    it("INT-WS-POST-04: returns 400 Bad Request if workspace slug already exists", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-123", role: "admin" });
      prismaMock.workspace.findUnique.mockResolvedValueOnce({ id: "ws-old", slug: "acme-web" });

      const res = await request(app)
        .post("/api/v1/workspaces")
        .send({ name: "Acme Web", slug: "acme-web" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Workspace slug already exists");
    });

    it("INT-WS-POST-05: returns 403 Forbidden if user is a standard member (not org admin/owner)", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce(null); // Not admin or owner

      const res = await request(app)
        .post("/api/v1/workspaces")
        .send({ name: "Acme Web", slug: "acme-web" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Forbidden: You must be an organization admin");
    });
  });

  describe("PATCH /api/v1/workspaces/:id", () => {
    it("INT-WS-PATCH-01: successfully updates workspace fields by a Workspace Admin", async () => {
      // User is not Org Admin but is a Workspace Admin
      prismaMock.member.findFirst.mockResolvedValueOnce(null);
      prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({ id: "wm-1", role: "admin" });
      
      // Workspace exists in the organization
      prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-1", organizationId: "org-123" });
      
      const updatedWorkspace = createWorkspace({ id: "ws-1", name: "New Name", organizationId: "org-123" });
      prismaMock.workspace.update.mockResolvedValueOnce(updatedWorkspace);

      const res = await request(app)
        .patch("/api/v1/workspaces/ws-1")
        .send({ name: "New Name" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("New Name");
      expect(prismaMock.workspace.update).toHaveBeenCalledWith({
        where: { id: "ws-1" },
        data: { name: "New Name" },
      });
    });

    it("INT-WS-PATCH-02: returns 404 Not Found if workspace does not exist or isn't in active organization", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-1", role: "admin" });
      prismaMock.workspace.findFirst.mockResolvedValueOnce(null); // Workspace not found

      const res = await request(app)
        .patch("/api/v1/workspaces/ws-missing")
        .send({ name: "New Name" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Workspace not found");
    });
  });

  describe("DELETE /api/v1/workspaces/:id", () => {
    it("INT-WS-DEL-01: successfully deletes workspace by Org Owner/Admin", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-1", role: "owner" });
      prismaMock.workspace.findFirst.mockResolvedValueOnce({ id: "ws-1" });
      prismaMock.workspace.delete.mockResolvedValueOnce({ id: "ws-1" });

      const res = await request(app).delete("/api/v1/workspaces/ws-1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Workspace soft-deleted successfully");
      expect(prismaMock.workspace.delete).toHaveBeenCalledWith({ where: { id: "ws-1" } });
    });
  });

  describe("POST /api/v1/workspaces/:id/members (Add Members)", () => {
    it("INT-WS-MEM-POST-01: successfully adds valid org members to the workspace", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-1", role: "admin" });
      
      // Stub organization membership check: "user-1" and "user-2" are in the org
      prismaMock.member.findMany.mockResolvedValueOnce([
        { userId: "user-1" },
        { userId: "user-2" },
      ]);
      
      // Stub workspace member upsert
      prismaMock.workspaceMember.upsert.mockResolvedValue({ id: "new-wm" });

      const res = await request(app)
        .post("/api/v1/workspaces/ws-1/members")
        .send({ userIds: ["user-1", "user-2"] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Members added to workspace");
      expect(prismaMock.member.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-123",
          userId: { in: ["user-1", "user-2"] },
        },
      });
      expect(prismaMock.workspaceMember.upsert).toHaveBeenCalledTimes(2);
    });

    it("INT-WS-MEM-POST-02: returns 400 Bad Request if userIds parameter is missing or empty", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-1", role: "admin" });

      const res = await request(app)
        .post("/api/v1/workspaces/ws-1/members")
        .send({ userIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("User IDs are required");
    });

    it("INT-WS-MEM-POST-03: returns 400 Bad Request if one or more user IDs are not members of the organization", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-1", role: "admin" });
      
      // Only "user-1" is in the organization, "user-external" is not
      prismaMock.member.findMany.mockResolvedValueOnce([
        { userId: "user-1" },
      ]);

      const res = await request(app)
        .post("/api/v1/workspaces/ws-1/members")
        .send({ userIds: ["user-1", "user-external"] });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("One or more users are not members of this organization");
    });
  });

  describe("DELETE /api/v1/workspaces/:id/members/:userId (Remove Member)", () => {
    it("INT-WS-MEM-DEL-01: successfully removes workspace member", async () => {
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "mem-1", role: "admin" });
      prismaMock.workspaceMember.delete.mockResolvedValueOnce({ id: "deleted-wm" });

      const res = await request(app).delete("/api/v1/workspaces/ws-1/members/user-1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Member removed from workspace");
      expect(prismaMock.workspaceMember.delete).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: {
            workspaceId: "ws-1",
            userId: "user-1",
          },
        },
      });
    });
  });
});
