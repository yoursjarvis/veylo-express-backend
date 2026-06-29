import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockVerifyProjectAccess, prismaMock, mockNotificationService } = vi.hoisted(() => ({
  mockVerifyProjectAccess: vi.fn().mockResolvedValue({
    userId: "user-123",
    activeOrgId: "org-123",
    project: { organizationId: "org-123" }
  }),
  prismaMock: {
    taskStatus: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    project: {
      update: vi.fn().mockResolvedValue({ taskSequence: 2 }),
    },
    subtask: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    taskActivity: {
      create: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
    },
    workspaceMember: {
      findFirst: vi.fn(),
    },
    customFieldDefinition: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    commentReaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
  },
  mockNotificationService: {
    handleCommentAdded: vi.fn(),
    handleCommentReaction: vi.fn(),
    handleAddedToProject: vi.fn(),
    handleTaskCreated: vi.fn(),
    handleTaskUpdated: vi.fn(),
  },
}));

vi.mock("../src/app/http/middlewares/project-access.middleware", () => ({
  verifyProjectAccess: mockVerifyProjectAccess,
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock, basePrisma: prismaMock }));
vi.mock("../src/app/services/notification.service", () => ({
  notificationService: mockNotificationService,
}));

import { taskExtrasController } from "../src/app/http/controllers/task-extras.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("taskExtrasController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createStatus", () => {
    it("creates status successfully", async () => {
      prismaMock.taskStatus.findFirst.mockResolvedValueOnce(null);
      const mockStatus = { id: "s1", name: "Backlog" };
      prismaMock.taskStatus.create.mockResolvedValueOnce(mockStatus);

      const req: any = { params: { projectId: "p1" }, body: { name: "Backlog", category: "backlog" } };
      const res = createRes();

      await (taskExtrasController.createStatus as any)(req, res);

      expect(prismaMock.taskStatus.create).toHaveBeenCalled();
    });

    it("throws BadRequestException if status already exists", async () => {
      prismaMock.taskStatus.findFirst.mockResolvedValueOnce({ id: "s1" });

      const req: any = { params: { projectId: "p1" }, body: { name: "Backlog", category: "backlog" } };
      const res = createRes();

      await expect((taskExtrasController.createStatus as any)(req, res)).rejects.toThrow(
        "Status name already exists in this project"
      );
    });
  });

  describe("deleteStatus", () => {
    it("deletes status if no active tasks map to it", async () => {
      prismaMock.taskStatus.findUnique.mockResolvedValueOnce({ id: "s1", projectId: "p1" });
      prismaMock.task.count.mockResolvedValueOnce(0);

      const req: any = { params: { id: "s1" } };
      const res = createRes();

      await (taskExtrasController.deleteStatus as any)(req, res);

      expect(prismaMock.taskStatus.delete).toHaveBeenCalled();
    });

    it("throws BadRequestException if active tasks exist", async () => {
      prismaMock.taskStatus.findUnique.mockResolvedValueOnce({ id: "s1", projectId: "p1" });
      prismaMock.task.count.mockResolvedValueOnce(3);

      const req: any = { params: { id: "s1" } };
      const res = createRes();

      await expect((taskExtrasController.deleteStatus as any)(req, res)).rejects.toThrow(
        "Cannot delete status: active tasks are currently mapped to this column"
      );
    });
  });

  describe("subtasks", () => {
    it("creates subtask and logs activity", async () => {
      prismaMock.task.findUnique.mockResolvedValue({ id: "t1", projectId: "p1" });
      prismaMock.taskStatus.findMany.mockResolvedValueOnce([{ id: "status-1", category: "todo" }]);
      prismaMock.task.create.mockResolvedValueOnce({ id: "sub1", title: "Subtask 1" });

      const req: any = { params: { taskId: "t1" }, body: { title: "Subtask 1" } };
      const res = createRes();

      await (taskExtrasController.createSubtask as any)(req, res);

      expect(prismaMock.task.create).toHaveBeenCalled();
      expect(prismaMock.taskActivity.create).toHaveBeenCalled();
    });

    it("updates subtask and audits completion change", async () => {
      const existing = { id: "sub1", title: "Subtask 1", taskId: "t1", statusId: "550e8400-e29b-41d4-a716-446655440001", organizationId: "org-123", parentTask: { projectId: "p1" } };
      prismaMock.task.findUnique.mockResolvedValue(existing);
      prismaMock.task.update.mockResolvedValueOnce({ id: "sub1", statusId: "550e8400-e29b-41d4-a716-446655440002" });

      const req: any = { params: { id: "sub1" }, body: { statusId: "550e8400-e29b-41d4-a716-446655440002" } };
      const res = createRes();

      await (taskExtrasController.updateSubtask as any)(req, res);

      expect(prismaMock.task.update).toHaveBeenCalled();
      expect(prismaMock.taskActivity.create).toHaveBeenCalled();
    });
  });

  describe("comments", () => {
    it("creates comment and triggers notification", async () => {
      prismaMock.task.findUnique.mockResolvedValueOnce({ id: "t1", projectId: "p1" });
      prismaMock.comment.create.mockResolvedValueOnce({ id: "c1", content: "hello" });

      const req: any = { params: { taskId: "t1" }, body: { content: "hello" } };
      const res = createRes();

      await (taskExtrasController.createComment as any)(req, res);

      expect(prismaMock.comment.create).toHaveBeenCalled();
      expect(mockNotificationService.handleCommentAdded).toHaveBeenCalled();
    });

    it("deletes comment if author", async () => {
      const comment = { id: "c1", userId: "user-123", task: { projectId: "p1" } };
      prismaMock.comment.findUnique.mockResolvedValueOnce(comment);

      const req: any = { params: { id: "c1" } };
      const res = createRes();

      await (taskExtrasController.deleteComment as any)(req, res);

      expect(prismaMock.comment.delete).toHaveBeenCalled();
    });

    it("deletes comment if admin and not author", async () => {
      const comment = { id: "c1", userId: "user-other", task: { projectId: "p1" } };
      prismaMock.comment.findUnique.mockResolvedValueOnce(comment);
      prismaMock.member.findFirst.mockResolvedValueOnce({ id: "m1", role: "admin" });

      const req: any = { params: { id: "c1" } };
      const res = createRes();

      await (taskExtrasController.deleteComment as any)(req, res);

      expect(prismaMock.comment.delete).toHaveBeenCalled();
    });
  });

  describe("custom fields", () => {
    it("creates custom field definition successfully", async () => {
      prismaMock.customFieldDefinition.findFirst.mockResolvedValueOnce(null);
      prismaMock.customFieldDefinition.create.mockResolvedValueOnce({ id: "cf-1" });

      const req: any = { params: { projectId: "p1" }, body: { name: "Severity", type: "select", options: ["High", "Low"] } };
      const res = createRes();

      await (taskExtrasController.createCustomField as any)(req, res);

      expect(prismaMock.customFieldDefinition.create).toHaveBeenCalled();
    });
  });

  describe("comment reactions", () => {
    it("toggles reaction on", async () => {
      prismaMock.comment.findUnique.mockResolvedValueOnce({ id: "c1", task: { projectId: "p1" } });
      prismaMock.commentReaction.findUnique.mockResolvedValueOnce(null);
      prismaMock.commentReaction.create.mockResolvedValueOnce({ id: "r1" });

      const req: any = { params: { commentId: "c1" }, body: { emoji: "👍" } };
      const res = createRes();

      await (taskExtrasController.toggleCommentReaction as any)(req, res);

      expect(prismaMock.commentReaction.create).toHaveBeenCalled();
    });

    it("toggles reaction off if already exists", async () => {
      prismaMock.comment.findUnique.mockResolvedValueOnce({ id: "c1", task: { projectId: "p1" } });
      prismaMock.commentReaction.findUnique.mockResolvedValueOnce({ id: "r1" });

      const req: any = { params: { commentId: "c1" }, body: { emoji: "👍" } };
      const res = createRes();

      await (taskExtrasController.toggleCommentReaction as any)(req, res);

      expect(prismaMock.commentReaction.delete).toHaveBeenCalled();
    });
  });
});
