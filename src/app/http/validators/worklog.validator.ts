import { z } from "zod";

export const workLogCreateSchema = z.object({
  hoursLogged: z.number().positive("Hours logged must be greater than zero"),
  loggedAt: z.string().datetime().optional(),
  description: z.string().optional().nullable(),
});

export const workLogUpdateSchema = z.object({
  hoursLogged: z
    .number()
    .positive("Hours logged must be greater than zero")
    .optional(),
  loggedAt: z.string().datetime().optional(),
  description: z.string().optional().nullable(),
});
