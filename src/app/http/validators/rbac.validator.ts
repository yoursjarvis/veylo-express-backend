import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters"),
  organizationId: z.string().uuid("Invalid organization ID"),
  permissionIds: z.array(z.string().uuid()).default([]),
});

export const updateRoleSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  scopeType: z.enum(["ORGANIZATION", "PROJECT"]),
  scopeId: z.string().uuid(),
});
