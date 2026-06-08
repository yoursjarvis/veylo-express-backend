export type StorageVisibility = "public" | "private";

export interface PutOptions {
  visibility?: StorageVisibility;
  contentType?: string;
}
