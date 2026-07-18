import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ioredis and config with hoisting
const { redisPingMock, onMock, configMock, MockRedis } = vi.hoisted(() => {
  const ping = vi.fn();
  const on = vi.fn();
  class RedisClass {
    ping = ping;
    on = on;
  }
  return {
    redisPingMock: ping,
    onMock: on,
    configMock: vi.fn().mockReturnValue("mock-config-value"),
    MockRedis: RedisClass,
  };
});

vi.mock("ioredis", () => ({
  default: MockRedis,
}));

vi.mock("@/utils/config", () => ({
  config: configMock,
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { healthController } from "@/app/http/controllers/health.controller";
import { prismaMock } from "../../tests/helpers/db";

function createMockReqRes() {
  const req: any = {};
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return { req, res };
}

describe("HealthController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("livez should return status ok", async () => {
    const { req, res } = createMockReqRes();
    await healthController.livez(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "ok" }));
  });

  it("readyz should return status ready if postgres and redis are healthy", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([1]);
    redisPingMock.mockResolvedValueOnce("PONG");

    const { req, res } = createMockReqRes();
    await healthController.readyz(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "ready",
      checks: { postgres: "ok", redis: "ok" },
    }));
  });

  it("readyz should return status 503 if any check fails", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("DB Down"));
    redisPingMock.mockResolvedValueOnce("PONG");

    const { req, res } = createMockReqRes();
    await healthController.readyz(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "not ready",
      error: "DB Down",
    }));
  });

  it("healthz should return status healthy if postgres and redis are healthy", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([1]);
    redisPingMock.mockResolvedValueOnce("PONG");

    const { req, res } = createMockReqRes();
    await healthController.healthz(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "healthy" }));
  });

  it("healthz should return status 500 if check fails", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([1]);
    redisPingMock.mockRejectedValueOnce(new Error("Redis Down"));

    const { req, res } = createMockReqRes();
    await healthController.healthz(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "unhealthy",
      error: "Redis Down",
    }));
  });
});
