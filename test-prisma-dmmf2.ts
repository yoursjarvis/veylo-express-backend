import { Prisma } from "./generated/prisma/client.js";
const modelWithRelation = Prisma.dmmf.datamodel.models.find(m => m.fields.some(f => f.relationName && f.relationFromFields?.length));
console.log(JSON.stringify(modelWithRelation?.fields.find(f => f.relationName && f.relationFromFields?.length), null, 2));
