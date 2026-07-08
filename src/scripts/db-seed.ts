import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

const seeders: Record<string, string> = {
  "--seed-permissions": "seed-permissions.ts",
  "--seed-templates": "seed-templates.ts",
  "--seed-test": "seed-test-data.ts",
};

async function runSeeder(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, file);
    console.log(`\n=== Running Seeder: ${file} ===`);
    const child = spawn("npx", ["tsx", filePath], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Seeder ${file} failed with exit status ${code}`));
      }
    });
  });
}

async function main() {
  const flags = args.filter((arg) => arg.startsWith("--"));

  if (flags.length > 0) {
    for (const flag of flags) {
      const file = seeders[flag];
      if (file) {
        await runSeeder(file);
      } else {
        console.warn(`Warning: Unknown seed flag "${flag}"`);
      }
    }
  } else {
    // Run all seeders in sequence
    console.log("No specific seeder flag provided. Running all seeders...");
    await runSeeder("seed-permissions.ts");
    await runSeeder("seed-templates.ts");
    await runSeeder("seed-test-data.ts");
  }
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
