
import { config } from "@/utils/config";
import { Queue } from "bullmq";

export type MediaQueuePayload = {
  mediaId: string;
};

export const mediaQueue = new Queue<MediaQueuePayload>("media", {
  connection: {
    host: config("database.redis.host"),
    port: config("database.redis.port"),
    username: config("database.redis.username"),
    password: config("database.redis.password") || undefined,
    maxRetriesPerRequest: null,
  },
});
