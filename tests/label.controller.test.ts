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
    label: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock, basePrisma: prismaMock }));

import { labelController } from "../src/app/http/controllers/label.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("labelController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLabel", () => {
    it("creates label successfully", async () => {
      prismaMock.label.findUnique.mockResolvedValueOnce(null);
      const label = { id: "l1", name: "Bug", color: "#FF0000", projectId: "p1", organizationId: "org-123" };
      prismaMock.label.create.mockResolvedValueOnce(label);

      const req: any = {
        params: { projectId: "p1" },
        body: { name: "Bug", color: "#FF0000" }
      };
      const res = createRes();

      await (labelController.createLabel as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(prismaMock.label.create).toHaveBeenCalledWith({
        data: {
          name: "Bug",
          color: "#FF0000",
          projectId: "p1",
          organizationId: "org-123",
        }
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Label created successfully",
        data: label,
      });
    });

    it("throws BadRequestException if label already exists", async () => {
      prismaMock.label.findUnique.mockResolvedValueOnce({ id: "l1" });

      const req: any = {
        params: { projectId: "p1" },
        body: { name: "Bug", color: "#FF0000" }
      };
      const res = createRes();

      await expect((labelController.createLabel as any)(req, res)).rejects.toThrow(
        "Label with this name already exists in the project"
      );
    });
  });

  describe("getLabels", () => {
    it("fetches labels successfully", async () => {
      const labels = [{ id: "l1", name: "Bug" }];
      prismaMock.label.findMany.mockResolvedValueOnce(labels);

      const req: any = { params: { projectId: "p1" } };
      const res = createRes();

      await (labelController.getLabels as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Labels fetched successfully",
        data: labels,
      });
    });
  });

  describe("updateLabel", () => {
    it("updates label successfully", async () => {
      const label = { id: "l1", projectId: "p1" };
      prismaMock.label.findUnique.mockResolvedValueOnce(label);
      prismaMock.label.findFirst.mockResolvedValueOnce(null);
      const updatedLabel = { id: "l1", name: "NewBug" };
      prismaMock.label.update.mockResolvedValueOnce(updatedLabel);

      const req: any = {
        params: { id: "l1" },
        body: { name: "NewBug" }
      };
      const res = createRes();

      await (labelController.updateLabel as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(prismaMock.label.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { name: "NewBug" },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Label updated successfully",
        data: updatedLabel,
      });
    });

    it("throws NotFoundException if label not found", async () => {
      prismaMock.label.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "l1" }, body: { name: "Bug" } };
      const res = createRes();

      await expect((labelController.updateLabel as any)(req, res)).rejects.toThrow("Label not found");
    });

    it("throws BadRequestException if name conflict exists", async () => {
      const label = { id: "l1", projectId: "p1" };
      prismaMock.label.findUnique.mockResolvedValueOnce(label);
      prismaMock.label.findFirst.mockResolvedValueOnce({ id: "l2" });

      const req: any = { params: { id: "l1" }, body: { name: "Bug" } };
      const res = createRes();

      await expect((labelController.updateLabel as any)(req, res)).rejects.toThrow(
        "Label with this name already exists in the project"
      );
    });
  });

  describe("deleteLabel", () => {
    it("deletes label successfully", async () => {
      const label = { id: "l1", projectId: "p1" };
      prismaMock.label.findUnique.mockResolvedValueOnce(label);

      const req: any = { params: { id: "l1" } };
      const res = createRes();

      await (labelController.deleteLabel as any)(req, res);

      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(req, "p1");
      expect(prismaMock.label.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Label deleted successfully",
        data: {},
      });
    });

    it("throws NotFoundException if label not found", async () => {
      prismaMock.label.findUnique.mockResolvedValueOnce(null);

      const req: any = { params: { id: "l1" } };
      const res = createRes();

      await expect((labelController.deleteLabel as any)(req, res)).rejects.toThrow("Label not found");
    });
  });
});
