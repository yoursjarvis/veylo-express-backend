import { mediaQueue } from "@/app/queues/media.queue";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { config } from "@/utils/config";
import type { MediaCollection, UploadedFile } from "./media.types";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export class MediaService {
  async addMedia(
    modelType: string,
    modelId: string,
    file: UploadedFile,
    collectionName: MediaCollection = "default",
    replace: boolean = false
  ) {
    if (replace) {
      const existingMedia = await prisma.media.findMany({
        where: { modelType, modelId, collectionName },
      });
      for (const media of existingMedia) {
        await this.deleteMedia(media.id);
      }
    }

    const disk = config("storage.default");
    const id = crypto.randomUUID();
    const fileName = `${id}-${file.originalname}`;
    const relativePath = path.join(modelType, collectionName, fileName);

    
    // Store file (Local storage implementation for now)
    if (disk === "local") {
      const root = config("storage.disks.local.root");
      const fullPath = path.join(process.cwd(), root, relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.buffer);
    } else {
        // TODO: S3 implementation if needed
        throw new Error(`Disk ${disk} not implemented yet`);
    }

    const media = await prisma.media.create({
      data: {
        modelType,
        modelId,
        collectionName,
        name: path.parse(file.originalname).name,
        fileName,
        mimeType: file.mimetype,
        disk,
        size: file.size,
      },
    });

    // Dispatch conversion job
    try {
      await mediaQueue.add("process", { mediaId: media.id });
    } catch (error) {
      logger.error({ error, mediaId: media.id }, "[MEDIA] Failed to queue conversion");
    }

    return media;
  }

  async getMedia(modelType: string, modelId: string, collectionName?: string) {
    return prisma.media.findMany({
      where: {
        modelType,
        modelId,
        ...(collectionName ? { collectionName } : {}),
      },
      orderBy: {
        orderColumn: "asc",
      },
    });
  }

  async deleteMedia(mediaId: string) {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return;

    // Delete file from disk
    if (media.disk === "local") {
      const root = config("storage.disks.local.root");
      const relativePath = path.join(media.modelType, media.collectionName, media.fileName);
      const fullPath = path.join(process.cwd(), root, relativePath);
      try {
        await fs.unlink(fullPath);
      } catch (error) {
        logger.error({ error, fullPath }, "[MEDIA] Failed to delete file");
      }

      // Delete conversions
      const conversions = (media.generatedConversions as Record<string, any>) || {};
      for (const conversion of Object.values(conversions)) {
        if (conversion.fileName) {
          const conversionPath = path.join(process.cwd(), root, media.modelType, media.collectionName, "conversions", conversion.fileName);
          try {
            await fs.unlink(conversionPath);
          } catch (error) {
            // Ignore if conversion doesn't exist
          }
        }
      }
    }

    await prisma.media.delete({ where: { id: mediaId } });
  }

  async getUrl(mediaId: string): Promise<string | null> {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return null;

    if (media.disk === "local") {
      const baseUrl = config("storage.disks.local.publicUrl");
      return `${baseUrl}/${media.modelType}/${media.collectionName}/${media.fileName}`;
    }

    return null;
  }
}

export const mediaService = new MediaService();
