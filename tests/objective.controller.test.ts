import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockObjectiveService, mockRbacService } = vi.hoisted(() => ({
  mockObjectiveService: {
    getObjectives: vi.fn(),
    createObjective: vi.fn(),
    deleteObjective: vi.fn(),
    restoreObjective: vi.fn(),
    forceDeleteObjective: vi.fn(),
    updateObjective: vi.fn(),
  },
  mockRbacService: {
    authorize: vi.fn(),
  },
}));

vi.mock("../src/app/services/objective.service", () => ({
  objectiveService: mockObjectiveService,
}));

vi.mock("../src/app/services/rbac.service", () => ({
  rbacService: mockRbacService,
}));

vi.mock("../src/lib/auth/auth", async () => {
  const { getSessionMock } = await import("./helpers/auth");
  return {
    auth: {
      api: {
        getSession: getSessionMock,
      },
    },
  };
});

import { objectiveController } from "../src/app/http/controllers/objective.controller";
import { prismaMock } from "./helpers/db";
import { setMockUser } from "./helpers/auth";
import { createUser } from "./helpers/factories";

function createRes() {
  const res: unknown = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("objectiveController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(createUser({ id: "user-123", email: "user@example.com" }));
  });

  describe("getObjectives", () => {
    it("throws NotFoundException if workspace not found", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      const req: unknown = { params: { workspaceId: "ws-1" } };
      const res = createRes();

      await expect(
        (objectiveController.getObjectives as unknown)(req, res)
      ).rejects.toThrow("Workspace not found");
    });

    it("throws ForbiddenException if not authorized", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce({ id: "ws-1", organizationId: "org-1" });
      mockRbacService.authorize.mockResolvedValueOnce(false);

      const req: unknown = { params: { workspaceId: "ws-1" } };
      const res = createRes();

      await expect(
        (objectiveController.getObjectives as unknown)(req, res)
      ).rejects.toThrow("Forbidden: You do not have permission to view objectives.");
    });

    it("fetches objectives successfully if allowed", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce({ id: "ws-1", organizationId: "org-1" });
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockObjectiveService.getObjectives.mockResolvedValueOnce([{ id: "o1" }]);

      const req: unknown = { params: { workspaceId: "ws-1" }, query: {} };
      const res = createRes();

      await (objectiveController.getObjectives as unknown)(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: [{ id: "o1" }],
      }));
    });
  });

  describe("createObjective", () => {
    it("creates objective successfully", async () => {
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: "550e8400-e29b-41d4-a716-446655440001",
        workspaceId: "ws-1",
        organizationId: "org-1",
      });
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockObjectiveService.createObjective.mockResolvedValueOnce({ id: "o1" });

      const req: unknown = {
        body: {
          title: "Test",
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          krTitle: "KR Title",
          krTarget: "KR Target",
        },
      };
      const res = createRes();

      await (objectiveController.createObjective as unknown)(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { id: "o1" },
      }));
    });
  });

  describe("delete, restore & forceDelete objective", () => {
    it("deletes objective successfully", async () => {
      prismaMock.objective.findFirstWithTrashed.mockResolvedValueOnce({
        id: "o1",
        projectId: "p1",
        project: { organizationId: "org-1", workspaceId: "ws-1" },
      });
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockObjectiveService.deleteObjective.mockResolvedValueOnce(undefined);

      const req: unknown = { params: { id: "o1" } };
      const res = createRes();

      await (objectiveController.deleteObjective as unknown)(req, res);

      expect(mockObjectiveService.deleteObjective).toHaveBeenCalledWith("o1");
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("restores objective successfully", async () => {
      prismaMock.objective.findFirstWithTrashed.mockResolvedValueOnce({
        id: "o1",
        projectId: "p1",
        project: { organizationId: "org-1", workspaceId: "ws-1" },
      });
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockObjectiveService.restoreObjective.mockResolvedValueOnce(undefined);

      const req: unknown = { params: { id: "o1" } };
      const res = createRes();

      await (objectiveController.restoreObjective as unknown)(req, res);

      expect(mockObjectiveService.restoreObjective).toHaveBeenCalledWith("o1");
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("permanently deletes objective successfully", async () => {
      prismaMock.objective.findFirstWithTrashed.mockResolvedValueOnce({
        id: "o1",
        projectId: "p1",
        project: { organizationId: "org-1", workspaceId: "ws-1" },
      });
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockObjectiveService.forceDeleteObjective.mockResolvedValueOnce(undefined);

      const req: unknown = { params: { id: "o1" } };
      const res = createRes();

      await (objectiveController.forceDeleteObjective as unknown)(req, res);

      expect(mockObjectiveService.forceDeleteObjective).toHaveBeenCalledWith("o1");
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("updates objective successfully", async () => {
      prismaMock.objective.findFirstWithTrashed.mockResolvedValueOnce({
        id: "o1",
        projectId: "p1",
        project: { organizationId: "org-1", workspaceId: "ws-1" },
      });
      mockRbacService.authorize.mockResolvedValueOnce(true);
      mockObjectiveService.updateObjective.mockResolvedValueOnce({ id: "o1", title: "New Title" });

      const req: unknown = {
        params: { id: "o1" },
        body: { title: "New Title" },
      };
      const res = createRes();

      await (objectiveController.updateObjective as unknown)(req, res);

      expect(mockObjectiveService.updateObjective).toHaveBeenCalledWith("o1", "org-123", { title: "New Title" });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
