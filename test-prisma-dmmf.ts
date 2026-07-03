import { Prisma } from "./generated/prisma/client.js";
console.log(JSON.stringify(Prisma.dmmf.datamodel.models[0].fields.find(f => f.relationName), null, 2));
