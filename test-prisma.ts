import prisma from "./src/lib/prisma";
console.log(Object.keys(prisma).filter(k => k.toLowerCase().includes('comment')));
