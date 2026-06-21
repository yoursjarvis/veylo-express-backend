import { Prisma } from "../../../generated/prisma/client.js";




export type MediaCollection = "avatars" | "documents" | "logos" | (string & {});

export interface Media {
  id: string;
  modelType: string;
  modelId: string;
  collectionName: string;
  name: string;
  fileName: string;
  mimeType: string | null;
  disk: string;
  size: number;
  customProperties: Prisma.JsonValue | null;
  generatedConversions: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
