import { config } from "@/utils/config";
import pino from "pino";

export const logger = pino({
  level: config("app.debug") === true ? "debug" : "info",
  redact: {
    paths: [
      "password",
      "token",
      "authorization",
      "cookie",
      "*.password",
      "*.token",
    ],
    remove: false,
  },
  transport:
    config("app.env") !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: true,
          },
        }
      : undefined,
});
