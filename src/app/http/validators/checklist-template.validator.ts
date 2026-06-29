import { z } from "zod";

export const checklistTemplateCreateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional().nullable(),
  items: z
    .array(z.string().min(1, "Item cannot be empty"))
    .min(1, "Must have at least one item"),
  workspaceId: z.string().uuid("Invalid workspace ID"),
  organizationId: z.string().uuid("Invalid organization ID"),
});

export const checklistTemplateUpdateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  description: z.string().optional().nullable(),
  items: z.array(z.string().min(1, "Item cannot be empty")).optional(),
});
