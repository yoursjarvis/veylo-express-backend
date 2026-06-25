import { env } from "@/utils/env";

const channels = env("NOTIFICATION_CHANNELS").array();

export default {
  default: channels.length > 0 ? channels : ["database"],
  broadcast: {
    driver: env("NOTIFICATION_BROADCAST_DRIVER").enum(["local", "redis"] as const, "local"),
    channel: env("NOTIFICATION_BROADCAST_CHANNEL").string("notifications"),
  },
};
