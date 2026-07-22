import { z } from "zod";

export const portfolioCreateSchema = z.object({
  name: z.string().min(1, "Name must be at least 1 character").max(255),
  description: z.string().max(1000).optional().nullable(),
  projectIds: z.array(z.string().uuid()).default([]),
});

export const portfolioUpdateSchema = z.object({
  name: z
    .string()
    .min(1, "Name must be at least 1 character")
    .max(255)
    .optional(),
  description: z.string().max(1000).optional().nullable(),
  projectIds: z.array(z.string().uuid()).optional(),
});
