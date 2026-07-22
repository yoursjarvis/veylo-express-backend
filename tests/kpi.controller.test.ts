import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/http/middlewares/async-handler.middleware", () => ({
  asyncHandler: (fn: unknown) => fn,
}));

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock("../src/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

import { kpiController } from "../src/app/http/controllers/kpi.controller";
import { prismaMock } from "./helpers/db";

function createRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("kpiController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: "user-123", name: "John Doe" },
      session: { activeOrganizationId: "org-123" },
    });
  });

  // ---------------------------------------------------------------------------
  // getLeaderboard
  // ---------------------------------------------------------------------------
  describe("getLeaderboard", () => {
    it("throws NotFoundException if workspace not found", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: {},
      };
      const res = createRes();

      await expect(
        (
          kpiController.getLeaderboard as (
            req: unknown,
            res: unknown,
          ) => Promise<void>
        )(req, res),
      ).rejects.toThrow("Workspace not found");
    });

    it("throws UnauthorizedException if no session", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: {},
      };
      const res = createRes();

      await expect(
        (
          kpiController.getLeaderboard as (
            req: unknown,
            res: unknown,
          ) => Promise<void>
        )(req, res),
      ).rejects.toThrow();
    });

    it("returns leaderboard successfully without filters", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-123",
        kpiEnabled: true,
      });
      prismaMock.workspaceMember.findMany.mockResolvedValueOnce([
        { userId: "user-123" },
        { userId: "user-456" },
      ]);
      (
        prismaMock.kpiLedgerEntry.groupBy as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([
        { userId: "user-123", _sum: { points: 100 } },
        { userId: "user-456", _sum: { points: 200 } },
      ]);
      prismaMock.user.findMany.mockResolvedValueOnce([
        {
          id: "user-123",
          name: "John Doe",
          email: "john@example.com",
          image: null,
        },
        {
          id: "user-456",
          name: "Jane Doe",
          email: "jane@example.com",
          image: null,
        },
      ]);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: {},
      };
      const res = createRes();

      await (
        kpiController.getLeaderboard as (
          req: unknown,
          res: unknown,
        ) => Promise<void>
      )(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            kpiEnabled: true,
            leaderboard: expect.arrayContaining([
              expect.objectContaining({ totalPoints: 200 }),
              expect.objectContaining({ totalPoints: 100 }),
            ]),
          }),
        }),
      );
    });

    it("filters leaderboard by projectIds when provided", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-123",
        kpiEnabled: true,
      });
      prismaMock.projectMember.findMany.mockResolvedValueOnce([
        { userId: "user-123" },
      ]);
      (
        prismaMock.kpiLedgerEntry.groupBy as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([{ userId: "user-123", _sum: { points: 100 } }]);
      prismaMock.user.findMany.mockResolvedValueOnce([
        {
          id: "user-123",
          name: "John Doe",
          email: "john@example.com",
          image: null,
        },
      ]);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: { projectIds: ["proj-1"] },
      };
      const res = createRes();

      await (
        kpiController.getLeaderboard as (
          req: unknown,
          res: unknown,
        ) => Promise<void>
      )(req, res);

      expect(prismaMock.projectMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: { in: ["proj-1"] } },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getTransactions
  // ---------------------------------------------------------------------------
  describe("getTransactions", () => {
    it("returns list of transactions with pagination", async () => {
      prismaMock.kpiLedgerEntry.findMany.mockResolvedValueOnce([
        { id: "tx-1", points: 50, reason: "Completed Task" },
      ]);
      prismaMock.kpiLedgerEntry.count.mockResolvedValueOnce(1);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: { page: "1", limit: "10" },
      };
      const res = createRes();

      await (
        kpiController.getTransactions as (
          req: unknown,
          res: unknown,
        ) => Promise<void>
      )(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            transactions: expect.any(Array),
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          }),
        }),
      );
    });

    it("filters transactions by userId when provided", async () => {
      prismaMock.kpiLedgerEntry.findMany.mockResolvedValueOnce([]);
      prismaMock.kpiLedgerEntry.count.mockResolvedValueOnce(0);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: { page: "1", limit: "10", userId: "user-456" },
      };
      const res = createRes();

      await (
        kpiController.getTransactions as (
          req: unknown,
          res: unknown,
        ) => Promise<void>
      )(req, res);

      expect(prismaMock.kpiLedgerEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-456" }),
        }),
      );
    });

    it("filters transactions by projectIds when provided", async () => {
      prismaMock.kpiLedgerEntry.findMany.mockResolvedValueOnce([]);
      prismaMock.kpiLedgerEntry.count.mockResolvedValueOnce(0);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: { page: "1", limit: "10", projectIds: ["proj-1"] },
      };
      const res = createRes();

      await (
        kpiController.getTransactions as (
          req: unknown,
          res: unknown,
        ) => Promise<void>
      )(req, res);

      expect(prismaMock.kpiLedgerEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            task: { projectId: { in: ["proj-1"] } },
          }),
        }),
      );
    });

    it("filters transactions by date range when provided", async () => {
      prismaMock.kpiLedgerEntry.findMany.mockResolvedValueOnce([]);
      prismaMock.kpiLedgerEntry.count.mockResolvedValueOnce(0);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: {
          page: "1",
          limit: "10",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        },
      };
      const res = createRes();

      await (
        kpiController.getTransactions as (
          req: unknown,
          res: unknown,
        ) => Promise<void>
      )(req, res);

      expect(prismaMock.kpiLedgerEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date("2024-01-01"),
              lte: new Date("2024-12-31"),
            },
          }),
        }),
      );
    });

    it("throws UnauthorizedException if no session", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: {},
      };
      const res = createRes();

      await expect(
        (
          kpiController.getTransactions as (
            req: unknown,
            res: unknown,
          ) => Promise<void>
        )(req, res),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getUserStats
  // ---------------------------------------------------------------------------
  describe("getUserStats", () => {
    it("returns stats for a user successfully", async () => {
      prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({
        userId: "user-123",
      });
      (
        prismaMock.kpiLedgerEntry.aggregate as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        _sum: { points: 150 },
      });
      (
        prismaMock.kpiLedgerEntry.groupBy as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([
        { userId: "user-123", _sum: { points: 150 } },
        { userId: "user-456", _sum: { points: 250 } },
      ]);
      prismaMock.kpiLedgerEntry.findMany.mockResolvedValueOnce([
        { points: 50, createdAt: new Date() },
        { points: 100, createdAt: new Date() },
      ]);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: { userId: "user-123" },
      };
      const res = createRes();

      await (
        kpiController.getUserStats as (
          req: unknown,
          res: unknown,
        ) => Promise<void>
      )(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            userId: "user-123",
            totalPoints: 150,
            rank: 2,
            weeklyPoints: expect.any(Array),
          }),
        }),
      );
    });

    it("throws NotFoundException if user is not a workspace member", async () => {
      prismaMock.workspaceMember.findFirst.mockResolvedValueOnce(null);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: { userId: "user-999" },
      };
      const res = createRes();

      await expect(
        (
          kpiController.getUserStats as (
            req: unknown,
            res: unknown,
          ) => Promise<void>
        )(req, res),
      ).rejects.toThrow("Workspace member not found");
    });

    it("falls back to session user id if userId query param is not provided", async () => {
      prismaMock.workspaceMember.findFirst.mockResolvedValueOnce({
        userId: "user-123",
      });
      (
        prismaMock.kpiLedgerEntry.aggregate as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        _sum: { points: 0 },
      });
      (
        prismaMock.kpiLedgerEntry.groupBy as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);
      prismaMock.kpiLedgerEntry.findMany.mockResolvedValueOnce([]);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: {},
      };
      const res = createRes();

      await (
        kpiController.getUserStats as (
          req: unknown,
          res: unknown,
        ) => Promise<void>
      )(req, res);

      expect(prismaMock.workspaceMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: "ws-123", userId: "user-123" },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getAccessibleProjects
  // ---------------------------------------------------------------------------
  describe("getAccessibleProjects", () => {
    it("returns only projects the current user is a member of", async () => {
      prismaMock.projectMember.findMany.mockResolvedValueOnce([
        { project: { id: "proj-1", title: "Alpha" } },
        { project: { id: "proj-2", title: "Beta" } },
      ]);

      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: {},
      };
      const res = createRes();

      await (
        kpiController.getAccessibleProjects as (
          req: unknown,
          res: unknown,
        ) => Promise<void>
      )(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [
            { id: "proj-1", title: "Alpha" },
            { id: "proj-2", title: "Beta" },
          ],
        }),
      );
    });

    it("throws UnauthorizedException if no session", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const req: Record<string, unknown> = {
        params: { id: "ws-123" },
        query: {},
      };
      const res = createRes();

      await expect(
        (
          kpiController.getAccessibleProjects as (
            req: unknown,
            res: unknown,
          ) => Promise<void>
        )(req, res),
      ).rejects.toThrow();
    });
  });
});
