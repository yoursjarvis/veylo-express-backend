import { describe, expect, it, vi, beforeEach } from "vitest";
import { searchService } from "../../src/app/services/search.service";
import { prismaMock } from "../helpers/db";

describe("SearchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("globalSearch", () => {
    it("UT-SRH-01: returns empty arrays if query is empty or whitespace", async () => {
      const res1 = await searchService.globalSearch("org-1", "user-1", "");
      expect(res1).toEqual({ workspaces: [], projects: [], tasks: [] });

      const res2 = await searchService.globalSearch("org-1", "user-1", "   ");
      expect(res2).toEqual({ workspaces: [], projects: [], tasks: [] });
    });

    it("UT-SRH-02: performs global query search successfully", async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ id: "w1", name: "Workspace 1" }]) // workspaces
        .mockResolvedValueOnce([{ id: "p1", title: "Project 1" }]) // projects
        .mockResolvedValueOnce([{ id: "t1", title: "Task 1" }]); // tasks

      const res = await searchService.globalSearch(
        "org-1",
        "user-1",
        "testQuery",
      );

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
      expect(res).toEqual({
        workspaces: [{ id: "w1", name: "Workspace 1" }],
        projects: [{ id: "p1", title: "Project 1" }],
        tasks: [{ id: "t1", title: "Task 1" }],
      });
    });
  });
});
