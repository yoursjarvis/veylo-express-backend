import { Prisma } from "./generated/prisma/client.js";
export const softDeleteExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: "softDelete",
    model: {
      $allModels: {
        async restore<M, A>(
          this: M,
          args: { where: Prisma.Args<M, "update">["where"] }
        ): Promise<unknown> {
          const context = Prisma.getExtensionContext(this);
          const modelName = context.$name || (context as unknown as { name: string }).name;
          return modelName;
        }
      }
    }
  });
});
