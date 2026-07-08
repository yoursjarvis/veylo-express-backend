import { z } from "zod";

export const objectiveCreateSchema = z.object({
  title: z.string().min(1, "Objective title is required"),
  description: z.string().optional(),
  krTitle: z.string().min(1, "Key Result title is required"),
  krTarget: z.string().min(1, "Target is required"),
  projectId: z.string().uuid("Invalid project ID format"),
  epicId: z.string().uuid("Invalid epic ID format").optional().nullable(),
});

export const objectiveUpdateSchema = z.object({
  title: z.string().min(1, "Objective title is required").optional(),
  description: z.string().optional(),
  krTitle: z.string().min(1, "Key Result title is required").optional(),
  krTarget: z.string().min(1, "Target is required").optional(),
  projectId: z.string().uuid("Invalid project ID format").optional(),
  epicId: z.string().uuid("Invalid epic ID format").optional().nullable(),
});
