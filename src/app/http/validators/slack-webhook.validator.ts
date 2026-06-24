import { z } from "zod";

export const webhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  channel: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});
