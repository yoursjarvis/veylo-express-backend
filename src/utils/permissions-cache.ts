import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

/**
 * Increments the permissions version for a specific user to invalidate their frontend cache.
 */
export async function invalidateUserPermissionsCache(userId: string) {
  try {
    await redis.incr(`user:permissions_version:${userId}`);
  } catch (error) {
    logger.error(
      { error, userId },
      "Failed to invalidate user permissions cache",
    );
  }
}

/**
 * Invalidates cache for all users assigned to a specific role.
 * Used when a role's permissions change or a role is deleted.
 */
export async function invalidateRolePermissionsCache(roleId: string) {
  try {
    const assignments = await prisma.userRoleAssignment?.findMany({
      where: { roleId },
      select: { userId: true },
      distinct: ["userId"],
    });

    if (assignments && assignments.length > 0) {
      const pipeline = redis.pipeline();
      assignments.forEach((assignment) => {
        pipeline.incr(`user:permissions_version:${assignment.userId}`);
      });
      await pipeline.exec();
    }
  } catch (error) {
    logger.error(
      { error, roleId },
      "Failed to invalidate role permissions cache",
    );
  }
}
