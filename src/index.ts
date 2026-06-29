import "dotenv/config"; // Reload watch with new prisma client
import fs from "fs";
import http from "http";
import https from "https";

import app from "@/app";
import "@/app/workers/index";
import "@/monitoring/tracing";
import { webSocketManager } from "@/core/notification";
import { logger } from "@/lib/logger";
import { config } from "@/utils/config";

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

  const server = https.createServer(options, app);
  webSocketManager.init(server);
  server.listen(PORT, () => {
    logger.info(`HTTPS Server running on https://${config("app.domain")}:${PORT}`);
  });
} else {
  const server = http.createServer(app);
  webSocketManager.init(server);
  server.listen(PORT, () => {
    logger.info(`HTTP Server running on http://${config("app.domain")}:${PORT}`);
    if (config("app.env") === "development") {
      logger.warn("SSL certificates not found. Google OAuth might fail for subdomains.");
    }
  });
}
// Trigger tsx watch reload

