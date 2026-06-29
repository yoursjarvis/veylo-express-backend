import { z } from "zod";

export const workspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters long"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters long")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens",
    ),
  icon: z.string().optional(),
});
