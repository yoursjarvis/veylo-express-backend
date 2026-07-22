import { describe, expect, it, vi, beforeEach } from "vitest";
import { checklistTemplateService } from "../../src/app/services/checklist-template.service";
import { prismaMock } from "../../tests/helpers/db";

const { taskExtrasRepositoryMock } = vi.hoisted(() => ({
  taskExtrasRepositoryMock: {
    findTaskById: vi.fn(),
    findStatusesByProjectId: vi.fn(),
    createSubtask: vi.fn(),
    createTaskActivity: vi.fn(),
  },
}));

const { taskRepositoryMock } = vi.hoisted(() => ({
  taskRepositoryMock: {
    incrementTaskSequence: vi.fn(),
  },
}));

vi.mock("@/app/repositories/task-extras.repository", () => ({
  taskExtrasRepository: taskExtrasRepositoryMock,
}));

vi.mock("@/app/repositories/task.repository", () => ({
  taskRepository: taskRepositoryMock,
}));

describe("ChecklistTemplateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTemplates", () => {
    it("returns all templates for a workspace", async () => {
      prismaMock.checklistTemplate.findMany.mockResolvedValueOnce([
        { id: "t-1", name: "Bug Template" },
      ] as unknown);

      const result = await checklistTemplateService.getTemplates("ws-1");
      expect(prismaMock.checklistTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: "ws-1" } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getTemplate", () => {
    it("throws NotFoundException if template not found", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce(null);
      await expect(
        checklistTemplateService.getTemplate("t-missing"),
      ).rejects.toThrow("Checklist template not found");
    });

    it("returns a template by ID", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce({
        id: "t-1",
        name: "Bug Template",
      } as unknown);
      const result = await checklistTemplateService.getTemplate("t-1");
      expect(result).toEqual({ id: "t-1", name: "Bug Template" });
    });
  });

  describe("createTemplate", () => {
    it("creates a checklist template", async () => {
      prismaMock.checklistTemplate.create.mockResolvedValueOnce({
        id: "t-1",
      } as unknown);

      const result = await checklistTemplateService.createTemplate({
        name: "Bug Template",
        items: ["Reproduce", "Fix", "Test"],
        workspaceId: "ws-1",
        organizationId: "org-1",
      });

      expect(prismaMock.checklistTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "Bug Template" }),
        }),
      );
      expect(result).toEqual({ id: "t-1" });
    });
  });

  describe("updateTemplate", () => {
    it("throws NotFoundException if template not found on update", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce(null);
      await expect(
        checklistTemplateService.updateTemplate("t-missing", {
          name: "New Name",
        }),
      ).rejects.toThrow("Checklist template not found");
    });

    it("updates template fields", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce({
        id: "t-1",
      } as unknown);
      prismaMock.checklistTemplate.update.mockResolvedValueOnce({
        id: "t-1",
        name: "Updated",
      } as unknown);

      const result = await checklistTemplateService.updateTemplate("t-1", {
        name: "Updated",
      });
      expect(prismaMock.checklistTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "t-1" },
          data: { name: "Updated" },
        }),
      );
      expect(result).toEqual({ id: "t-1", name: "Updated" });
    });
  });

  describe("deleteTemplate", () => {
    it("throws NotFoundException if template not found on delete", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce(null);
      await expect(
        checklistTemplateService.deleteTemplate("t-missing"),
      ).rejects.toThrow("Checklist template not found");
    });

    it("deletes template", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce({
        id: "t-1",
      } as unknown);
      prismaMock.checklistTemplate.delete.mockResolvedValueOnce({
        id: "t-1",
      } as unknown);
      await checklistTemplateService.deleteTemplate("t-1");
      expect(prismaMock.checklistTemplate.delete).toHaveBeenCalledWith({
        where: { id: "t-1" },
      });
    });
  });

  describe("applyTemplateToTask", () => {
    it("throws NotFoundException if template not found", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce(null);
      await expect(
        checklistTemplateService.applyTemplateToTask(
          "task-1",
          "t-missing",
          "user-1",
        ),
      ).rejects.toThrow("Checklist template not found");
    });

    it("throws NotFoundException if parent task not found", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce({
        id: "t-1",
        items: [],
      } as unknown);
      taskExtrasRepositoryMock.findTaskById.mockResolvedValueOnce(null);

      await expect(
        checklistTemplateService.applyTemplateToTask(
          "task-missing",
          "t-1",
          "user-1",
        ),
      ).rejects.toThrow("Parent task not found");
    });

    it("throws NotFoundException if no status found", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce({
        id: "t-1",
        items: ["Item 1"],
      } as unknown);
      taskExtrasRepositoryMock.findTaskById.mockResolvedValueOnce({
        id: "task-1",
        projectId: "proj-1",
        organizationId: "org-1",
      });
      taskExtrasRepositoryMock.findStatusesByProjectId.mockResolvedValueOnce(
        [],
      );

      await expect(
        checklistTemplateService.applyTemplateToTask("task-1", "t-1", "user-1"),
      ).rejects.toThrow("No status found for project");
    });

    it("creates subtasks from template items and uses todo status", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce({
        id: "t-1",
        items: ["Reproduce", "Fix"],
      } as unknown);
      taskExtrasRepositoryMock.findTaskById.mockResolvedValueOnce({
        id: "task-1",
        projectId: "proj-1",
        organizationId: "org-1",
      });
      taskExtrasRepositoryMock.findStatusesByProjectId.mockResolvedValueOnce([
        { id: "todo-1", category: "todo" },
        { id: "done-1", category: "done" },
      ]);
      taskRepositoryMock.incrementTaskSequence
        .mockResolvedValueOnce({ projectKey: "PROJ", taskSequence: 1 })
        .mockResolvedValueOnce({ projectKey: "PROJ", taskSequence: 2 });
      taskExtrasRepositoryMock.createSubtask
        .mockResolvedValueOnce({ id: "sub-1", title: "Reproduce" })
        .mockResolvedValueOnce({ id: "sub-2", title: "Fix" });
      taskExtrasRepositoryMock.createTaskActivity.mockResolvedValue(undefined);

      const result = await checklistTemplateService.applyTemplateToTask(
        "task-1",
        "t-1",
        "user-1",
      );

      expect(result).toHaveLength(2);
      expect(taskExtrasRepositoryMock.createSubtask).toHaveBeenCalledTimes(2);
      // Uses todo status (not first status)
      expect(taskExtrasRepositoryMock.createSubtask).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: "todo-1", title: "Reproduce" }),
      );
    });

    it("uses first status if no todo status found", async () => {
      prismaMock.checklistTemplate.findUnique.mockResolvedValueOnce({
        id: "t-1",
        items: ["Step 1"],
      } as unknown);
      taskExtrasRepositoryMock.findTaskById.mockResolvedValueOnce({
        id: "task-1",
        projectId: "proj-1",
        organizationId: "org-1",
      });
      taskExtrasRepositoryMock.findStatusesByProjectId.mockResolvedValueOnce([
        { id: "status-first", category: "backlog" }, // no "todo" category
      ]);
      taskRepositoryMock.incrementTaskSequence.mockResolvedValueOnce({
        projectKey: "PROJ",
        taskSequence: 3,
      });
      taskExtrasRepositoryMock.createSubtask.mockResolvedValueOnce({
        id: "sub-3",
        title: "Step 1",
      });
      taskExtrasRepositoryMock.createTaskActivity.mockResolvedValue(undefined);

      const result = await checklistTemplateService.applyTemplateToTask(
        "task-1",
        "t-1",
        "user-1",
      );

      expect(result).toHaveLength(1);
      expect(taskExtrasRepositoryMock.createSubtask).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: "status-first" }),
      );
    });
  });
});
