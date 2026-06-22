import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { z } from "zod";
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error";

async function verifyProjectAccess(req: Request, projectId: string) {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    throw new BadRequestException("No active organization found");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }

  // Check Org Admin/Owner
  const callerOrgMember = await prisma.member.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: session.user.id,
      role: { in: ["owner", "admin"] },
    },
  });

  if (callerOrgMember) {
    return { activeOrgId, userId: session.user.id, project };
  }

  // Check Workspace Admin
  const callerWorkspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspaceId,
      userId: session.user.id,
      role: "admin",
      workspace: { organizationId: activeOrgId },
    },
  });

  if (callerWorkspaceMember) {
    return { activeOrgId, userId: session.user.id, project };
  }

  // Check Project Member
  const projectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: session.user.id,
      },
    },
  });

  if (!projectMember) {
    throw new ForbiddenException("Forbidden: You must be a project member or workspace/org admin");
  }

  return { activeOrgId, userId: session.user.id, project };
}

const sprintCreateSchema = z.object({
  name: z.string().min(1, "Sprint name is required"),
  goal: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

const sprintUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  status: z.enum(["planned", "active", "completed"]).optional(),
  uncompletedTasksDestination: z.string().uuid().optional().nullable(), // Next sprint ID or null (backlog)
});

export const sprintController = {
  createSprint: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const validatedData = sprintCreateSchema.parse(req.body);

    const sprint = await prisma.sprint.create({
      data: {
        name: validatedData.name,
        goal: validatedData.goal,
        projectId,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        status: "planned",
      },
    });

    return ok(res, "Sprint created successfully", sprint);
  }),

  getSprints: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const sprints = await prisma.sprint.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok(res, "Sprints fetched successfully", sprints);
  }),

  getSprint: asyncHandler(async (req: Request, res: Response) => {
    const sprintId = req.params.id as string;

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        tasks: {
          include: {
            status: true,
            assignee: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    await verifyProjectAccess(req, sprint.projectId);

    return ok(res, "Sprint details fetched successfully", sprint);
  }),

  updateSprint: asyncHandler(async (req: Request, res: Response) => {
    const sprintId = req.params.id as string;

    const existingSprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    });

    if (!existingSprint) {
      throw new NotFoundException("Sprint not found");
    }

    const { userId } = await verifyProjectAccess(req, existingSprint.projectId);
    const validatedData = sprintUpdateSchema.parse(req.body);

    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.goal !== undefined) updateData.goal = validatedData.goal;
    if (validatedData.startDate !== undefined) {
      updateData.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null;
    }
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
    }

    // Process Sprint Status Transitions
    if (validatedData.status && validatedData.status !== existingSprint.status) {
      if (validatedData.status === "active") {
        // Enforce that only one active sprint can exist per project
        const activeSprint = await prisma.sprint.findFirst({
          where: { projectId: existingSprint.projectId, status: "active" },
        });
        if (activeSprint) {
          throw new BadRequestException("An active sprint already exists. Close it before starting a new one.");
        }
        updateData.status = "active";
        if (!existingSprint.startDate) {
          updateData.startDate = new Date();
        }
      } else if (validatedData.status === "completed") {
        // Run Sprint Completion Logic
        updateData.status = "completed";
        updateData.completedAt = new Date();

        const destSprintId = validatedData.uncompletedTasksDestination || null;

        // If a destination sprint is specified, verify it belongs to the same project
        if (destSprintId) {
          const destSprint = await prisma.sprint.findFirst({
            where: { id: destSprintId, projectId: existingSprint.projectId },
          });
          if (!destSprint) {
            throw new BadRequestException("Selected destination sprint does not belong to this project");
          }
        }

        // Find all tasks that are NOT done in the current sprint
        const uncompletedTasks = await prisma.task.findMany({
          where: {
            sprintId,
            deletedAt: null,
            status: {
              category: { not: "done" },
            },
          },
        });

        if (uncompletedTasks.length > 0) {
          const taskIds = uncompletedTasks.map((t) => t.id);

          // Move uncompleted tasks to target sprint or backlog (null)
          await prisma.task.updateMany({
            where: { id: { in: taskIds } },
            data: { sprintId: destSprintId },
          });

          // Log activity for each task moved
          const logPayloads = taskIds.map((taskId) => ({
            taskId,
            userId,
            action: "sprint_changed",
            oldValue: existingSprint.name,
            newValue: destSprintId ? "Next Sprint" : "Backlog",
          }));

          await prisma.taskActivity.createMany({
            data: logPayloads,
          });
        }
      } else {
        updateData.status = validatedData.status;
      }
    }

    const updatedSprint = await prisma.sprint.update({
      where: { id: sprintId },
      data: updateData,
    });

    return ok(res, "Sprint updated successfully", updatedSprint);
  }),

  deleteSprint: asyncHandler(async (req: Request, res: Response) => {
    const sprintId = req.params.id as string;

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    await verifyProjectAccess(req, sprint.projectId);

    // Tasks associated with the deleted sprint are set to null (backlog) via prisma schema SetNull constraint.
    await prisma.sprint.delete({
      where: { id: sprintId },
    });

    return ok(res, "Sprint deleted successfully");
  }),
};
