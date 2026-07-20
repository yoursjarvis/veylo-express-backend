import { test, vi } from "vitest";
import { config } from "@/utils/config";

const { betterAuthConfig, orgPluginConfig } = vi.hoisted(() => ({
  betterAuthConfig: {} as any,
  orgPluginConfig: {} as any,
}));

vi.mock("better-auth", () => ({
  betterAuth: vi.fn((config) => {
    Object.assign(betterAuthConfig, config);
    return {};
  }),
}));

vi.mock("@/utils/config", () => ({
  config: vi.fn(() => "mocked")
}));

import "@/lib/auth/auth";

test("debug", () => {
  console.log("KEYS:", Object.keys(betterAuthConfig));
  console.log("DB_HOOKS:", betterAuthConfig.databaseHooks);
});
