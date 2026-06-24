import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { z } from "zod";
import { NotFoundException } from "@/utils/app-error";

const epicCreateSchema = z.object({
  title: z.string().min(1, "Epic title is required"),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

const epicUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export const epicController = {
  createEpic: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId);
    const { organizationId } = project;

    const validatedData = epicCreateSchema.parse(req.body);

    const epic = await prisma.epic.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        color: validatedData.color ?? "#6366f1",
        projectId,
        organizationId,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        status: "open",
      },
    });

    return ok(res, "Epic created successfully", epic);
  }),

  getEpics: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const epics = await prisma.epic.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(res, "Epics fetched successfully", epics);
  }),

  getEpic: asyncHandler(async (req: Request, res: Response) => {
    const epicId = req.params.id as string;

    const epic = await prisma.epic.findUnique({
      where: { id: epicId },
      include: {
        tasks: {
          include: {
            status: true,
            assignee: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    if (!epic) {
      throw new NotFoundException("Epic not found");
    }

    await verifyProjectAccess(req, epic.projectId);

    return ok(res, "Epic details fetched successfully", epic);
  }),

  updateEpic: asyncHandler(async (req: Request, res: Response) => {
    const epicId = req.params.id as string;

    const existingEpic = await prisma.epic.findUnique({
      where: { id: epicId },
    });

    if (!existingEpic) {
      throw new NotFoundException("Epic not found");
    }

    await verifyProjectAccess(req, existingEpic.projectId);
    const validatedData = epicUpdateSchema.parse(req.body);

    const updateData: Record<string, any> = {};
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.color !== undefined) updateData.color = validatedData.color;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.startDate !== undefined) {
      updateData.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null;
    }
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
    }

    const updatedEpic = await prisma.epic.update({
      where: { id: epicId },
      data: updateData,
    });

    return ok(res, "Epic updated successfully", updatedEpic);
  }),

  deleteEpic: asyncHandler(async (req: Request, res: Response) => {
    const epicId = req.params.id as string;

    const epic = await prisma.epic.findUnique({
      where: { id: epicId },
    });

    if (!epic) {
      throw new NotFoundException("Epic not found");
    }

    await verifyProjectAccess(req, epic.projectId);

    // Tasks associated with the deleted epic will have their epicId set to null (due to onDelete: SetNull)
    await prisma.epic.delete({
      where: { id: epicId },
    });

    return ok(res, "Epic deleted successfully");
  }),
};
