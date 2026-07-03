import { AsyncLocalStorage } from "node:async_hooks";

import { Prisma } from "../../../generated/prisma/client.js";

interface SoftDeleteStore {
  withTrashed?: boolean;
  force?: boolean;
}

const softDeleteStorage = new AsyncLocalStorage<SoftDeleteStore>();

// Find relations that cascade delete and support soft delete (have deletedAt)
function getCascadeRelations(modelName: string) {
  const cascades: Array<{
    childModel: string;
    foreignKey: string;
    parentKey: string;
  }> = [];

  const models = Prisma.dmmf.datamodel.models;

  for (const childModel of models) {
    const hasDeletedAt = childModel.fields.some((f) => f.name === "deletedAt");
    if (!hasDeletedAt) continue;

    for (const field of childModel.fields) {
      if (
        field.kind === "object" &&
        field.type === modelName &&
        field.relationOnDelete === "Cascade"
      ) {
        const foreignKey = field.relationFromFields?.[0];
        const parentKey = field.relationToFields?.[0];
        if (foreignKey && parentKey) {
          cascades.push({
            childModel: childModel.name,
            foreignKey,
            parentKey,
          });
        }
      }
    }
  }

  return cascades;
}

type ModelContext = {
  name: string;
  $name: string;
  updateMany: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
  deleteMany: (args: unknown) => Promise<unknown>;
  findFirst: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown>;
  findUnique: (args: unknown) => Promise<unknown>;
  findFirstOrThrow: (args: unknown) => Promise<unknown>;
  findUniqueOrThrow: (args: unknown) => Promise<unknown>;
};

type ClientContext = Record<string, ModelContext>;

function checkHasDeletedAt(modelName: string): boolean {
  const fieldEnum = (
    Prisma as unknown as Record<string, Record<string, string> | undefined>
  )[`${modelName}ScalarFieldEnum`];
  return fieldEnum ? "deletedAt" in fieldEnum : false;
}

export const softDeleteExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: "softDelete",
    model: {
      $allModels: {
        async restore<M, A>(
          this: M,
          args: { where: Prisma.Args<M, "update">["where"] },
        ): Promise<Prisma.Result<M, A, "update">> {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ModelContext;
          const modelName = context.$name || context.name;

          const hasDeletedAt = checkHasDeletedAt(modelName);
          if (!hasDeletedAt) {
            throw new Error(
              `Model "${modelName}" does not support soft deletes.`,
            );
          }

          // Cascading restore
          const cascades = getCascadeRelations(modelName);
          if (cascades.length > 0) {
            const record = (await softDeleteStorage.run(
              { withTrashed: true },
              async () => {
                return await context.findFirst({
                  where: args.where,
                });
              },
            )) as Record<string, unknown> | null;

            if (record) {
              const clientContext = client as unknown as ClientContext;
              for (const cascade of cascades) {
                const childClientModelName =
                  cascade.childModel.charAt(0).toLowerCase() +
                  cascade.childModel.slice(1);
                const parentValue = record[cascade.parentKey];

                await clientContext[childClientModelName].updateMany({
                  where: {
                    [cascade.foreignKey]: parentValue,
                    deletedAt: { not: null },
                  },
                  data: { deletedAt: null },
                });
              }
            }
          }

          return context.update({
            where: args.where,
            data: { deletedAt: null },
          }) as Promise<Prisma.Result<M, A, "update">>;
        },
        async forceDelete<M, A>(
          this: M,
          args: Prisma.Exact<A, Prisma.Args<M, "delete">>,
        ): Promise<Prisma.Result<M, A, "delete">> {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ModelContext;
          const modelName = context.$name || context.name;
          const hasDeletedAt = checkHasDeletedAt(modelName);
          if (!hasDeletedAt) {
            return context.delete(args) as Promise<
              Prisma.Result<M, A, "delete">
            >;
          }

          return softDeleteStorage.run({ force: true }, async () => {
            return (await context.delete(args)) as Prisma.Result<
              M,
              A,
              "delete"
            >;
          });
        },
        async forceDeleteMany<M, A>(
          this: M,
          args?: Prisma.Exact<A, Prisma.Args<M, "deleteMany">>,
        ): Promise<Prisma.Result<M, A, "deleteMany">> {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ModelContext;
          const modelName = context.$name || context.name;
          const hasDeletedAt = checkHasDeletedAt(modelName);
          if (!hasDeletedAt) {
            return context.deleteMany(args) as Promise<
              Prisma.Result<M, A, "deleteMany">
            >;
          }

          return softDeleteStorage.run({ force: true }, async () => {
            return (await context.deleteMany(args)) as Prisma.Result<
              M,
              A,
              "deleteMany"
            >;
          });
        },
        async findManyWithTrashed<M, A>(
          this: M,
          args?: Prisma.Exact<A, Prisma.Args<M, "findMany">>,
        ): Promise<Prisma.Result<M, A, "findMany">> {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ModelContext;
          const modelName = context.$name || context.name;
          const hasDeletedAt = checkHasDeletedAt(modelName);
          if (!hasDeletedAt) {
            return context.findMany(args) as Promise<
              Prisma.Result<M, A, "findMany">
            >;
          }

          return softDeleteStorage.run({ withTrashed: true }, async () => {
            return (await context.findMany(args)) as Prisma.Result<
              M,
              A,
              "findMany"
            >;
          });
        },
        async findFirstWithTrashed<M, A>(
          this: M,
          args?: Prisma.Exact<A, Prisma.Args<M, "findFirst">>,
        ): Promise<Prisma.Result<M, A, "findFirst">> {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ModelContext;
          const modelName = context.$name || context.name;
          const hasDeletedAt = checkHasDeletedAt(modelName);
          if (!hasDeletedAt) {
            return context.findFirst(args) as Promise<
              Prisma.Result<M, A, "findFirst">
            >;
          }

          return softDeleteStorage.run({ withTrashed: true }, async () => {
            return (await context.findFirst(args)) as Prisma.Result<
              M,
              A,
              "findFirst"
            >;
          });
        },
        async findUniqueWithTrashed<M, A>(
          this: M,
          args: Prisma.Exact<A, Prisma.Args<M, "findUnique">>,
        ): Promise<Prisma.Result<M, A, "findUnique">> {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ModelContext;
          const modelName = context.$name || context.name;
          const hasDeletedAt = checkHasDeletedAt(modelName);
          if (!hasDeletedAt) {
            return context.findUnique(args) as Promise<
              Prisma.Result<M, A, "findUnique">
            >;
          }

          return softDeleteStorage.run({ withTrashed: true }, async () => {
            return (await context.findUnique(args)) as Prisma.Result<
              M,
              A,
              "findUnique"
            >;
          });
        },
        async findFirstOrThrowWithTrashed<M, A>(
          this: M,
          args?: Prisma.Exact<A, Prisma.Args<M, "findFirstOrThrow">>,
        ): Promise<Prisma.Result<M, A, "findFirstOrThrow">> {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ModelContext;
          const modelName = context.$name || context.name;
          const hasDeletedAt = checkHasDeletedAt(modelName);
          if (!hasDeletedAt) {
            return context.findFirstOrThrow(args) as Promise<
              Prisma.Result<M, A, "findFirstOrThrow">
            >;
          }

          return softDeleteStorage.run({ withTrashed: true }, async () => {
            return (await context.findFirstOrThrow(args)) as Prisma.Result<
              M,
              A,
              "findFirstOrThrow"
            >;
          });
        },
        async findUniqueOrThrowWithTrashed<M, A>(
          this: M,
          args: Prisma.Exact<A, Prisma.Args<M, "findUniqueOrThrow">>,
        ): Promise<Prisma.Result<M, A, "findUniqueOrThrow">> {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ModelContext;
          const modelName = context.$name || context.name;
          const hasDeletedAt = checkHasDeletedAt(modelName);
          if (!hasDeletedAt) {
            return context.findUniqueOrThrow(args) as Promise<
              Prisma.Result<M, A, "findUniqueOrThrow">
            >;
          }

          return softDeleteStorage.run({ withTrashed: true }, async () => {
            return (await context.findUniqueOrThrow(args)) as Prisma.Result<
              M,
              A,
              "findUniqueOrThrow"
            >;
          });
        },
      },
    },
    query: {
      $allModels: {
        async delete({ model, args, query }) {
          const hasDeletedAt = checkHasDeletedAt(model);
          if (!hasDeletedAt) {
            return query(args);
          }

          const store = softDeleteStorage.getStore();
          if (store?.force) {
            return query(args);
          }

          const clientModelName =
            model.charAt(0).toLowerCase() + model.slice(1);
          const clientContext = client as unknown as ClientContext;
          const typedArgs = args as Record<string, unknown>;

          // Handle cascading soft delete
          const cascades = getCascadeRelations(model);
          if (cascades.length > 0) {
            const record = (await softDeleteStorage.run(
              { withTrashed: true },
              async () => {
                return await clientContext[clientModelName].findFirst({
                  where: typedArgs.where,
                });
              },
            )) as Record<string, unknown> | null;

            if (record) {
              for (const cascade of cascades) {
                const childClientModelName =
                  cascade.childModel.charAt(0).toLowerCase() +
                  cascade.childModel.slice(1);
                const parentValue = record[cascade.parentKey];

                // Perform explicit updateMany for child records to ensure soft delete is written
                await clientContext[childClientModelName].updateMany({
                  where: { [cascade.foreignKey]: parentValue, deletedAt: null },
                  data: { deletedAt: new Date() },
                });
              }
            }
          }

          return clientContext[clientModelName].update({
            where: typedArgs.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ model, args, query }) {
          const hasDeletedAt = checkHasDeletedAt(model);
          if (!hasDeletedAt) {
            return query(args);
          }

          const store = softDeleteStorage.getStore();
          if (store?.force) {
            return query(args);
          }

          const clientModelName =
            model.charAt(0).toLowerCase() + model.slice(1);
          const clientContext = client as unknown as ClientContext;
          const typedArgs = (args || {}) as Record<string, unknown>;

          // Handle cascading soft delete
          const cascades = getCascadeRelations(model);
          if (cascades.length > 0) {
            const records = (await softDeleteStorage.run(
              { withTrashed: true },
              async () => {
                return await clientContext[clientModelName].findMany({
                  where: typedArgs.where || {},
                });
              },
            )) as Array<Record<string, unknown>>;

            if (records.length > 0) {
              for (const cascade of cascades) {
                const childClientModelName =
                  cascade.childModel.charAt(0).toLowerCase() +
                  cascade.childModel.slice(1);
                const parentValues = records.map((r) => r[cascade.parentKey]);

                // Perform explicit updateMany for child records to ensure soft delete is written
                await clientContext[childClientModelName].updateMany({
                  where: {
                    [cascade.foreignKey]: { in: parentValues },
                    deletedAt: null,
                  },
                  data: { deletedAt: new Date() },
                });
              }
            }
          }

          return clientContext[clientModelName].updateMany({
            where: typedArgs.where || {},
            data: { deletedAt: new Date() },
          });
        },
        async findFirst({ model, args, query }) {
          const hasDeletedAt = checkHasDeletedAt(model);
          if (!hasDeletedAt) {
            return query(args);
          }

          const store = softDeleteStorage.getStore();
          if (store?.withTrashed) {
            return query(args);
          }

          const typedArgs = (args || {}) as Record<string, unknown>;
          const where = (typedArgs.where || {}) as Record<string, unknown>;
          if (where.deletedAt === undefined) {
            where.deletedAt = null;
          }
          typedArgs.where = where;
          return query(typedArgs);
        },
        async findMany({ model, args, query }) {
          const hasDeletedAt = checkHasDeletedAt(model);
          if (!hasDeletedAt) {
            return query(args);
          }

          const store = softDeleteStorage.getStore();
          if (store?.withTrashed) {
            return query(args);
          }

          const typedArgs = (args || {}) as Record<string, unknown>;
          const where = (typedArgs.where || {}) as Record<string, unknown>;
          if (where.deletedAt === undefined) {
            where.deletedAt = null;
          }
          typedArgs.where = where;
          return query(typedArgs as typeof args);
        },
        async count({ model, args, query }) {
          const hasDeletedAt = checkHasDeletedAt(model);
          if (!hasDeletedAt) {
            return query(args);
          }

          const store = softDeleteStorage.getStore();
          if (store?.withTrashed) {
            return query(args);
          }

          const typedArgs = (args || {}) as Record<string, unknown>;
          const where = (typedArgs.where || {}) as Record<string, unknown>;
          if (where.deletedAt === undefined) {
            where.deletedAt = null;
          }
          typedArgs.where = where;
          return query(typedArgs as typeof args);
        },
        async aggregate({ model, args, query }) {
          const hasDeletedAt = checkHasDeletedAt(model);
          if (!hasDeletedAt) {
            return query(args);
          }

          const store = softDeleteStorage.getStore();
          if (store?.withTrashed) {
            return query(args);
          }

          const typedArgs = (args || {}) as Record<string, unknown>;
          const where = (typedArgs.where || {}) as Record<string, unknown>;
          if (where.deletedAt === undefined) {
            where.deletedAt = null;
          }
          typedArgs.where = where;
          return query(typedArgs as typeof args);
        },
        async groupBy({ model, args, query }) {
          const hasDeletedAt = checkHasDeletedAt(model);
          if (!hasDeletedAt) {
            return query(args);
          }

          const store = softDeleteStorage.getStore();
          if (store?.withTrashed) {
            return query(args);
          }

          const typedArgs = (args || {}) as Record<string, unknown>;
          const where = (typedArgs.where || {}) as Record<string, unknown>;
          if (where.deletedAt === undefined) {
            where.deletedAt = null;
          }
          typedArgs.where = where;
          return query(typedArgs as typeof args);
        },
        async findUnique({ model, args, query }) {
          const hasDeletedAt = checkHasDeletedAt(model);
          if (!hasDeletedAt) {
            return query(args);
          }

          const store = softDeleteStorage.getStore();
          if (store?.withTrashed) {
            return query(args);
          }

          // Convert findUnique to findFirst to allow soft-delete filtering
          const clientModelName =
            model.charAt(0).toLowerCase() + model.slice(1);
          const clientContext = client as unknown as ClientContext;
          const typedArgs = (args || {}) as Record<string, unknown>;
          const { where, ...rest } = typedArgs;

          return clientContext[clientModelName].findFirst({
            ...rest,
            where: {
              ...(where as Record<string, unknown>),
              deletedAt: null,
            },
          });
        },
        async findUniqueOrThrow({ model, args, query }) {
          const hasDeletedAt = checkHasDeletedAt(model);
          if (!hasDeletedAt) {
            return query(args);
          }

          const store = softDeleteStorage.getStore();
          if (store?.withTrashed) {
            return query(args);
          }

          // Convert findUniqueOrThrow to findFirstOrThrow to allow soft-delete filtering
          const clientModelName =
            model.charAt(0).toLowerCase() + model.slice(1);
          const clientContext = client as unknown as ClientContext;
          const typedArgs = (args || {}) as Record<string, unknown>;
          const { where, ...rest } = typedArgs;

          return clientContext[clientModelName].findFirstOrThrow({
            ...rest,
            where: {
              ...(where as Record<string, unknown>),
              deletedAt: null,
            },
          });
        },
      },
    },
  });
});
