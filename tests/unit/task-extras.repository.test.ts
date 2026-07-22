import { describe, it, expect, vi } from "vitest";
import { taskExtrasRepository } from "@/app/repositories/task-extras.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("TaskExtrasRepository", () => {
  it("should find task by id", async () => {
    prismaMock.task.findUnique.mockResolvedValueOnce({ id: "task-1" });
    const result = await taskExtrasRepository.findTaskById("task-1");
    expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
      where: { id: "task-1" },
    });
    expect(result?.id).toBe("task-1");
  });

  // --- STATUS TESTS ---
  it("should find status by name and project id", async () => {
    prismaMock.taskStatus.findFirst.mockResolvedValueOnce({ id: "status-1" });
    const result = await taskExtrasRepository.findStatusByNameAndProjectId(
      "Todo",
      "proj-1",
    );
    expect(prismaMock.taskStatus.findFirst).toHaveBeenCalledWith({
      where: { projectId: "proj-1", name: "Todo" },
    });
    expect(result?.id).toBe("status-1");
  });

  it("should create status", async () => {
    const data = {
      name: "In Progress",
      category: "in_progress" as const,
      order: 1,
      projectId: "proj-1",
      organizationId: "org-1",
    };
    prismaMock.taskStatus.create.mockResolvedValueOnce({
      id: "status-1",
      ...data,
    });
    const result = await taskExtrasRepository.createStatus(data);
    expect(prismaMock.taskStatus.create).toHaveBeenCalledWith({ data });
    expect(result.id).toBe("status-1");
  });

  it("should find statuses by projectId", async () => {
    prismaMock.taskStatus.findMany.mockResolvedValueOnce([{ id: "status-1" }]);
    const result = await taskExtrasRepository.findStatusesByProjectId("proj-1");
    expect(prismaMock.taskStatus.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should find status by id", async () => {
    prismaMock.taskStatus.findUnique.mockResolvedValueOnce({ id: "status-1" });
    const result = await taskExtrasRepository.findStatusById("status-1");
    expect(result?.id).toBe("status-1");
  });

  it("should update status", async () => {
    prismaMock.taskStatus.update.mockResolvedValueOnce({
      id: "status-1",
      name: "New",
    });
    const result = await taskExtrasRepository.updateStatus("status-1", {
      name: "New",
    });
    expect(result.name).toBe("New");
  });

  it("should count tasks with status", async () => {
    prismaMock.task.count.mockResolvedValueOnce(5);
    const result = await taskExtrasRepository.countTasksWithStatus("status-1");
    expect(result).toBe(5);
  });

  it("should delete status", async () => {
    prismaMock.taskStatus.delete.mockResolvedValueOnce({ id: "status-1" });
    const result = await taskExtrasRepository.deleteStatus("status-1");
    expect(result.id).toBe("status-1");
  });

  it("should find status by id with trashed, restore, forceDelete", async () => {
    prismaMock.taskStatus.findUniqueWithTrashed.mockResolvedValueOnce({
      id: "status-1",
    });
    prismaMock.taskStatus.restore.mockResolvedValueOnce({ id: "status-1" });
    prismaMock.taskStatus.forceDelete.mockResolvedValueOnce({ id: "status-1" });

    expect(
      (await taskExtrasRepository.findStatusByIdWithTrashed("status-1"))?.id,
    ).toBe("status-1");
    expect((await taskExtrasRepository.restoreStatus("status-1")).id).toBe(
      "status-1",
    );
    expect((await taskExtrasRepository.forceDeleteStatus("status-1")).id).toBe(
      "status-1",
    );
  });

  // --- SUBTASKS TESTS ---
  it("should create subtask", async () => {
    const data = {
      title: "Subtask 1",
      taskKey: "TK-1-1",
      parentTaskId: "task-1",
      organizationId: "org-1",
      projectId: "proj-1",
      statusId: "status-1",
      creatorId: "user-1",
    };
    prismaMock.task.create.mockResolvedValueOnce({ id: "subtask-1" });
    const result = await taskExtrasRepository.createSubtask(data);
    expect(prismaMock.task.create).toHaveBeenCalled();
    expect(result.id).toBe("subtask-1");
  });

  it("should find, update, and delete subtask", async () => {
    prismaMock.task.findUnique.mockResolvedValueOnce({ id: "subtask-1" });
    prismaMock.task.update.mockResolvedValueOnce({
      id: "subtask-1",
      title: "Updated Sub",
    });
    prismaMock.task.delete.mockResolvedValueOnce({ id: "subtask-1" });

    expect((await taskExtrasRepository.findSubtaskById("subtask-1"))?.id).toBe(
      "subtask-1",
    );
    expect(
      (
        await taskExtrasRepository.updateSubtask("subtask-1", {
          title: "Updated Sub",
        })
      ).title,
    ).toBe("Updated Sub");
    expect((await taskExtrasRepository.deleteSubtask("subtask-1")).id).toBe(
      "subtask-1",
    );
  });

  // --- TASK ACTIVITY ---
  it("should create task activity", async () => {
    const data = {
      taskId: "task-1",
      userId: "user-1",
      organizationId: "org-1",
      action: "edit",
    };
    prismaMock.taskActivity.create.mockResolvedValueOnce({
      id: "act-1",
      ...data,
    });
    const result = await taskExtrasRepository.createTaskActivity(data);
    expect(prismaMock.taskActivity.create).toHaveBeenCalledWith({ data });
    expect(result.id).toBe("act-1");
  });

  // --- COMMENTS TESTS ---
  it("should create comment", async () => {
    const data = {
      content: "Hello",
      taskId: "task-1",
      userId: "user-1",
      organizationId: "org-1",
    };
    prismaMock.comment.create.mockResolvedValueOnce({ id: "c-1", ...data });
    const result = await taskExtrasRepository.createComment(data);
    expect(prismaMock.comment.create).toHaveBeenCalled();
    expect(result.id).toBe("c-1");
  });

  it("should find, delete comment, find with trashed, restore, forceDelete, and update comment", async () => {
    prismaMock.comment.findUnique.mockResolvedValueOnce({ id: "c-1" });
    prismaMock.comment.delete.mockResolvedValueOnce({ id: "c-1" });
    prismaMock.comment.findUniqueWithTrashed.mockResolvedValueOnce({
      id: "c-1",
    });
    prismaMock.comment.restore.mockResolvedValueOnce({ id: "c-1" });
    prismaMock.comment.forceDelete.mockResolvedValueOnce({ id: "c-1" });
    prismaMock.comment.update.mockResolvedValueOnce({
      id: "c-1",
      content: "New Content",
    });

    expect((await taskExtrasRepository.findCommentById("c-1"))?.id).toBe("c-1");
    expect((await taskExtrasRepository.deleteComment("c-1")).id).toBe("c-1");
    expect(
      (await taskExtrasRepository.findCommentByIdWithTrashed("c-1"))?.id,
    ).toBe("c-1");
    expect((await taskExtrasRepository.restoreComment("c-1")).id).toBe("c-1");
    expect((await taskExtrasRepository.forceDeleteComment("c-1")).id).toBe(
      "c-1",
    );
    expect(
      (await taskExtrasRepository.updateComment("c-1", "New Content")).content,
    ).toBe("New Content");
  });

  // --- ORG / WORKSPACE MEMBERSHIP ---
  it("should find org member and workspace member", async () => {
    prismaMock.member.findFirst.mockResolvedValueOnce({ id: "m-1" });
    prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({ id: "wm-1" });

    expect(
      (await taskExtrasRepository.findOrgMember("org-1", "user-1"))?.id,
    ).toBe("m-1");
    expect(
      (await taskExtrasRepository.findWorkspaceMember("ws-1", "user-1"))?.id,
    ).toBe("wm-1");
  });

  // --- CUSTOM FIELDS TESTS ---
  it("should find custom field by name, create, find many, find by id, delete, find with trashed, restore, and forceDelete", async () => {
    prismaMock.customFieldDefinition.findFirst.mockResolvedValueOnce({
      id: "cf-1",
    });
    prismaMock.customFieldDefinition.create.mockResolvedValueOnce({
      id: "cf-1",
    });
    prismaMock.customFieldDefinition.findMany.mockResolvedValueOnce([
      { id: "cf-1" },
    ]);
    prismaMock.customFieldDefinition.findUnique.mockResolvedValueOnce({
      id: "cf-1",
    });
    prismaMock.customFieldDefinition.delete.mockResolvedValueOnce({
      id: "cf-1",
    });
    prismaMock.customFieldDefinition.findUniqueWithTrashed.mockResolvedValueOnce(
      { id: "cf-1" },
    );
    prismaMock.customFieldDefinition.restore.mockResolvedValueOnce({
      id: "cf-1",
    });
    prismaMock.customFieldDefinition.forceDelete.mockResolvedValueOnce({
      id: "cf-1",
    });

    expect(
      (await taskExtrasRepository.findCustomFieldByName("CF", "proj-1"))?.id,
    ).toBe("cf-1");
    expect(
      (
        await taskExtrasRepository.createCustomField({
          name: "CF",
          type: "text",
          projectId: "proj-1",
          organizationId: "org-1",
        })
      ).id,
    ).toBe("cf-1");
    expect(
      await taskExtrasRepository.findCustomFieldsByProjectId("proj-1"),
    ).toHaveLength(1);
    expect((await taskExtrasRepository.findCustomFieldById("cf-1"))?.id).toBe(
      "cf-1",
    );
    expect((await taskExtrasRepository.deleteCustomField("cf-1")).id).toBe(
      "cf-1",
    );
    expect(
      (await taskExtrasRepository.findCustomFieldByIdWithTrashed("cf-1"))?.id,
    ).toBe("cf-1");
    expect((await taskExtrasRepository.restoreCustomField("cf-1")).id).toBe(
      "cf-1",
    );
    expect((await taskExtrasRepository.forceDeleteCustomField("cf-1")).id).toBe(
      "cf-1",
    );
  });

  // --- REACTIONS TESTS ---
  it("should find comment reactions", async () => {
    prismaMock.commentReaction.findMany.mockResolvedValueOnce([{ id: "r-1" }]);
    const result = await taskExtrasRepository.findCommentReactions(
      "c-1",
      "smile",
    );
    expect(result).toHaveLength(1);
  });

  it("should find specific comment reaction", async () => {
    prismaMock.comment.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    prismaMock.commentReaction.findUnique.mockResolvedValueOnce({ id: "r-1" });

    const result = await taskExtrasRepository.findCommentReaction(
      "c-1",
      "user-1",
      "smile",
    );
    expect(result?.id).toBe("r-1");
  });

  it("should return null for specific comment reaction if comment not found", async () => {
    prismaMock.comment.findUnique.mockResolvedValueOnce(null);
    const result = await taskExtrasRepository.findCommentReaction(
      "c-1",
      "user-1",
      "smile",
    );
    expect(result).toBeNull();
  });

  it("should delete comment reaction", async () => {
    prismaMock.commentReaction.delete.mockResolvedValueOnce({ id: "r-1" });
    const result = await taskExtrasRepository.deleteCommentReaction("r-1");
    expect(result.id).toBe("r-1");
  });

  it("should create comment reaction if comment exists", async () => {
    prismaMock.comment.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    prismaMock.commentReaction.create.mockResolvedValueOnce({ id: "r-1" });

    const result = await taskExtrasRepository.createCommentReaction(
      "c-1",
      "user-1",
      "smile",
    );
    expect(result.id).toBe("r-1");
  });

  it("should throw error when creating comment reaction if comment not found", async () => {
    prismaMock.comment.findUnique.mockResolvedValueOnce(null);

    await expect(
      taskExtrasRepository.createCommentReaction("c-1", "user-1", "smile"),
    ).rejects.toThrow("Comment not found");
  });
});
