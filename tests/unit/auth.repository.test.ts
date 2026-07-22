import { describe, it, expect, vi } from "vitest";
import { authRepository } from "@/app/repositories/auth.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("AuthRepository", () => {
  it("should find user by email", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "test@example.com",
    });
    const result = await authRepository.findUserByEmail("test@example.com");
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
    expect(result?.id).toBe("user-1");
  });

  it("should mark login success", async () => {
    const now = new Date();
    prismaMock.user.update.mockResolvedValueOnce({
      id: "user-1",
      lastLoginAt: now,
    });
    const result = await authRepository.markLoginSuccess("user-1", now);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        lastLoginAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    expect(result.id).toBe("user-1");
  });

  it("should mark login failure for non-existent user best effort", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const result = await authRepository.markLoginFailure(
      "nonexistent@example.com",
    );
    expect(result).toBeUndefined();
  });

  it("should mark login failure without locking if attempts < 5", async () => {
    const user = {
      id: "user-1",
      email: "test@example.com",
      failedLoginAttempts: 2,
    };
    prismaMock.user.findUnique.mockResolvedValueOnce(user);
    prismaMock.user.update.mockResolvedValueOnce({
      id: "user-1",
      failedLoginAttempts: 3,
    });

    const now = new Date();
    await authRepository.markLoginFailure("test@example.com", now);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        failedLoginAttempts: 3,
        lockedUntil: null,
      },
    });
  });

  it("should lock user if attempts >= 5", async () => {
    const user = {
      id: "user-1",
      email: "test@example.com",
      failedLoginAttempts: 4,
    };
    prismaMock.user.findUnique.mockResolvedValueOnce(user);
    prismaMock.user.update.mockResolvedValueOnce({
      id: "user-1",
      failedLoginAttempts: 5,
    });

    const now = new Date();
    const expectedLockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
    await authRepository.markLoginFailure("test@example.com", now);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        failedLoginAttempts: 5,
        lockedUntil: expectedLockedUntil,
      },
    });
  });

  it("should update session metadata by token", async () => {
    prismaMock.session.updateMany.mockResolvedValueOnce({ count: 1 });
    const meta = { ipAddress: "127.0.0.1", browser: "Chrome" };
    const result = await authRepository.updateSessionMetadataByToken(
      "token-123",
      meta,
    );
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
      where: { token: "token-123" },
      data: meta,
    });
    expect(result.count).toBe(1);
  });

  it("should revoke session by id for user", async () => {
    prismaMock.session.updateMany.mockResolvedValueOnce({ count: 1 });
    const now = new Date();
    const result = await authRepository.revokeSessionByIdForUser(
      "sess-1",
      "user-1",
      now,
    );
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
      where: { id: "sess-1", userId: "user-1" },
      data: { revokedAt: now },
    });
    expect(result.count).toBe(1);
  });
});
