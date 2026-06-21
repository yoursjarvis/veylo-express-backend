import { env } from "@/utils/env";

const disks = ["local", "s3", "r2", "uploadthing"] as const;
type Disk = (typeof disks)[number];

export default {
  default: env("STORAGE_DISK").enum(disks, "local" satisfies Disk),

  disks: {
    local: {
      root: env("STORAGE_LOCAL_ROOT").string("storage/app"),
      publicUrl: env("STORAGE_LOCAL_PUBLIC_URL").string(
        `${env("APP_URL").string("http://localhost:4000")}/storage`,
      ),
    },

    public: {
      root: env("STORAGE_PUBLIC_ROOT").string("storage/app/public"),
      publicUrl: env("STORAGE_PUBLIC_URL").string(
        `${env("APP_URL").string("http://localhost:4000")}/storage`,
      ),
    },

    s3: {
      key: env("AWS_ACCESS_KEY_ID").raw(),
      secret: env("AWS_SECRET_ACCESS_KEY").raw(),
      region: env("AWS_DEFAULT_REGION").string("us-east-1"),
      bucket: env("AWS_BUCKET").raw(),
      url: env("AWS_URL").raw(),
      endpoint: env("AWS_ENDPOINT").raw(),
      usePathStyleEndpoint: env("AWS_USE_PATH_STYLE_ENDPOINT").boolean(false),
    },

    r2: {
      key: env("R2_ACCESS_KEY_ID").raw(),
      secret: env("R2_SECRET_ACCESS_KEY").raw(),
      bucket: env("R2_BUCKET").raw(),
      endpoint: env("R2_ENDPOINT").raw(),
      region: env("R2_REGION").string("auto"),
      publicUrl: env("R2_PUBLIC_URL").raw(),
    },

    uploadthing: {
      token: env("UPLOADTHING_TOKEN").raw() || env("UPLOADTHING_SECRET").raw(),
    },
  },
};
