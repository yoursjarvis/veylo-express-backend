import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { verifyProjectAccess } from "@/app/http/middlewares/project-access.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { z } from "zod";
import { NotFoundException, BadRequestException } from "@/utils/app-error";

const labelCreateSchema = z.object({
  name: z.string().min(1, "Label name is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Label color must be a valid hex color code"),
});

export const labelController = {
  createLabel: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { project } = await verifyProjectAccess(req, projectId);
    const { organizationId } = project;

    const validatedData = labelCreateSchema.parse(req.body);

    const existingLabel = await prisma.label.findUnique({
      where: {
        projectId_name: {
          projectId,
          name: validatedData.name,
        },
      },
    });

    if (existingLabel) {
      throw new BadRequestException("Label with this name already exists in the project");
    }

    const label = await prisma.label.create({
      data: {
        name: validatedData.name,
        color: validatedData.color,
        projectId,
        organizationId,
      },
    });

    return ok(res, "Label created successfully", label);
  }),

  getLabels: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    await verifyProjectAccess(req, projectId);

    const labels = await prisma.label.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });

    return ok(res, "Labels fetched successfully", labels);
  }),

  updateLabel: asyncHandler(async (req: Request, res: Response) => {
    const labelId = req.params.id as string;

    const label = await prisma.label.findUnique({
      where: { id: labelId },
    });

    if (!label) {
      throw new NotFoundException("Label not found");
    }

    await verifyProjectAccess(req, label.projectId);

    const validatedData = labelCreateSchema.partial().parse(req.body);

    if (validatedData.name) {
      const existingLabel = await prisma.label.findFirst({
        where: {
          projectId: label.projectId,
          name: validatedData.name,
          id: { not: labelId },
        },
      });
      if (existingLabel) {
        throw new BadRequestException("Label with this name already exists in the project");
      }
    }

    const updated = await prisma.label.update({
      where: { id: labelId },
      data: validatedData,
    });

    return ok(res, "Label updated successfully", updated);
  }),

  deleteLabel: asyncHandler(async (req: Request, res: Response) => {
    const labelId = req.params.id as string;

    const label = await prisma.label.findUnique({
      where: { id: labelId },
    });

    if (!label) {
      throw new NotFoundException("Label not found");
    }

    await verifyProjectAccess(req, label.projectId);

    await prisma.label.delete({
      where: { id: labelId },
    });

    return ok(res, "Label deleted successfully");
  }),
};
