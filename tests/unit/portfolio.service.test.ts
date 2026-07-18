import { describe, it, expect, vi } from "vitest";
import { portfolioService } from "@/app/services/portfolio.service";
import { prismaMock } from "../../tests/helpers/db";

describe("PortfolioService", () => {
  it("should get portfolios (active and trashed) with progress calculation", async () => {
    const portfolioMockData = [
      {
        id: "port-1",
        name: "P1",
        description: "D1",
        workspaceId: "ws-1",
        organizationId: "org-1",
        ownerId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: "user-1", name: "John" },
        projects: [
          {
            project: {
              id: "proj-1",
              title: "Proj 1",
              tasks: [
                { dueDate: new Date(Date.now() - 86400000), status: { category: "todo" } },
                { dueDate: null, status: { category: "done" } },
              ],
            },
          },
        ],
      },
    ];

    prismaMock.portfolio.findMany.mockResolvedValueOnce(portfolioMockData);
    prismaMock.portfolio.findManyWithTrashed.mockResolvedValue(portfolioMockData);

    const resultActive = await portfolioService.getPortfolios("ws-1");
    expect(resultActive).toHaveLength(1);
    expect(resultActive[0].projects[0].progress).toBe(50);
    expect(resultActive[0].projects[0].delayedTasks).toBe(1);

    const resultTrashed = await portfolioService.getPortfolios("ws-1", { withTrashed: true });
    expect(resultTrashed).toHaveLength(1);

    const resultOnlyTrashed = await portfolioService.getPortfolios("ws-1", { onlyTrashed: true });
    expect(resultOnlyTrashed).toHaveLength(1);
  });

  it("should get portfolio by id (active or trashed) with projects tasks mapping", async () => {
    const mockData = {
      id: "port-1",
      name: "P1",
      workspaceId: "ws-1",
      organizationId: "org-1",
      ownerId: "user-1",
      projects: [
        {
          project: {
            id: "proj-1",
            title: "Proj 1",
            tasks: [
              { dueDate: new Date(Date.now() - 86400000), status: { category: "todo" } },
              { dueDate: null, status: { category: "done" } },
            ],
          },
        },
      ],
    };

    prismaMock.portfolio.findUnique.mockResolvedValueOnce(mockData);
    prismaMock.portfolio.findUniqueWithTrashed.mockResolvedValueOnce(mockData);

    const result = await portfolioService.getPortfolioById("port-1");
    expect(result?.projects).toHaveLength(1);
    expect(result?.projects[0].progress).toBe(50);

    expect(await portfolioService.getPortfolioById("port-1", { withTrashed: true })).toBeDefined();

    // Non-existent portfolio
    prismaMock.portfolio.findUnique.mockResolvedValueOnce(null);
    expect(await portfolioService.getPortfolioById("non-existent")).toBeNull();
  });

  it("should create portfolio with projects", async () => {
    prismaMock.portfolio.create.mockResolvedValueOnce({ id: "port-1" });
    prismaMock.portfolioProject.createMany.mockResolvedValueOnce({ count: 2 });

    const result = await portfolioService.createPortfolio("ws-1", "org-1", "user-1", {
      name: "Portfolio 1",
      projectIds: ["proj-1", "proj-2"],
    });

    expect(result.id).toBe("port-1");
    expect(prismaMock.portfolio.create).toHaveBeenCalled();
    expect(prismaMock.portfolioProject.createMany).toHaveBeenCalled();
  });

  it("should update portfolio (name, description, projects lists)", async () => {
    prismaMock.portfolio.update.mockResolvedValueOnce({ id: "port-1", organizationId: "org-1" });
    prismaMock.portfolioProject.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.portfolioProject.createMany.mockResolvedValueOnce({ count: 2 });

    const result = await portfolioService.updatePortfolio("port-1", {
      name: "New Name",
      projectIds: ["proj-3"],
    });

    expect(result.id).toBe("port-1");
    expect(prismaMock.portfolio.update).toHaveBeenCalled();
    expect(prismaMock.portfolioProject.deleteMany).toHaveBeenCalled();
    expect(prismaMock.portfolioProject.createMany).toHaveBeenCalled();
  });

  it("should delete, restore, and force delete portfolio", async () => {
    prismaMock.portfolio.delete.mockResolvedValueOnce({ id: "port-1" });
    prismaMock.portfolio.restore.mockResolvedValueOnce({ id: "port-1" });
    prismaMock.portfolio.forceDelete.mockResolvedValueOnce({ id: "port-1" });

    expect(await portfolioService.deletePortfolio("port-1")).toEqual({ id: "port-1" });
    expect(await portfolioService.restorePortfolio("port-1")).toEqual({ id: "port-1" });
    expect(await portfolioService.forceDeletePortfolio("port-1")).toEqual({ id: "port-1" });
  });
});
