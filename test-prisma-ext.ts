import { Prisma } from "./generated/prisma/client.js";

const softDeleteExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: "softDelete",
    model: {
      $allModels: {
        async customDelete<M, A>(
          this: M,
          args: Prisma.Args<M, "delete">
        ): Promise<Prisma.Result<M, A, "delete">> {
          const ctx = Prisma.getExtensionContext(this);
          console.log(ctx.name); // does it compile?
          return ctx as any;
        }
      }
    }
  });
});
