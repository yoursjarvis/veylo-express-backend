import { env } from "@/utils/env";

export default {
  collector: {
    url: env("OTEL_COLLECTOR_URL").string("http://otel-collector:4317"),
  },
};
