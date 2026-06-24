import { z } from "zod";

export const milestoneCreateSchema = z.object({
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const milestoneUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  isCompleted: z.boolean().optional(),
});
