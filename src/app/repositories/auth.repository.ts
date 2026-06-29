import prisma from "@/lib/prisma";

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  markLoginSuccess(userId: string, now = new Date()) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  },

  async markLoginFailure(email: string, now = new Date()) {
    // To avoid user enumeration, this is intentionally "best effort".
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const failed = user.failedLoginAttempts + 1;
    const lockAfter = 5;
    const lockMinutes = 15;
    const lockedUntil =
      failed >= lockAfter
        ? new Date(now.getTime() + lockMinutes * 60 * 1000)
        : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: failed,
        lockedUntil,
      },
    });
  },

  updateSessionMetadataByToken(
    token: string,
    data: {
      deviceName?: string;
      browser?: string;
      os?: string;
      ipAddress?: string;
      userAgent?: string;
      lastActiveAt?: Date;
    },
  ) {
    return prisma.session.updateMany({
      where: { token },
      data,
    });
  },

  revokeSessionByIdForUser(
    sessionId: string,
    userId: string,
    now = new Date(),
  ) {
    return prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: now },
    });
  },
};
