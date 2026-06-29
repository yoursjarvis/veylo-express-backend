import { vi } from "vitest";
import { prismaMock } from "./helpers/db";

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
  basePrisma: prismaMock,
}));

vi.mock("../src/lib/prisma", () => ({
  default: prismaMock,
  basePrisma: prismaMock,
}));

vi.mock("../../src/lib/prisma", () => ({
  default: prismaMock,
  basePrisma: prismaMock,
}));
