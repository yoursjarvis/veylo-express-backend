import { PrismaPg } from "@prisma/adapter-pg";

import { config } from "@/utils/config";

import { PrismaClient } from "../../generated/prisma/client.js";

import { auditLogExtension } from "./prisma-extensions/audit-log.extension";
import { softDeleteExtension } from "./prisma-extensions/soft-delete";

const adapter = new PrismaPg({
  connectionString: config("database.postgress.url"),
});

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

const prisma = basePrisma.$extends(softDeleteExtension).$extends(auditLogExtension);

if (config("app.env") !== "production") globalForPrisma.prisma = basePrisma;

export { basePrisma };
export default prisma;
// Trigger restart
