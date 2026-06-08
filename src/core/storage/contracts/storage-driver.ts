import { PutOptions, StorageVisibility } from "../storage.types";

export interface StorageDriver {
  put(path: string, contents: Buffer | string, options?: PutOptions): Promise<string>;
  get(path: string): Promise<Buffer | null>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  url(path: string): string;
  path(path: string): string;
  temporaryUrl(path: string, expires: Date): Promise<string>;
  setVisibility(path: string, visibility: StorageVisibility): Promise<void>;
}
