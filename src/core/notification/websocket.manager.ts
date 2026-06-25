import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { auth } from "@/lib/auth/auth";
import { fromNodeHeaders } from "better-auth/node";
import { logger } from "@/lib/logger";
import { config } from "@/utils/config";
import Redis from "ioredis";

export class WebSocketManager {
  private static instance: WebSocketManager;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<WebSocket>> = new Map();
  private subRedis: Redis | null = null;
  private pubRedis: Redis | null = null;

  private constructor() {}

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Initialize the WebSocket Server and attach it to the HTTP/HTTPS server.
   */
  public init(server: Server): void {
    if (this.wss) {
      logger.warn("[WEBSOCKET] Server already initialized");
      return;
    }

    this.wss = new WebSocketServer({ noServer: true });

    // Initialize Redis subscription if broadcast driver is redis
    const broadcastDriver = config("notification.broadcast.driver");
    if (broadcastDriver === "redis") {
      this.initRedisPubSub();
    }

    // Handle WebSocket upgrade requests
    server.on("upgrade", async (request, socket, head) => {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      if (url.pathname !== "/ws/notifications") {
        return; // Allow other paths or upgrade handlers
      }

      try {
        // Authenticate request using Better Auth
        const headers = fromNodeHeaders(request.headers);
        const result = await auth.api.getSession({
          headers,
        });

        if (!result || !result.user) {
          logger.warn("[WEBSOCKET][auth] Unauthorized connection attempt");
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        const userId = result.user.id;

        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit("connection", ws, userId);
        });
      } catch (error) {
        logger.error({ error }, "[WEBSOCKET][upgrade] Error authenticating upgrade request");
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
      }
    });

    this.wss.on("connection", (ws: WebSocket, userId: string) => {
      logger.info({ userId }, "[WEBSOCKET] Client connected successfully");

      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId)!.add(ws);

      ws.on("close", () => {
        logger.info({ userId }, "[WEBSOCKET] Client connection closed");
        const userSockets = this.clients.get(userId);
        if (userSockets) {
          userSockets.delete(ws);
          if (userSockets.size === 0) {
            this.clients.delete(userId);
          }
        }
      });

      ws.on("error", (error) => {
        logger.error({ error, userId }, "[WEBSOCKET] Connection error");
      });

      // Keep connection alive
      let isAlive = true;
      ws.on("pong", () => {
        isAlive = true;
      });

      const interval = setInterval(() => {
        if (!isAlive) {
          ws.terminate();
          clearInterval(interval);
          return;
        }
        isAlive = false;
        ws.ping();
      }, 30000);

      ws.on("close", () => {
        clearInterval(interval);
      });
    });
  }

  /**
   * Set up Redis Pub/Sub for horizontal scalability.
   */
  private initRedisPubSub(): void {
    const redisOptions = {
      host: config("database.redis.host"),
      port: config("database.redis.port"),
      username: config("database.redis.username"),
      password: config("database.redis.password") || undefined,
      keyPrefix: config("database.redis.prefix"),
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
    };

    this.subRedis = new Redis(redisOptions);
    this.pubRedis = new Redis(redisOptions);

    const channelName = config("notification.broadcast.channel");

    this.subRedis.on("error", (error) => {
      logger.error({ error }, "[WEBSOCKET][redis-sub] Connection error");
    });
    this.pubRedis.on("error", (error) => {
      logger.error({ error }, "[WEBSOCKET][redis-pub] Connection error");
    });

    // Handle messages received from Redis Pub/Sub
    this.subRedis.on("message", (channel, message) => {
      if (channel === channelName) {
        try {
          const { userId, event, data } = JSON.parse(message);
          if (userId) {
            this.sendLocalToUser(userId, event, data);
          } else {
            this.sendLocalToAll(event, data);
          }
        } catch (error) {
          logger.error({ error, message }, "[WEBSOCKET][redis-sub] Failed to parse message");
        }
      }
    });

    void this.subRedis.subscribe(channelName).then(() => {
      logger.info({ channel: channelName }, "[WEBSOCKET][redis-sub] Subscribed to Redis channel");
    });
  }

  /**
   * Send a message locally to all connected sockets of a user.
   */
  private sendLocalToUser(userId: string, event: string, data: any): void {
    const userSockets = this.clients.get(userId);
    if (!userSockets || userSockets.size === 0) {
      return;
    }

    const payload = JSON.stringify({ event, data });
    for (const ws of userSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Send a message locally to all connected sockets.
   */
  private sendLocalToAll(event: string, data: any): void {
    const payload = JSON.stringify({ event, data });
    this.clients.forEach((userSockets) => {
      for (const ws of userSockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    });
  }

  /**
   * Broadcast a message to a specific user.
   */
  public broadcastToUser(userId: string, event: string, data: any): void {
    const broadcastDriver = config("notification.broadcast.driver");

    if (broadcastDriver === "redis" && this.pubRedis) {
      const channelName = config("notification.broadcast.channel");
      const payload = JSON.stringify({ userId, event, data });
      void this.pubRedis.publish(channelName, payload);
    } else {
      this.sendLocalToUser(userId, event, data);
    }
  }

  /**
   * Broadcast a message to all users.
   */
  public broadcastToAll(event: string, data: any): void {
    const broadcastDriver = config("notification.broadcast.driver");

    if (broadcastDriver === "redis" && this.pubRedis) {
      const channelName = config("notification.broadcast.channel");
      const payload = JSON.stringify({ event, data });
      void this.pubRedis.publish(channelName, payload);
    } else {
      this.sendLocalToAll(event, data);
    }
  }
}

export const webSocketManager = WebSocketManager.getInstance();
