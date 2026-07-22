import { describe, it, expect, vi } from "vitest";
import { sprintRepository } from "@/app/repositories/sprint.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("SprintRepository", () => {
  it("should create a sprint", async () => {
    const data = {
      name: "Sprint 1",
      projectId: "proj-1",
      organizationId: "org-1",
      status: "future",
    };
    prismaMock.sprint.create.mockResolvedValueOnce({ id: "sprint-1", ...data });
    const result = await sprintRepository.create(data);
    expect(prismaMock.sprint.create).toHaveBeenCalledWith({ data });
    expect(result.id).toBe("sprint-1");
  });

  it("should find sprints by projectId", async () => {
    prismaMock.sprint.findMany.mockResolvedValueOnce([{ id: "sprint-1" }]);
    const result = await sprintRepository.findByProjectId("proj-1");
    expect(prismaMock.sprint.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should find sprint by id", async () => {
    prismaMock.sprint.findUnique.mockResolvedValueOnce({ id: "sprint-1" });
    const result = await sprintRepository.findById("sprint-1");
    expect(prismaMock.sprint.findUnique).toHaveBeenCalledWith({
      where: { id: "sprint-1" },
    });
    expect(result?.id).toBe("sprint-1");
  });

  it("should find sprint by id with tasks", async () => {
    prismaMock.sprint.findUnique.mockResolvedValueOnce({
      id: "sprint-1",
      tasks: [],
    });
    const result = await sprintRepository.findByIdWithTasks("sprint-1");
    expect(prismaMock.sprint.findUnique).toHaveBeenCalled();
    expect(result?.id).toBe("sprint-1");
  });

  it("should find first active sprint by projectId", async () => {
    prismaMock.sprint.findFirst.mockResolvedValueOnce({
      id: "sprint-1",
      status: "active",
    });
    const result = await sprintRepository.findFirstActiveByProjectId("proj-1");
    expect(prismaMock.sprint.findFirst).toHaveBeenCalledWith({
      where: { projectId: "proj-1", status: "active" },
    });
    expect(result?.id).toBe("sprint-1");
  });

  it("should find sprint in project", async () => {
    prismaMock.sprint.findFirst.mockResolvedValueOnce({
      id: "sprint-1",
      projectId: "proj-1",
    });
    const result = await sprintRepository.findSprintInProject(
      "sprint-1",
      "proj-1",
    );
    expect(prismaMock.sprint.findFirst).toHaveBeenCalledWith({
      where: { id: "sprint-1", projectId: "proj-1" },
    });
    expect(result?.id).toBe("sprint-1");
  });

  it("should find uncompleted tasks in sprint", async () => {
    prismaMock.task.findMany.mockResolvedValueOnce([{ id: "task-1" }]);
    const result =
      await sprintRepository.findUncompletedTasksInSprint("sprint-1");
    expect(prismaMock.task.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should update tasks sprint", async () => {
    prismaMock.task.updateMany.mockResolvedValueOnce({ count: 2 });
    const result = await sprintRepository.updateTasksSprint(
      ["task-1", "task-2"],
      "sprint-2",
    );
    expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["task-1", "task-2"] } },
      data: { sprintId: "sprint-2" },
    });
    expect(result.count).toBe(2);
  });

  it("should create task activities", async () => {
    prismaMock.taskActivity.createMany.mockResolvedValueOnce({ count: 1 });
    const payloads = [
      {
        taskId: "task-1",
        userId: "user-1",
        organizationId: "org-1",
        action: "update",
      },
    ];
    const result = await sprintRepository.createTaskActivities(payloads);
    expect(prismaMock.taskActivity.createMany).toHaveBeenCalledWith({
      data: payloads,
    });
    expect(result.count).toBe(1);
  });

  it("should update sprint", async () => {
    prismaMock.sprint.update.mockResolvedValueOnce({
      id: "sprint-1",
      name: "New Name",
    });
    const result = await sprintRepository.update("sprint-1", {
      name: "New Name",
    });
    expect(prismaMock.sprint.update).toHaveBeenCalledWith({
      where: { id: "sprint-1" },
      data: { name: "New Name" },
    });
    expect(result.name).toBe("New Name");
  });

  it("should delete sprint", async () => {
    prismaMock.sprint.delete.mockResolvedValueOnce({ id: "sprint-1" });
    const result = await sprintRepository.delete("sprint-1");
    expect(prismaMock.sprint.delete).toHaveBeenCalledWith({
      where: { id: "sprint-1" },
    });
    expect(result.id).toBe("sprint-1");
  });

  it("should find sprint by id with trashed", async () => {
    prismaMock.sprint.findUniqueWithTrashed.mockResolvedValueOnce({
      id: "sprint-1",
    });
    const result = await sprintRepository.findByIdWithTrashed("sprint-1");
    expect(prismaMock.sprint.findUniqueWithTrashed).toHaveBeenCalledWith({
      where: { id: "sprint-1" },
    });
    expect(result?.id).toBe("sprint-1");
  });

  it("should restore sprint", async () => {
    prismaMock.sprint.restore.mockResolvedValueOnce({ id: "sprint-1" });
    const result = await sprintRepository.restore("sprint-1");
    expect(prismaMock.sprint.restore).toHaveBeenCalledWith({
      where: { id: "sprint-1" },
    });
    expect(result.id).toBe("sprint-1");
  });

  it("should force delete sprint", async () => {
    prismaMock.sprint.forceDelete.mockResolvedValueOnce({ id: "sprint-1" });
    const result = await sprintRepository.forceDelete("sprint-1");
    expect(prismaMock.sprint.forceDelete).toHaveBeenCalledWith({
      where: { id: "sprint-1" },
    });
    expect(result.id).toBe("sprint-1");
  });
});
