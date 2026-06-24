import { z } from "zod";

export const sprintCreateSchema = z.object({
  name: z.string().min(1, "Sprint name is required"),
  goal: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export const sprintUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  status: z.enum(["planned", "active", "completed"]).optional(),
  uncompletedTasksDestination: z.string().uuid().optional().nullable(), // Next sprint ID or null (backlog)
});
