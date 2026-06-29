import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockVerifyProjectAccess, prismaMock } = vi.hoisted(() => ({
  mockVerifyProjectAccess: vi.fn().mockResolvedValue({
    project: { organizationId: "org-123" }
  }),
  prismaMock: {
    epic: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock, basePrisma: prismaMock }));

import { epicController } from "../src/app/http/controllers/epic.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("epicController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEpic", () => {
    it("creates epic successfully", async () => {
      const epic = { id: "e1", title: "Epic 1", projectId: "p1", organizationId: "org-123" };
      prismaMock.epic.create.mockResolvedValueOnce(epic);

      const req: any = {
        params: { projectId: "p1" },
        body: { title: "Epic 1", description: "Desc", color: "#FFFFFF", startDate: "2026-06-25T02:00:00.000Z" }
      };
      const res = createRes();

      await (epicController.createEpic as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(prismaMock.epic.create).toHaveBeenCalledWith({
        data: {
          title: "Epic 1",
          description: "Desc",
          color: "#FFFFFF",
          projectId: "p1",
          organizationId: "org-123",
          startDate: expect.any(Date),
          endDate: null,
          status: "open",
        }
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Epic created successfully",
        data: epic,
      });
    });
  });

  describe("getEpics", () => {
    it("fetches epics successfully", async () => {
      const epics = [{ id: "e1", title: "Epic 1" }];
      prismaMock.epic.findMany.mockResolvedValueOnce(epics);

      const req: any = { params: { projectId: "p1" } };
      const res = createRes();

      await (epicController.getEpics as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Epics fetched successfully",
        data: epics,
      });
    });
  });

  describe("getEpic", () => {
    it("fetches epic details successfully", async () => {
      const epic = { id: "e1", title: "Epic 1", projectId: "p1" };
      prismaMock.epic.findUnique.mockResolvedValueOnce(epic);

      const req: any = { params: { id: "e1" } };
      const res = createRes();

      await (epicController.getEpic as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Epic details fetched successfully",
        data: epic,
      });
    });

    it("throws NotFoundException if epic not found", async () => {
      prismaMock.epic.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "e1" } };
      const res = createRes();

      await expect((epicController.getEpic as any)(req, res)).rejects.toThrow("Epic not found");
    });
  });

  describe("updateEpic", () => {
    it("updates epic successfully", async () => {
      const epic = { id: "e1", projectId: "p1" };
      prismaMock.epic.findUnique.mockResolvedValueOnce(epic);
      const updatedEpic = { id: "e1", title: "Updated" };
      prismaMock.epic.update.mockResolvedValueOnce(updatedEpic);

      const req: any = {
        params: { id: "e1" },
        body: { title: "Updated", status: "in_progress" }
      };
      const res = createRes();

      await (epicController.updateEpic as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(prismaMock.epic.update).toHaveBeenCalledWith({
        where: { id: "e1" },
        data: { title: "Updated", status: "in_progress" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Epic updated successfully",
        data: updatedEpic,
      });
    });

    it("throws NotFoundException if epic not found", async () => {
      prismaMock.epic.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "e1" }, body: { title: "Updated" } };
      const res = createRes();

      await expect((epicController.updateEpic as any)(req, res)).rejects.toThrow("Epic not found");
    });
  });

  describe("deleteEpic", () => {
    it("deletes epic successfully", async () => {
      const epic = { id: "e1", projectId: "p1" };
      prismaMock.epic.findUnique.mockResolvedValueOnce(epic);

      const req: any = { params: { id: "e1" } };
      const res = createRes();

      await (epicController.deleteEpic as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(prismaMock.epic.delete).toHaveBeenCalledWith({ where: { id: "e1" } });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Epic deleted successfully",
        data: {},
      });
    });

    it("throws NotFoundException if epic not found", async () => {
      prismaMock.epic.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "e1" } };
      const res = createRes();

      await expect((epicController.deleteEpic as any)(req, res)).rejects.toThrow("Epic not found");
    });
  });
});
