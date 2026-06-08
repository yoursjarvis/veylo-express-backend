import fs from "fs/promises";
import path from "path";
import { StorageDriver } from "../contracts/storage-driver";
import { PutOptions, StorageVisibility } from "../storage.types";
import { config } from "@/utils/config";

export class LocalDriver implements StorageDriver {
  private root: string;
  private publicUrl: string;

  constructor(config: { root: string; publicUrl: string }) {
    this.root = config.root;
    this.publicUrl = config.publicUrl;
  }

  private fullPath(filePath: string): string {
    return path.join(process.cwd(), this.root, filePath);
  }

  async put(filePath: string, contents: Buffer | string, options?: PutOptions): Promise<string> {
    const fullPath = this.fullPath(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, contents);
    return filePath;
  }

  async get(filePath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.fullPath(filePath));
    } catch (error) {
      return null;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(this.fullPath(filePath));
      return true;
    } catch {
      return false;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      if (await this.exists(filePath)) {
        await fs.unlink(this.fullPath(filePath));
      }
    } catch (error) {
      // Ignore errors if file doesn't exist or can't be deleted
    }
  }

  url(filePath: string): string {
    return `${this.publicUrl}/${filePath}`;
  }

  path(filePath: string): string {
    return this.fullPath(filePath);
  }

  async temporaryUrl(filePath: string, expires: Date): Promise<string> {
    // Basic implementation: for local, we just return the public URL for now.
    // In a real app, this would involve a signed route.
    return this.url(filePath);
  }

  async setVisibility(filePath: string, visibility: StorageVisibility): Promise<void> {
    // Local visibility is usually handled by the directory structure (public vs private folders).
    // No-op for now as it depends on how the app serves files.
  }
}
