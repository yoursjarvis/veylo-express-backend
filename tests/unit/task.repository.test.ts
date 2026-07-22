import { describe, it, expect, vi } from "vitest";
import { taskRepository } from "@/app/repositories/task.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("TaskRepository", () => {
  it("should find task by id, details, and relations", async () => {
    prismaMock.task.findUnique.mockResolvedValue({ id: "task-1" });

    expect(await taskRepository.findTaskById("task-1")).toEqual({
      id: "task-1",
    });
    expect(await taskRepository.findTaskDetails("task-1")).toEqual({
      id: "task-1",
    });
    expect(await taskRepository.findTaskWithRelations("task-1")).toEqual({
      id: "task-1",
    });
  });

  it("should find task status, sprint, epic, and milestone by id and project id", async () => {
    prismaMock.taskStatus.findFirst.mockResolvedValueOnce({ id: "status-1" });
    prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: "sprint-1" });
    prismaMock.epic.findFirst.mockResolvedValueOnce({ id: "epic-1" });
    prismaMock.milestone.findFirst.mockResolvedValueOnce({ id: "milestone-1" });

    expect(
      await taskRepository.findTaskStatusById("status-1", "proj-1"),
    ).toEqual({ id: "status-1" });
    expect(await taskRepository.findSprintById("sprint-1", "proj-1")).toEqual({
      id: "sprint-1",
    });
    expect(await taskRepository.findEpicById("epic-1", "proj-1")).toEqual({
      id: "epic-1",
    });
    expect(
      await taskRepository.findMilestoneById("milestone-1", "proj-1"),
    ).toEqual({ id: "milestone-1" });
  });

  it("should increment task sequence in project", async () => {
    prismaMock.project.update.mockResolvedValueOnce({
      projectKey: "PROJ",
      taskSequence: 10,
    });
    const result = await taskRepository.incrementTaskSequence("proj-1");
    expect(prismaMock.project.update).toHaveBeenCalled();
    expect(result.taskSequence).toBe(10);
  });

  it("should create and update tasks", async () => {
    const createData = {
      title: "New Task",
      projectId: "proj-1",
      creatorId: "user-1",
      statusId: "status-1",
    };
    prismaMock.task.create.mockResolvedValueOnce({
      id: "task-1",
      ...createData,
    });
    prismaMock.task.update.mockResolvedValueOnce({
      id: "task-1",
      title: "Updated Title",
    });

    const created = await taskRepository.createTask(createData);
    expect(created.id).toBe("task-1");

    const updated = await taskRepository.updateTask("task-1", {
      title: "Updated Title",
    });
    expect(updated.title).toBe("Updated Title");
  });

  it("should get tasks", async () => {
    prismaMock.task.findMany.mockResolvedValueOnce([{ id: "task-1" }]);
    const result = await taskRepository.getTasks({ projectId: "proj-1" });
    expect(prismaMock.task.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should count incomplete subtasks", async () => {
    prismaMock.task.count.mockResolvedValueOnce(2);
    const result = await taskRepository.countIncompleteSubtasks("task-1");
    expect(result).toBe(2);
  });

  it("should complete all subtasks if doneStatus exists", async () => {
    prismaMock.taskStatus.findFirst.mockResolvedValueOnce({
      id: "done-status-id",
    });
    prismaMock.task.updateMany.mockResolvedValueOnce({ count: 3 });

    const result = await taskRepository.completeAllSubtasks("task-1", "proj-1");
    expect(prismaMock.taskStatus.findFirst).toHaveBeenCalledWith({
      where: { projectId: "proj-1", category: "done" },
    });
    expect(prismaMock.task.updateMany).toHaveBeenCalled();
    expect(result.count).toBe(3);
  });

  it("should return count 0 if doneStatus does not exist when completing all subtasks", async () => {
    prismaMock.taskStatus.findFirst.mockResolvedValueOnce(null);
    const result = await taskRepository.completeAllSubtasks("task-1", "proj-1");
    expect(result.count).toBe(0);
  });

  it("should find user, project, member, and workspaceMember by id", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-1" });
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: "proj-1" });
    prismaMock.member.findFirst.mockResolvedValueOnce({ id: "member-1" });
    prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({ id: "wsm-1" });

    expect(await taskRepository.findUserById("user-1")).toEqual({
      id: "user-1",
    });
    expect(await taskRepository.findProjectById("proj-1")).toEqual({
      id: "proj-1",
    });
    expect(await taskRepository.findMember("org-1", "user-1")).toEqual({
      id: "member-1",
    });
    expect(await taskRepository.findWorkspaceMember("ws-1", "user-1")).toEqual({
      id: "wsm-1",
    });
  });

  it("should delete, find with trashed, restore, forceDelete, and create task activity", async () => {
    prismaMock.task.delete.mockResolvedValueOnce({ id: "task-1" });
    prismaMock.task.findUniqueWithTrashed.mockResolvedValueOnce({
      id: "task-1",
    });
    prismaMock.task.restore.mockResolvedValueOnce({ id: "task-1" });
    prismaMock.task.forceDelete.mockResolvedValueOnce({ id: "task-1" });
    prismaMock.taskActivity.create.mockResolvedValueOnce({ id: "act-1" });

    expect(await taskRepository.deleteTask("task-1")).toEqual({ id: "task-1" });
    expect(await taskRepository.findTaskByIdWithTrashed("task-1")).toEqual({
      id: "task-1",
    });
    expect(await taskRepository.restoreTask("task-1")).toEqual({
      id: "task-1",
    });
    expect(await taskRepository.forceDeleteTask("task-1")).toEqual({
      id: "task-1",
    });
    expect(
      await taskRepository.createTaskActivity({
        taskId: "task-1",
        userId: "user-1",
        organizationId: "org-1",
        action: "update",
        oldValue: "old",
        newValue: "new",
      }),
    ).toEqual({ id: "act-1" });
  });
});
