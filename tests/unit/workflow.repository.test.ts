import { describe, it, expect, vi } from "vitest";
import { workflowRepository } from "@/app/repositories/workflow.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("WorkflowRepository", () => {
  it("should find transition", async () => {
    prismaMock.workflowTransition.findUnique.mockResolvedValueOnce({ id: "tr-1" });
    const result = await workflowRepository.findTransition("proj-1", "status-1", "status-2");
    expect(prismaMock.workflowTransition.findUnique).toHaveBeenCalled();
    expect(result?.id).toBe("tr-1");
  });

  it("should create transition", async () => {
    const data = {
      projectId: "proj-1",
      organizationId: "org-1",
      fromStatusId: "status-1",
      toStatusId: "status-2",
      requiredRoleId: "role-1",
    };
    prismaMock.workflowTransition.create.mockResolvedValueOnce({ id: "tr-1", ...data });
    const result = await workflowRepository.createTransition(data);
    expect(prismaMock.workflowTransition.create).toHaveBeenCalledWith({ data });
    expect(result.id).toBe("tr-1");
  });

  it("should delete transition", async () => {
    prismaMock.workflowTransition.delete.mockResolvedValueOnce({ id: "tr-1" });
    const result = await workflowRepository.deleteTransition("tr-1");
    expect(prismaMock.workflowTransition.delete).toHaveBeenCalledWith({ where: { id: "tr-1" } });
    expect(result.id).toBe("tr-1");
  });

  it("should get transitions by project", async () => {
    prismaMock.workflowTransition.findMany.mockResolvedValueOnce([{ id: "tr-1" }]);
    const result = await workflowRepository.getTransitionsByProject("proj-1");
    expect(prismaMock.workflowTransition.findMany).toHaveBeenCalledWith({
      where: { projectId: "proj-1" },
      include: {
        fromStatus: true,
        toStatus: true,
        requiredRole: true,
      },
    });
    expect(result).toHaveLength(1);
  });

  it("should get transitions from status", async () => {
    prismaMock.workflowTransition.findMany.mockResolvedValueOnce([{ id: "tr-1" }]);
    const result = await workflowRepository.getTransitionsFromStatus("proj-1", "status-1");
    expect(prismaMock.workflowTransition.findMany).toHaveBeenCalledWith({
      where: { projectId: "proj-1", fromStatusId: "status-1" },
      include: {
        toStatus: true,
        requiredRole: true,
      },
    });
    expect(result).toHaveLength(1);
  });
});
