import { config } from "@/utils/config";
import { StorageDriver } from "./contracts/storage-driver";
import { LocalDriver } from "./drivers/local.driver";
import { S3Driver } from "./drivers/s3.driver";
import { PutOptions, StorageVisibility } from "./storage.types";

export class StorageService {
  private drivers: Map<string, StorageDriver> = new Map();

  /**
   * Get a disk instance.
   */
  disk(name?: string): StorageDriver {
    const diskName = (name || config("storage.default")) as string;

    if (this.drivers.has(diskName)) {
      return this.drivers.get(diskName)!;
    }

    const driver = this.createDriver(diskName);
    this.drivers.set(diskName, driver);
    return driver;
  }

  /**
   * Create a new driver instance.
   */
  private createDriver(name: string): StorageDriver {
    switch (name) {
      case "local":
        return new LocalDriver({
          root: config("storage.disks.local.root")!,
          publicUrl: config("storage.disks.local.publicUrl")!,
        });
      case "public":
        return new LocalDriver({
          root: config("storage.disks.public.root")!,
          publicUrl: config("storage.disks.public.publicUrl")!,
        });
      case "s3":
        return new S3Driver({
          key: config("storage.disks.s3.key")!,
          secret: config("storage.disks.s3.secret")!,
          region: config("storage.disks.s3.region")!,
          bucket: config("storage.disks.s3.bucket")!,
          endpoint: config("storage.disks.s3.endpoint"),
          usePathStyleEndpoint: config("storage.disks.s3.usePathStyleEndpoint"),
          publicUrl: config("storage.disks.s3.url"),
        });
      case "r2":
        return new S3Driver({
          key: config("storage.disks.r2.key")!,
          secret: config("storage.disks.r2.secret")!,
          region: config("storage.disks.r2.region")!,
          bucket: config("storage.disks.r2.bucket")!,
          endpoint: config("storage.disks.r2.endpoint"),
          usePathStyleEndpoint: true,
          publicUrl: config("storage.disks.r2.publicUrl"),
          supportsAcl: false,
        });
      default:
        throw new Error(`Storage driver [${name}] is not supported.`);
    }
  }

  /**
   * Store the given contents.
   */
  async put(
    path: string,
    contents: Buffer | string,
    options?: PutOptions,
  ): Promise<string> {
    return this.disk().put(path, contents, options);
  }

  /**
   * Get the contents of a file.
   */
  async get(path: string): Promise<Buffer | null> {
    return this.disk().get(path);
  }

  /**
   * Determine if a file exists.
   */
  async exists(path: string): Promise<boolean> {
    return this.disk().exists(path);
  }

  /**
   * Delete the file at a given path.
   */
  async delete(path: string): Promise<void> {
    return this.disk().delete(path);
  }

  /**
   * Get the URL for the file at the given path.
   */
  url(path: string): string {
    return this.disk().url(path);
  }

  /**
   * Get the full path for the file at the given path.
   */
  path(path: string): string {
    return this.disk().path(path);
  }

  /**
   * Get a temporary URL for the file at the given path.
   */
  async temporaryUrl(path: string, expires: Date): Promise<string> {
    return this.disk().temporaryUrl(path, expires);
  }

  /**
   * Set the visibility for the given path.
   */
  async setVisibility(
    path: string,
    visibility: StorageVisibility,
  ): Promise<void> {
    return this.disk().setVisibility(path, visibility);
  }
}

export const storage = new StorageService();
