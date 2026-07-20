import { z } from "zod";

export const createDocSchema = z.object({
  title: z.string().min(1, "Title is required"),
  parentId: z.string().uuid().optional().nullable(),
  emoji: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  content: z.unknown().optional(),
  plainText: z.string().optional().nullable(),
});

export const updateDocSchema = z.object({
  title: z.string().min(1).optional(),
  parentId: z.string().uuid().optional().nullable(),
  emoji: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  content: z.unknown().optional(),
  plainText: z.string().optional().nullable(),
  order: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export const favoriteSchema = z.object({
  isFavorite: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export const commentSchema = z.object({
  content: z.string().min(1, "Comment content cannot be empty"),
  parentId: z.string().uuid("Parent ID must be a valid UUID").nullable().optional(),
});

export const commentUpdateSchema = z.object({
  content: z.string().min(1).optional(),
  resolved: z.boolean().optional(),
});

export const docPermissionSchema = z.object({
  userId: z.string().uuid("User ID must be a valid UUID"),
  permission: z.enum(["view", "comment", "edit"]),
});
