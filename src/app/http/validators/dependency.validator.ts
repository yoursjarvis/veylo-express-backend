import { z } from "zod";

export const dependencyCreateSchema = z.object({
  dependencyTaskId: z.string().uuid("Invalid dependency task ID"),
  direction: z.enum(["blocks", "blocked_by"]),
});
