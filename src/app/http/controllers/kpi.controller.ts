import type { Request, Response } from "express";
import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { UnauthorizedException, NotFoundException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";
import { rbacService } from "@/app/services/rbac.service";

async function checkKpiAccess(
  userId: string,
  workspaceId: string,
  isAdminRoute = false,
) {
  const hasAdmin = await rbacService.authorize(userId, "kpi:view-admin", {
    workspaceId,
  });
  if (isAdminRoute && !hasAdmin) {
    throw new UnauthorizedException(
      "You do not have permission to view KPIs as an administrator.",
    );
  }
  if (!isAdminRoute) {
    const hasMember = await rbacService.authorize(userId, "kpi:view-member", {
      workspaceId,
    });
    if (!hasAdmin && !hasMember) {
      throw new UnauthorizedException(
        "You do not have permission to view KPIs.",
      );
    }
  }
}

export const kpiController = {
  getLeaderboard: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    await checkKpiAccess(session.user.id, workspaceId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { kpiEnabled: true },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    // Parse optional filters
    const projectIdsParam = req.query.projectIds;
    const projectIds: string[] = Array.isArray(projectIdsParam)
      ? (projectIdsParam as string[])
      : projectIdsParam
        ? [projectIdsParam as string]
        : [];

    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Determine which user IDs to include in the leaderboard
    let memberUserIds: string[];

    if (projectIds.length > 0) {
      // Only include members of the specified projects who are also workspace members
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: { in: projectIds } },
        select: { userId: true },
        distinct: ["userId"],
      });
      memberUserIds = projectMembers.map((pm) => pm.userId);
    } else {
      // All workspace members
      const workspaceMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true },
      });
      memberUserIds = workspaceMembers.map((m) => m.userId);
    }

    // Build the date filter for ledger entries
    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) createdAtFilter.gte = startDate;
    if (endDate) createdAtFilter.lte = endDate;

    // Fetch grouped sum of points with optional filters
    const points = await prisma.kpiLedgerEntry.groupBy({
      by: ["userId"],
      where: {
        workspaceId,
        userId: { in: memberUserIds },
        ...(projectIds.length > 0
          ? {
              task: {
                projectId: { in: projectIds },
              },
            }
          : {}),
        ...(startDate || endDate ? { createdAt: createdAtFilter } : {}),
      },
      _sum: {
        points: true,
      },
    });

    // Fetch user details for users in the result set
    const usersInResult = await prisma.user.findMany({
      where: { id: { in: memberUserIds } },
      select: { id: true, name: true, email: true, image: true },
    });

    const pointsMap = new Map(
      points.map((p) => [p.userId, p._sum.points ?? 0]),
    );
    const userMap = new Map(usersInResult.map((u) => [u.id, u]));

    const leaderboard = memberUserIds
      .filter((userId) => userMap.has(userId))
      .map((userId) => ({
        user: userMap.get(userId)!,
        totalPoints: pointsMap.get(userId) ?? 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return ok(res, "Leaderboard fetched successfully", {
      kpiEnabled: workspace.kpiEnabled,
      leaderboard,
    });
  }),

  getTransactions: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    await checkKpiAccess(session.user.id, workspaceId);

    const userIdFilter = req.query.userId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Parse optional filters
    const projectIdsParam = req.query.projectIds;
    const projectIds: string[] = Array.isArray(projectIdsParam)
      ? (projectIdsParam as string[])
      : projectIdsParam
        ? [projectIdsParam as string]
        : [];

    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) createdAtFilter.gte = startDate;
    if (endDate) createdAtFilter.lte = endDate;

    const whereClause = {
      workspaceId,
      ...(userIdFilter ? { userId: userIdFilter } : {}),
      ...(projectIds.length > 0
        ? {
            task: {
              projectId: { in: projectIds },
            },
          }
        : {}),
      ...(startDate || endDate ? { createdAt: createdAtFilter } : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.kpiLedgerEntry.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, image: true, email: true } },
          task: {
            select: {
              id: true,
              title: true,
              taskKey: true,
              projectId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.kpiLedgerEntry.count({
        where: whereClause,
      }),
    ]);

    return ok(res, "KPI transactions fetched successfully", {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  getUserStats: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    await checkKpiAccess(session.user.id, workspaceId);

    const userId = (req.query.userId as string) || session.user.id;

    // Check if user is workspace member
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }

    // 1. Total points
    const pointsSum = await prisma.kpiLedgerEntry.aggregate({
      where: { workspaceId, userId },
      _sum: { points: true },
    });
    const totalPoints = pointsSum._sum.points ?? 0;

    // 2. Rank calculation
    const allPoints = await prisma.kpiLedgerEntry.groupBy({
      by: ["userId"],
      where: { workspaceId },
      _sum: { points: true },
    });

    const sortedPoints = allPoints
      .map((ap) => ({ userId: ap.userId, points: ap._sum.points ?? 0 }))
      .sort((a, b) => b.points - a.points);

    const userIndex = sortedPoints.findIndex((sp) => sp.userId === userId);
    const rank = userIndex !== -1 ? userIndex + 1 : sortedPoints.length + 1;

    // 3. Weekly breakdown (last 4 weeks)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const recentEntries = await prisma.kpiLedgerEntry.findMany({
      where: {
        workspaceId,
        userId,
        createdAt: { gte: fourWeeksAgo },
      },
      select: { points: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group into 4 weekly buckets
    const weeklyPoints = [0, 0, 0, 0];
    const now = new Date().getTime();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    recentEntries.forEach((entry) => {
      const entryTime = new Date(entry.createdAt).getTime();
      const ageWeeks = Math.floor((now - entryTime) / oneWeekMs);
      if (ageWeeks >= 0 && ageWeeks < 4) {
        weeklyPoints[3 - ageWeeks] += entry.points;
      }
    });

    // 4. Check if the requesting user is an admin / owner in this workspace scope
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });
    const isAdminOrOwner = workspace
      ? await rbacService
          .authorize(session.user.id, "member:read", {
            workspaceId,
            organizationId: workspace.organizationId,
          })
          .catch(() => false)
      : false;

    return ok(res, "User KPI stats fetched successfully", {
      userId,
      totalPoints,
      rank,
      weeklyPoints,
      isAdminOrOwner,
    });
  }),

  getAccessibleProjects: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    await checkKpiAccess(session.user.id, workspaceId);

    // Return only projects in this workspace where the current user is a member
    const projectMembers = await prisma.projectMember.findMany({
      where: {
        userId: session.user.id,
        project: { workspaceId },
      },
      select: {
        project: {
          select: { id: true, title: true },
        },
      },
    });

    const projects = projectMembers.map((pm) => pm.project);

    return ok(res, "Accessible projects fetched successfully", projects);
  }),

  getAllProjects: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    await checkKpiAccess(session.user.id, workspaceId, true);

    // Admins/owners can see all projects in the workspace for filtering
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });

    return ok(res, "All workspace projects fetched successfully", projects);
  }),
};
