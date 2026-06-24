import { z } from "zod";

export const epicCreateSchema = z.object({
  title: z.string().min(1, "Epic title is required"),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export const epicUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});
