import { env } from "@/utils/env";

export default {
  postgress: {
    url: env("DATABASE_URL").required(),
  },
  redis: {
    host: env("REDIS_HOST").string("localhost"),
    port: env("REDIS_PORT").number(6379),
    username: env("REDIS_USERNAME").string("default"),
    password: env("REDIS_PASSWORD").raw(),
    prefix: env("REDIS_PREFIX").string("veylo_redis_local"),
  },
};
