import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters"),
  organizationId: z.string().uuid("Invalid organization ID"),
  permissionIds: z.array(z.string().uuid()).default([]),
  bypassPermissions: z.boolean().optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters").optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
  bypassPermissions: z.boolean().optional(),
});

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleIds: z.array(z.string().uuid()),
  scopeType: z.enum([
    "SYSTEM",
    "ORGANIZATION",
    "WORKSPACE",
    "DEPARTMENT",
    "PROJECT",
  ]),
  scopeId: z.string().uuid(),
});

export const updateRoleHierarchySchema = z.object({
  roleIds: z.array(z.string().uuid()),
  organizationId: z.string().uuid(),
});
