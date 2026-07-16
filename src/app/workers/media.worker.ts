import fs from "fs/promises";
import path from "path";

import { Worker } from "bullmq";
import { BullMQOtel } from "bullmq-otel";
import sharp from "sharp";

import { type MediaQueuePayload } from "@/app/queues/media.queue";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { config } from "@/utils/config";

export const mediaWorker = new Worker<MediaQueuePayload>(
  "media",
  async (job) => {
    const { mediaId } = job.data;
    const media = await prisma.media.findUnique({ where: { id: mediaId } });

    if (!media || !media.mimeType?.startsWith("image/")) {
      return;
    }

    const root = config("storage.disks.local.root");
    const relativePath = path.join(
      media.modelType,
      media.collectionName,
      media.fileName,
    );
    const fullPath = path.join(process.cwd(), root, relativePath);

    try {
      const buffer = await fs.readFile(fullPath);
      const thumbFileName = `thumb-${media.fileName}`;
      const thumbRelativePath = path.join(
        media.modelType,
        media.collectionName,
        "conversions",
        thumbFileName,
      );
      const thumbFullPath = path.join(process.cwd(), root, thumbRelativePath);

      await fs.mkdir(path.dirname(thumbFullPath), { recursive: true });

      await sharp(buffer)
        .resize(200, 200, { fit: "inside", withoutEnlargement: true })
        .toFile(thumbFullPath);

      const generatedConversions =
        (media.generatedConversions as Record<
          string,
          { fileName: string; size: number }
        >) || {};
      generatedConversions.thumb = {
        fileName: thumbFileName,
        size: (await fs.stat(thumbFullPath)).size,
      };

      await prisma.media.update({
        where: { id: mediaId },
        data: {
          generatedConversions,
        },
      });

      logger.info(
        { mediaId, conversion: "thumb" },
        "[MEDIA] Conversion generated",
      );
    } catch (error) {
      logger.error({ error, mediaId }, "[MEDIA] Conversion failed");
      throw error;
    }
  },
  {
    connection: {
      host: config("database.redis.host"),
      port: config("database.redis.port"),
      username: config("database.redis.username"),
      password: config("database.redis.password") || undefined,
      maxRetriesPerRequest: null,
    },
    prefix: config("queue.media.prefix"),
    concurrency: 5,
    telemetry: new BullMQOtel(),
  },
);
