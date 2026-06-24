import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { z } from "zod";
import { NotFoundException } from "@/utils/app-error";

const milestoneCreateSchema = z.object({
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

const milestoneUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  isCompleted: z.boolean().optional(),
});

export const milestoneController = {
  createMilestone: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId);
    const { organizationId } = project;

    const validatedData = milestoneCreateSchema.parse(req.body);

    const milestone = await prisma.milestone.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        projectId,
        organizationId,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        isCompleted: false,
      },
    });

    return ok(res, "Milestone created successfully", milestone);
  }),

  getMilestones: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const milestones = await prisma.milestone.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return ok(res, "Milestones fetched successfully", milestones);
  }),

  updateMilestone: asyncHandler(async (req: Request, res: Response) => {
    const milestoneId = req.params.id as string;

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException("Milestone not found");
    }

    await verifyProjectAccess(req, milestone.projectId);

    const validatedData = milestoneUpdateSchema.parse(req.body);

    const updateData: Record<string, any> = {};
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.isCompleted !== undefined) updateData.isCompleted = validatedData.isCompleted;
    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null;
    }

    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: updateData,
    });

    return ok(res, "Milestone updated successfully", updated);
  }),

  deleteMilestone: asyncHandler(async (req: Request, res: Response) => {
    const milestoneId = req.params.id as string;

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException("Milestone not found");
    }

    await verifyProjectAccess(req, milestone.projectId);

    await prisma.milestone.delete({
      where: { id: milestoneId },
    });

    return ok(res, "Milestone deleted successfully");
  }),
};
