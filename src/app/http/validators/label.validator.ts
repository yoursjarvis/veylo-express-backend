import { z } from "zod";

export const labelCreateSchema = z.object({
  name: z.string().min(1, "Label name is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Label color must be a valid hex color code"),
});
