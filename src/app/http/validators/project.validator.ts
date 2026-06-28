import { z } from "zod";

export const projectCreateSchema = z.object({
  title: z.string().min(2, "Project title must be at least 2 characters long"),
  projectKey: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Project Key must be at least 2 characters")
    .max(10, "Project Key must be at most 10 characters")
    .regex(/^[A-Z]+$/, "Project Key must contain only letters A-Z (no spaces, numbers, or special characters)"),
  description: z.string().optional(),
  icon: z.string().optional(),
  template: z.string().optional().default("general-project"),
  teamMode: z.string().optional(),
});

export const projectUpdateSchema = z.object({
  title: z.string().min(2, "Project title must be at least 2 characters long").optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  template: z.string().optional(),
  teamMode: z.string().optional(),
});

export const vaultServiceSchema = z.object({
  name: z.string().min(1),
});

export const vaultItemSchema = z.object({
  key: z.string().min(1, "Key name is required"),
  value: z.string().min(1, "Value is required"),
  note: z.string().optional().nullable(),
});

export const updateVaultItemSchema = z.object({
  value: z.string().optional(),
  note: z.string().optional().nullable(),
});
