import { PrismaPg } from "@prisma/adapter-pg";

import { config } from "@/utils/config";

import { PrismaClient, Prisma } from "../../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: config("database.postgress.url")
});

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter
  });

const prisma = basePrisma.$extends({
  model: {
    $allModels: {
      async delete<T>(
        this: T,
        args: Prisma.Args<T, "delete">
      ): Promise<unknown> {
        const context = Prisma.getExtensionContext(this);
        const modelName = (context as Record<string, unknown>).name as string;
        const fieldEnum = (Prisma as unknown as Record<string, Record<string, string> | undefined>)[`${modelName}ScalarFieldEnum`];

        if (fieldEnum && "deletedAt" in fieldEnum) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma $extends context methods are dynamically resolved and untyped
          return (context as any).update({
            ...args,
            data: { deletedAt: new Date() },
          });
        }

        const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access requires runtime dispatch
        return (basePrisma as any)[modelKey].delete(args);
      },
      async deleteMany<T>(
        this: T,
        args: Prisma.Args<T, "deleteMany">
      ): Promise<unknown> {
        const context = Prisma.getExtensionContext(this);
        const modelName = (context as Record<string, unknown>).name as string;
        const fieldEnum = (Prisma as unknown as Record<string, Record<string, string> | undefined>)[`${modelName}ScalarFieldEnum`];

        if (fieldEnum && "deletedAt" in fieldEnum) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma $extends context methods are dynamically resolved and untyped
          return (context as any).updateMany({
            ...args,
            data: { deletedAt: new Date() },
          });
        }

        const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access requires runtime dispatch
        return (basePrisma as any)[modelKey].deleteMany(args);
      },
    },
  },
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (
          [
            "findFirst",
            "findFirstOrThrow",
            "findMany",
            "findUnique",
            "findUniqueOrThrow",
            "count",
            "aggregate",
            "groupBy",
          ].includes(operation)
        ) {
          const fieldEnum = (Prisma as unknown as Record<string, Record<string, string> | undefined>)[`${model}ScalarFieldEnum`];
          if (fieldEnum && "deletedAt" in fieldEnum) {
            const currentWhere = (args as Record<string, unknown>).where as Record<string, unknown> | undefined;
            (args as Record<string, unknown>).where = { ...currentWhere, deletedAt: null };
          }
        }
        return query(args);
      },
    },
  },
});

if (config("app.env") !== "production") globalForPrisma.prisma = basePrisma;

export { basePrisma };
export default prisma;
// Trigger restart
