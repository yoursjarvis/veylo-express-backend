import { z } from "zod";

export const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  statusId: z.uuid("Invalid status ID"),
  sprintId: z.uuid().optional().nullable(),
  epicId: z.uuid().optional().nullable(),
  milestoneId: z.uuid().optional().nullable(),
  type: z.enum(["task", "bug", "feature", "subtask"]).default("task"),
  priority: z
    .enum(["lowest", "low", "medium", "high", "highest", "urgent"])
    .optional()
    .default("medium"),
  estimate: z.number().optional().nullable(),
  estimatedPoints: z.number().int().nonnegative().optional().default(0),
  awardedPoints: z.number().int().nonnegative().optional().default(0),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.uuid().optional().nullable(),
  reporterId: z.uuid().optional().nullable(),
  parentTaskId: z.uuid().optional().nullable(),
  position: z.number().optional(),
  customFields: z.record(z.string(), z.any()).optional().default({}),
  labelIds: z.array(z.uuid()).optional(),
  isPrivate: z.boolean().optional().default(false),
});

export const taskUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional().nullable(),
  statusId: z.uuid("Invalid status ID").optional(),
  sprintId: z.uuid().optional().nullable(),
  epicId: z.uuid().optional().nullable(),
  milestoneId: z.uuid().optional().nullable(),
  type: z.enum(["task", "bug", "feature", "subtask"]).optional(),
  priority: z.enum(["lowest", "low", "medium", "high", "highest", "urgent"]).optional(),
  estimate: z.number().optional().nullable(),
  estimatedPoints: z.number().int().nonnegative().optional(),
  awardedPoints: z.number().int().nonnegative().optional(),
  dueDate: z.iso.datetime().optional().nullable(),
  startDate: z.iso.datetime().optional().nullable(),
  assigneeId: z.uuid().optional().nullable(),
  reporterId: z.uuid().optional().nullable(),
  position: z.number().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  labelIds: z.array(z.uuid()).optional(),
  isPrivate: z.boolean().optional(),
});
