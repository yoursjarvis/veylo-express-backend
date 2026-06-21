import "dotenv/config";
import fs from "fs";
import https from "https";
import http from "http";

import app from "@/app";
import "@/app/workers/index";
import "@/monitoring/tracing";
import { config } from "@/utils/config";
import { logger } from "@/lib/logger";

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught Exception");
  process.exit(1);
});

const PORT = config("app.port");
const SSL_KEY = process.env.SSL_KEY_PATH;
const SSL_CRT = process.env.SSL_CRT_PATH;

if (SSL_KEY && SSL_CRT && fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CRT)) {
  const options = {
    key: fs.readFileSync(SSL_KEY),
    cert: fs.readFileSync(SSL_CRT),
  };

  https.createServer(options, app).listen(PORT, () => {
    logger.info(`HTTPS Server running on https://${config("app.domain")}:${PORT}`);
  });
} else {
  http.createServer(app).listen(PORT, () => {
    logger.info(`HTTP Server running on http://${config("app.domain")}:${PORT}`);
    if (config("app.env") === "development") {
      logger.warn("SSL certificates not found. Google OAuth might fail for subdomains.");
    }
  });
}
