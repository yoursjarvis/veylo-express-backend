import { Prisma } from "../../../generated/prisma/client.js";

export interface AccessorMutatorDefinition {
  get?: (value: never) => unknown;
  set?: (value: never) => unknown;
}

export interface AccessorMutatorConfig {
  [modelName: string]: {
    [fieldName: string]: AccessorMutatorDefinition;
  };
}

const relationModelMap = new Map<string, Map<string, string>>();

function buildRelationModelMap() {
  if (relationModelMap.size > 0) return;
  const models = Prisma.dmmf.datamodel.models;
  for (const model of models) {
    const fieldsMap = new Map<string, string>();
    for (const field of model.fields) {
      if (field.kind === "object" && field.type) {
        fieldsMap.set(field.name, field.type);
      }
    }
    relationModelMap.set(model.name, fieldsMap);
  }
}

function transformWriteData(
  modelName: string,
  data: Record<string, unknown>,
  config: AccessorMutatorConfig,
): Record<string, unknown> {
  // Get the key in config matching modelName (case-insensitive)
  const modelKey = Object.keys(config).find(
    (k) => k.toLowerCase() === modelName.toLowerCase(),
  );
  const modelMutators = modelKey ? config[modelKey] : null;

  // Build or get relations
  buildRelationModelMap();
  const datamodelModel = Prisma.dmmf.datamodel.models.find(
    (m) => m.name.toLowerCase() === modelName.toLowerCase(),
  );
  const datamodelModelName = datamodelModel ? datamodelModel.name : modelName;
  const relations = relationModelMap.get(datamodelModelName);

  for (const [key, value] of Object.entries(data)) {
    // 1. Mutate field if set is defined
    if (modelMutators && modelMutators[key] && modelMutators[key].set) {
      const setFn = modelMutators[key].set as (val: unknown) => unknown;
      data[key] = setFn(value);
      continue;
    }

    // 2. Traverse nested writes
    if (relations && relations.has(key) && value && typeof value === "object") {
      const targetModel = relations.get(key)!;
      const valObj = value as Record<string, unknown>;

      // create
      if ("create" in valObj && valObj.create) {
        if (Array.isArray(valObj.create)) {
          valObj.create = valObj.create.map((item) =>
            transformWriteData(
              targetModel,
              item as Record<string, unknown>,
              config,
            ),
          );
        } else {
          valObj.create = transformWriteData(
            targetModel,
            valObj.create as Record<string, unknown>,
            config,
          );
        }
      }

      // update
      if ("update" in valObj && valObj.update) {
        if (Array.isArray(valObj.update)) {
          valObj.update = valObj.update.map((item) => {
            if (item && typeof item === "object") {
              const itemObj = item as Record<string, unknown>;
              if ("data" in itemObj) {
                itemObj.data = transformWriteData(
                  targetModel,
                  itemObj.data as Record<string, unknown>,
                  config,
                );
              } else {
                return transformWriteData(targetModel, itemObj, config);
              }
            }
            return item;
          });
        } else {
          const updateObj = valObj.update as Record<string, unknown>;
          if (updateObj.data) {
            updateObj.data = transformWriteData(
              targetModel,
              updateObj.data as Record<string, unknown>,
              config,
            );
          } else {
            const keys = Object.keys(updateObj);
            const isDirectWrite =
              !keys.includes("where") && !keys.includes("data");
            if (isDirectWrite) {
              valObj.update = transformWriteData(
                targetModel,
                updateObj,
                config,
              );
            }
          }
        }
      }

      // upsert
      if ("upsert" in valObj && valObj.upsert) {
        if (Array.isArray(valObj.upsert)) {
          valObj.upsert = valObj.upsert.map((item) => {
            if (item && typeof item === "object") {
              const itemObj = item as Record<string, unknown>;
              if ("create" in itemObj) {
                itemObj.create = transformWriteData(
                  targetModel,
                  itemObj.create as Record<string, unknown>,
                  config,
                );
              }
              if ("update" in itemObj) {
                itemObj.update = transformWriteData(
                  targetModel,
                  itemObj.update as Record<string, unknown>,
                  config,
                );
              }
            }
            return item;
          });
        } else {
          const upsertObj = valObj.upsert as Record<string, unknown>;
          if (upsertObj.create) {
            upsertObj.create = transformWriteData(
              targetModel,
              upsertObj.create as Record<string, unknown>,
              config,
            );
          }
          if (upsertObj.update) {
            upsertObj.update = transformWriteData(
              targetModel,
              upsertObj.update as Record<string, unknown>,
              config,
            );
          }
        }
      }

      // connectOrCreate
      if ("connectOrCreate" in valObj && valObj.connectOrCreate) {
        if (Array.isArray(valObj.connectOrCreate)) {
          valObj.connectOrCreate = valObj.connectOrCreate.map((item) => {
            if (item && typeof item === "object") {
              const itemObj = item as Record<string, unknown>;
              if ("create" in itemObj) {
                itemObj.create = transformWriteData(
                  targetModel,
                  itemObj.create as Record<string, unknown>,
                  config,
                );
              }
            }
            return item;
          });
        } else {
          const connectOrCreateObj = valObj.connectOrCreate as Record<
            string,
            unknown
          >;
          if (connectOrCreateObj.create) {
            connectOrCreateObj.create = transformWriteData(
              targetModel,
              connectOrCreateObj.create as Record<string, unknown>,
              config,
            );
          }
        }
      }
    }
  }

  return data;
}

export function accessorMutatorExtension(config: AccessorMutatorConfig) {
  // Build result extensions configuration
  const result: Record<string, Record<string, unknown>> = {};
  for (const [modelName, fields] of Object.entries(config)) {
    const datamodelModel = Prisma.dmmf.datamodel.models.find(
      (m) => m.name.toLowerCase() === modelName.toLowerCase(),
    );
    const exactModelName = datamodelModel ? datamodelModel.name : modelName;
    const normalizedModelName =
      exactModelName.charAt(0).toLowerCase() + exactModelName.slice(1);

    result[normalizedModelName] = {};

    for (const [fieldName, definition] of Object.entries(fields)) {
      if (definition.get) {
        result[normalizedModelName][fieldName] = {
          needs: { [fieldName]: true },
          compute(data: never) {
            const dataObj = data as Record<string, unknown>;
            const rawValue = dataObj[fieldName];
            if (rawValue !== undefined) {
              const getFn = definition.get as (val: unknown) => unknown;
              return getFn(rawValue);
            }
            return rawValue;
          },
        };
      }
    }
  }

  return Prisma.defineExtension((client) => {
    return client.$extends({
      name: "accessor-mutator",
      result: result as never,
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const executeQuery = query as unknown as (
              args: unknown,
            ) => Promise<unknown>;
            if (!model) return executeQuery(args);

            // Cast args to Record<string, unknown> to manipulate properties
            const typedArgs = args as
              Record<string, unknown> | null | undefined;

            if (
              operation === "create" ||
              operation === "update" ||
              operation === "updateMany"
            ) {
              if (typedArgs && typedArgs.data) {
                typedArgs.data = transformWriteData(
                  model,
                  typedArgs.data as Record<string, unknown>,
                  config,
                );
              }
            } else if (operation === "upsert") {
              if (typedArgs) {
                if (typedArgs.create) {
                  typedArgs.create = transformWriteData(
                    model,
                    typedArgs.create as Record<string, unknown>,
                    config,
                  );
                }
                if (typedArgs.update) {
                  typedArgs.update = transformWriteData(
                    model,
                    typedArgs.update as Record<string, unknown>,
                    config,
                  );
                }
              }
            } else if (
              operation === "createMany" ||
              operation === "createManyAndReturn"
            ) {
              if (typedArgs && typedArgs.data) {
                if (Array.isArray(typedArgs.data)) {
                  typedArgs.data = typedArgs.data.map((item) =>
                    transformWriteData(
                      model,
                      item as Record<string, unknown>,
                      config,
                    ),
                  );
                } else {
                  typedArgs.data = transformWriteData(
                    model,
                    typedArgs.data as Record<string, unknown>,
                    config,
                  );
                }
              }
            }

            return executeQuery(args);
          },
        },
      },
    });
  });
}
