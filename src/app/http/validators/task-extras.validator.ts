import { z } from "zod";

export const statusSchema = z.object({
  name: z.string().min(1, "Status name is required"),
  category: z.enum(["backlog", "todo", "in_progress", "done"]),
  order: z.number().int().optional().default(0),
  color: z.string().optional(),
  progressWeight: z.number().int().min(0).max(100).optional().default(0),
});

export const statusUpdateSchema = z.object({
  name: z.string().min(1, "Status name is required").optional(),
  category: z.enum(["backlog", "todo", "in_progress", "done"]).optional(),
  order: z.number().int().optional(),
  color: z.string().optional(),
  progressWeight: z.number().int().min(0).max(100).optional(),
});

export const subtaskSchema = z.object({
  title: z.string().min(1, "Subtask title is required"),
  assigneeId: z.string().uuid().optional().nullable(),
  statusId: z.string().uuid().optional(),
  isCompleted: z.boolean().optional(),
});

export const commentSchema = z.object({
  content: z.string().min(1, "Comment content cannot be empty"),
  parentId: z.string().uuid().optional().nullable(),
});

export const customFieldSchema = z.object({
  name: z.string().min(1, "Field name is required"),
  type: z.enum(["text", "number", "date", "select", "checkbox"]),
  options: z.array(z.string()).optional().nullable(),
});

export const commentReactionSchema = z.object({
  emoji: z.string().min(1, "Emoji is required"),
});
