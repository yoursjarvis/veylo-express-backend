import { config } from "@/utils/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: config("database.postgress.url")
});

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter
  });

if (config("app.env") !== "production") globalForPrisma.prisma = prisma;

export default prisma;
