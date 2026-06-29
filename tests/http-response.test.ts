import { describe, expect, it, vi } from "vitest";

import { fail } from "../src/utils/http-response";

describe("http-response", () => {
  it("fail: uses default status code 400", () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);

    const out = fail(res, "Bad");

    expect(out).toBe(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Bad" });
  });

  it("fail: accepts custom status code", () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);

    fail(res, "Nope", 401);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
