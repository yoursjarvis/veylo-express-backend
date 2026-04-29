import { env } from "@/utils/env";

export default {
  name: env("APP_NAME").string("Veylo API"),
  env: env("NODE_ENV").enum(
    ["development", "production", "test"] as const,
    "development"
  ),
  debug: env("APP_DEBUG").boolean(false),
  port: env("PORT").int(4000),
  url: env("APP_URL").url("http://localhost:4000"),
  rateLimit: env("RATE_LIMIT").float(1.5),
  origins: env("ALLOWED_ORIGINS").array(",")
};
