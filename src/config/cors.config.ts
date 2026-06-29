import { env } from "@/utils/env";

export default {
  origin: env("ALLOWED_ORIGINS").array(","),
  credentials: env("CORS_CREDENTIALS").boolean(true),
};
