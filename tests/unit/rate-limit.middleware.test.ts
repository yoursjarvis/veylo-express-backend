import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { configMock, envState } = vi.hoisted(() => {
  const state = { envValue: "test" };
  return {
    envState: state,
    configMock: vi.fn().mockImplementation((key: string) => {
      if (key === "app.env") return state.envValue;
      return undefined;
    }),
  };
});

vi.mock("../../src/utils/config", () => ({
  config: configMock,
}));

vi.mock("rate-limiter-flexible", async () => {
  const actual = await vi.importActual<unknown>("rate-limiter-flexible");
  return {
    ...actual,
    RateLimiterRedis: actual.RateLimiterMemory,
  };
});

import { rateLimit } from "../../src/app/http/middlewares/rate-limit.middleware";

describe("rate-limit middleware", () => {
  beforeEach(() => {
    envState.envValue = "test";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("UT-RL-01: bypasses rate limiting entirely when env is test", async () => {
    const middleware = rateLimit({
      keyPrefix: "test:prefix",
      windowMs: 1000,
      max: 2,
      key: () => "user-ip",
    });

    const req: unknown = {};
    const res: unknown = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    // Call 5 times - in "test" env, it should always call next()
    for (let i = 0; i < 5; i++) {
      await middleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("UT-RL-02: blocks requests (returns 429) when limit is exceeded in non-test env", async () => {
    envState.envValue = "development"; // Enable rate limiting

    const middleware = rateLimit({
      keyPrefix: "dev:prefix",
      windowMs: 1000,
      max: 2,
      key: () => "user-1",
    });

    const req: unknown = {};
    const res: unknown = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    // 1st request - allowed
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // 2nd request - allowed
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);

    // 3rd request - blocked
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(2); // still 2
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Retry-After",
      expect.any(Number),
    );
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Too many requests",
    });
  });

  it("UT-RL-03: resets request count and allows requests after windowMs expires", async () => {
    envState.envValue = "production";

    const middleware = rateLimit({
      keyPrefix: "prod:prefix",
      windowMs: 2000, // 2 seconds
      max: 1,
      key: () => "user-2",
    });

    const req: unknown = {};
    const res: unknown = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    // 1st request - allowed
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // 2nd request - blocked immediately
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1); // blocked
    expect(res.status).toHaveBeenCalledWith(429);

    // Advance time by 2.1 seconds (past the windowMs)
    vi.advanceTimersByTime(2100);

    // 3rd request - allowed again after window expiry
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(2); // allowed
  });
});
