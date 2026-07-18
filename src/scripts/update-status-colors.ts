import "dotenv/config";
import prisma from "../lib/prisma";
import { getDefaultStatusColorAndWeight } from "../utils/status-defaults";

async function main() {
  const statuses = await prisma.taskStatus.findMany();
  console.log(`Found ${statuses.length} task statuses in database.`);

  let updatedCount = 0;
  for (const status of statuses) {
    const defaults = getDefaultStatusColorAndWeight(
      status.name,
      status.category,
    );

    // Determine if we should update color
    const shouldUpdateColor =
      !status.color ||
      status.color === "#e2e8f0" ||
      status.color === "#6366f1" ||
      status.color === "#64748b";

    // Determine if we should update progressWeight
    const shouldUpdateWeight =
      status.progressWeight === 0 && defaults.progressWeight > 0;

    if (shouldUpdateColor || shouldUpdateWeight) {
      await prisma.taskStatus.update({
        where: { id: status.id },
        data: {
          color: shouldUpdateColor ? defaults.color : undefined,
          progressWeight: shouldUpdateWeight
            ? defaults.progressWeight
            : undefined,
        },
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} task statuses.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
