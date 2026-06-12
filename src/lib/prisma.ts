import { config } from "@/utils/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../generated/prisma/client";

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
      ): Promise<Prisma.Result<T, A, "update">> {
        const context = Prisma.getExtensionContext(this);
        return (context as any).update({
          ...args,
          data: { deletedAt: new Date() },
        });
      },
      async deleteMany<T, A>(
        this: T,
        args: Prisma.Args<T, "deleteMany">
      ): Promise<Prisma.Result<T, A, "updateMany">> {
        const context = Prisma.getExtensionContext(this);
        return (context as any).updateMany({
          ...args,
          data: { deletedAt: new Date() },
        });
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
            args.where = { ...args.where, deletedAt: null };
          }
        }
        return query(args);
      },
    },
  },
});

if (config("app.env") !== "production") globalForPrisma.prisma = basePrisma;

export default prisma;
