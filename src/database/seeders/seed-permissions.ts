import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import prisma from "../../lib/prisma";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PermissionSeed {
  module: string;
  resource: string;
  action: string;
  description?: string;
}

async function main() {
  console.log("Seeding master permissions...");

  const jsonPath = path.join(__dirname, "permissions.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Master permissions file not found at ${jsonPath}`);
  }

  let masterPermissions: PermissionSeed[];
  try {
    const rawData = fs.readFileSync(jsonPath, "utf-8");
    masterPermissions = JSON.parse(rawData);
  } catch (error) {
    throw new Error(
      `Invalid permissions.json format: ${(error as Error).message}`,
    );
  }

  // Validate the schema of the permissions
  if (!Array.isArray(masterPermissions)) {
    throw new Error(
      "Invalid permissions.json structure: expected an array of permissions",
    );
  }

  for (const p of masterPermissions) {
    if (!p.module || !p.resource || !p.action) {
      throw new Error(
        `Invalid permission entry: ${JSON.stringify(p)}. "module", "resource", and "action" are required fields.`,
      );
    }
  }

  // Fetch all existing permissions including soft-deleted ones
  const existingPermissions = await prisma.permission.findManyWithTrashed();

  const existingMap = new Map<string, (typeof existingPermissions)[0]>();
  for (const dbP of existingPermissions) {
    existingMap.set(`${dbP.resource}:${dbP.action}`, dbP);
  }

  const activeKeys = new Set<string>();

  for (const p of masterPermissions) {
    const key = `${p.resource}:${p.action}`;
    activeKeys.add(key);

    const existing = existingMap.get(key);

    if (existing) {
      // If it exists, update it
      await prisma.permission.update({
        where: { id: existing.id },
        data: {
          module: p.module,
          description: p.description ?? null,
          deletedAt: null, // Restore if it was soft-deleted
        },
      });
    } else {
      // If it doesn't exist, create it
      await prisma.permission.create({
        data: {
          module: p.module,
          resource: p.resource,
          action: p.action,
          description: p.description ?? null,
        },
      });
    }
  }

  // Soft delete any permissions in the database that are NOT in permissions.json
  for (const dbP of existingPermissions) {
    const key = `${dbP.resource}:${dbP.action}`;
    if (!activeKeys.has(key) && dbP.deletedAt === null) {
      console.log(`Soft deleting obsolete permission: ${key}`);
      await prisma.permission.delete({
        where: { id: dbP.id },
      });
    }
  }

  console.log(
    `Successfully processed ${masterPermissions.length} permissions.`,
  );
}

main()
  .catch((e) => {
    console.error("Permission seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
