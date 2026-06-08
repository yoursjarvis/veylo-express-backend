import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageDriver } from "../contracts/storage-driver";
import { PutOptions, StorageVisibility } from "../storage.types";

export interface S3DriverConfig {
  key: string;
  secret: string;
  region: string;
  bucket: string;
  endpoint?: string;
  usePathStyleEndpoint?: boolean;
  publicUrl?: string;
  supportsAcl?: boolean;
}

export class S3Driver implements StorageDriver {
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;
  private supportsAcl: boolean;

  constructor(config: S3DriverConfig) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.key,
        secretAccessKey: config.secret,
      },
      endpoint: config.endpoint,
      forcePathStyle: config.usePathStyleEndpoint,
    });
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;
    this.supportsAcl = config.supportsAcl ?? true;
  }

  async put(path: string, contents: Buffer | string, options?: PutOptions): Promise<string> {
    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: path,
      Body: contents,
      ContentType: options?.contentType,
    };

    if (this.supportsAcl && options?.visibility) {
      params.ACL = options.visibility === "public" ? "public-read" : "private";
    }

    await this.client.send(new PutObjectCommand(params));
    return path;
  }

  async get(path: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: path,
        }),
      );

      if (!response.Body) return null;
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error) {
      return null;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: path,
        }),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async delete(path: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
  }

  url(path: string): string {
    if (this.publicUrl) {
      const baseUrl = this.publicUrl.endsWith("/")
        ? this.publicUrl.slice(0, -1)
        : this.publicUrl;
      return `${baseUrl}/${path}`;
    }
    // Default S3 URL format
    return `https://${this.bucket}.s3.${this.client.config.region}.amazonaws.com/${path}`;
  }

  path(path: string): string {
    throw new Error("This driver does not support retrieving paths.");
  }

  async temporaryUrl(path: string, expires: Date): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    const expiresIn = Math.max(
      1,
      Math.floor((expires.getTime() - Date.now()) / 1000),
    );
    return await getSignedUrl(this.client, command, { expiresIn });
  }

  async setVisibility(
    path: string,
    visibility: StorageVisibility,
  ): Promise<void> {
    if (!this.supportsAcl) return;
    // For S3, we would typically use PutObjectAclCommand.
    // For now, let's just note that R2/S3 without ACL support won't do anything here.
  }
}
