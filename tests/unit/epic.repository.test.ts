import { describe, it, expect, vi } from "vitest";
import { epicRepository } from "@/app/repositories/epic.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("EpicRepository", () => {
  it("should create an epic", async () => {
    const epicData = {
      title: "Epic Title",
      description: "Epic Description",
      projectId: "proj-1",
      organizationId: "org-1",
      status: "OPEN",
    };
    prismaMock.epic.create.mockResolvedValueOnce({ id: "epic-1", ...epicData });
    const result = await epicRepository.create(epicData);
    expect(prismaMock.epic.create).toHaveBeenCalledWith({ data: epicData });
    expect(result.id).toBe("epic-1");
  });

  it("should find epics by projectId", async () => {
    prismaMock.epic.findMany.mockResolvedValueOnce([{ id: "epic-1", title: "Epic" }]);
    const result = await epicRepository.findByProjectId("proj-1");
    expect(prismaMock.epic.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should find an epic by id", async () => {
    prismaMock.epic.findUnique.mockResolvedValueOnce({ id: "epic-1", title: "Epic" });
    const result = await epicRepository.findById("epic-1");
    expect(prismaMock.epic.findUnique).toHaveBeenCalledWith({ where: { id: "epic-1" } });
    expect(result?.id).toBe("epic-1");
  });

  it("should find an epic by id with tasks", async () => {
    prismaMock.epic.findUnique.mockResolvedValueOnce({ id: "epic-1", title: "Epic", tasks: [] });
    const result = await epicRepository.findByIdWithTasks("epic-1");
    expect(prismaMock.epic.findUnique).toHaveBeenCalled();
    expect(result?.id).toBe("epic-1");
  });

  it("should update an epic", async () => {
    prismaMock.epic.update.mockResolvedValueOnce({ id: "epic-1", title: "Updated Epic" });
    const result = await epicRepository.update("epic-1", { title: "Updated Epic" });
    expect(prismaMock.epic.update).toHaveBeenCalledWith({
      where: { id: "epic-1" },
      data: { title: "Updated Epic" },
    });
    expect(result.title).toBe("Updated Epic");
  });

  it("should delete an epic", async () => {
    prismaMock.epic.delete.mockResolvedValueOnce({ id: "epic-1" });
    const result = await epicRepository.delete("epic-1");
    expect(prismaMock.epic.delete).toHaveBeenCalledWith({ where: { id: "epic-1" } });
    expect(result.id).toBe("epic-1");
  });

  it("should find an epic by id with trashed", async () => {
    prismaMock.epic.findUniqueWithTrashed.mockResolvedValueOnce({ id: "epic-1", title: "Trashed Epic" });
    const result = await epicRepository.findByIdWithTrashed("epic-1");
    expect(prismaMock.epic.findUniqueWithTrashed).toHaveBeenCalledWith({ where: { id: "epic-1" } });
    expect(result?.title).toBe("Trashed Epic");
  });

  it("should restore an epic", async () => {
    prismaMock.epic.restore.mockResolvedValueOnce({ id: "epic-1" });
    const result = await epicRepository.restore("epic-1");
    expect(prismaMock.epic.restore).toHaveBeenCalledWith({ where: { id: "epic-1" } });
    expect(result.id).toBe("epic-1");
  });

  it("should force delete an epic", async () => {
    prismaMock.epic.forceDelete.mockResolvedValueOnce({ id: "epic-1" });
    const result = await epicRepository.forceDelete("epic-1");
    expect(prismaMock.epic.forceDelete).toHaveBeenCalledWith({ where: { id: "epic-1" } });
    expect(result.id).toBe("epic-1");
  });
});
