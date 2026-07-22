import { describe, it, expect, vi } from "vitest";
import { objectiveRepository } from "@/app/repositories/objective.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("ObjectiveRepository", () => {
  it("should find objectives by workspace (with/without trashed)", async () => {
    prismaMock.objective.findMany.mockResolvedValueOnce([{ id: "obj-1" }]);
    prismaMock.objective.findManyWithTrashed.mockResolvedValueOnce([
      { id: "obj-1" },
      { id: "obj-2" },
    ]);

    const res1 = await objectiveRepository.findObjectivesByWorkspace(
      "ws-1",
      false,
    );
    expect(prismaMock.objective.findMany).toHaveBeenCalled();
    expect(res1).toHaveLength(1);

    const res2 = await objectiveRepository.findObjectivesByWorkspace(
      "ws-1",
      true,
    );
    expect(prismaMock.objective.findManyWithTrashed).toHaveBeenCalled();
    expect(res2).toHaveLength(2);
  });

  it("should find project by id", async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: "proj-1" });
    const result = await objectiveRepository.findProjectById("proj-1");
    expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
      where: { id: "proj-1" },
    });
    expect(result?.id).toBe("proj-1");
  });

  it("should create objective with keyResult", async () => {
    const data = {
      title: "Objective 1",
      description: "Desc",
      projectId: "proj-1",
      epicId: "epic-1",
      organizationId: "org-1",
      krTitle: "KR Title",
      krTarget: "KR Target",
    };
    prismaMock.objective.create.mockResolvedValueOnce({ id: "obj-1", ...data });
    const result = await objectiveRepository.createObjective(data);
    expect(prismaMock.objective.create).toHaveBeenCalled();
    expect(result.id).toBe("obj-1");
  });

  it("should delete objective", async () => {
    prismaMock.objective.delete.mockResolvedValueOnce({ id: "obj-1" });
    const result = await objectiveRepository.deleteObjective("obj-1");
    expect(prismaMock.objective.delete).toHaveBeenCalledWith({
      where: { id: "obj-1" },
    });
    expect(result.id).toBe("obj-1");
  });

  it("should find objective by id with trashed", async () => {
    prismaMock.objective.findUniqueWithTrashed.mockResolvedValueOnce({
      id: "obj-1",
    });
    const result =
      await objectiveRepository.findObjectiveByIdWithTrashed("obj-1");
    expect(prismaMock.objective.findUniqueWithTrashed).toHaveBeenCalledWith({
      where: { id: "obj-1" },
    });
    expect(result?.id).toBe("obj-1");
  });

  it("should restore objective", async () => {
    prismaMock.objective.restore.mockResolvedValueOnce({ id: "obj-1" });
    const result = await objectiveRepository.restoreObjective("obj-1");
    expect(prismaMock.objective.restore).toHaveBeenCalledWith({
      where: { id: "obj-1" },
    });
    expect(result.id).toBe("obj-1");
  });

  it("should force delete objective", async () => {
    prismaMock.objective.forceDelete.mockResolvedValueOnce({ id: "obj-1" });
    const result = await objectiveRepository.forceDeleteObjective("obj-1");
    expect(prismaMock.objective.forceDelete).toHaveBeenCalledWith({
      where: { id: "obj-1" },
    });
    expect(result.id).toBe("obj-1");
  });

  it("should update objective (with/without kr update)", async () => {
    prismaMock.objective.update.mockResolvedValueOnce({
      id: "obj-1",
      title: "Updated",
    });

    // Test case 1: No KR update
    await objectiveRepository.updateObjective("obj-1", { title: "Updated" });
    expect(prismaMock.objective.update).toHaveBeenCalled();

    // Test case 2: KR update
    prismaMock.keyResult.findFirst.mockResolvedValueOnce({ id: "kr-1" });
    prismaMock.keyResult.update.mockResolvedValueOnce({
      id: "kr-1",
      title: "KR New",
    });
    prismaMock.objective.update.mockResolvedValueOnce({
      id: "obj-1",
      title: "Updated With KR",
    });

    const result = await objectiveRepository.updateObjective("obj-1", {
      title: "Updated With KR",
      krTitle: "KR New",
      krTarget: "100",
    });
    expect(prismaMock.keyResult.findFirst).toHaveBeenCalled();
    expect(prismaMock.keyResult.update).toHaveBeenCalled();
    expect(result.title).toBe("Updated With KR");
  });
});
