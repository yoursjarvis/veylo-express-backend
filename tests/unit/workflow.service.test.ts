import { describe, it, expect, vi, beforeEach } from "vitest";
import { workflowService } from "@/app/services/workflow.service";
import { workflowRepository } from "@/app/repositories/workflow.repository";

// Mock workflowRepository
vi.mock("@/app/repositories/workflow.repository", () => ({
  workflowRepository: {
    getTransitionsByProject: vi.fn(),
    findTransition: vi.fn(),
    createTransition: vi.fn(),
  },
}));

describe("WorkflowService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow transition if no transitions are defined for project (default allow all)", async () => {
    vi.mocked(workflowRepository.getTransitionsByProject).mockResolvedValueOnce([]);

    const allowed = await workflowService.validateTransition("proj-1", "status-1", "status-2", "user-1");
    expect(allowed).toBe(true);
    expect(workflowRepository.getTransitionsByProject).toHaveBeenCalledWith("proj-1");
  });

  it("should allow transition if a valid transition is found", async () => {
    vi.mocked(workflowRepository.getTransitionsByProject).mockResolvedValueOnce([{ id: "t-1" } as any]);
    vi.mocked(workflowRepository.findTransition).mockResolvedValueOnce({ id: "t-1" } as any);

    const allowed = await workflowService.validateTransition("proj-1", "status-1", "status-2", "user-1");
    expect(allowed).toBe(true);
    expect(workflowRepository.findTransition).toHaveBeenCalledWith("proj-1", "status-1", "status-2");
  });

  it("should throw BadRequestException if transition is not allowed", async () => {
    vi.mocked(workflowRepository.getTransitionsByProject).mockResolvedValueOnce([{ id: "t-1" } as any]);
    vi.mocked(workflowRepository.findTransition).mockResolvedValueOnce(null);

    await expect(
      workflowService.validateTransition("proj-1", "status-1", "status-2", "user-1")
    ).rejects.toThrow("This status transition is not allowed in the current project workflow.");
  });

  it("should create transition", async () => {
    const data = {
      projectId: "proj-1",
      organizationId: "org-1",
      fromStatusId: "status-1",
      toStatusId: "status-2",
    };
    vi.mocked(workflowRepository.createTransition).mockResolvedValueOnce({ id: "t-1", ...data } as any);

    const result = await workflowService.createTransition(data);
    expect(result.id).toBe("t-1");
    expect(workflowRepository.createTransition).toHaveBeenCalledWith(data);
  });

  it("should get project workflow", async () => {
    vi.mocked(workflowRepository.getTransitionsByProject).mockResolvedValueOnce([{ id: "t-1" } as any]);
    const result = await workflowService.getProjectWorkflow("proj-1");
    expect(result).toHaveLength(1);
  });
});
