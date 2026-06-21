import { config } from "@/utils/config";
import { PrismaPg } from "@prisma/adapter-pg";
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
      async delete<T, A>(
        this: T,
        args: Prisma.Args<T, "delete">
      ): Promise<any> {
        const context = Prisma.getExtensionContext(this);
        const modelName = (context as any).name;
        const fieldEnum = (Prisma as any)[`${modelName}ScalarFieldEnum`];

        if (fieldEnum && "deletedAt" in fieldEnum) {
          return (context as any).update({
            ...args,
            data: { deletedAt: new Date() },
          });
        }

        const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
        return (basePrisma as any)[modelKey].delete(args);
      },
      async deleteMany<T, A>(
        this: T,
        args: Prisma.Args<T, "deleteMany">
      ): Promise<any> {
        const context = Prisma.getExtensionContext(this);
        const modelName = (context as any).name;
        const fieldEnum = (Prisma as any)[`${modelName}ScalarFieldEnum`];

        if (fieldEnum && "deletedAt" in fieldEnum) {
          return (context as any).updateMany({
            ...args,
            data: { deletedAt: new Date() },
          });
        }

        const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
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
          const fieldEnum = (Prisma as any)[`${model}ScalarFieldEnum`];
          if (fieldEnum && "deletedAt" in fieldEnum) {
            (args as any).where = { ...(args as any).where, deletedAt: null };
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
