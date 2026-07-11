import { vi } from "vitest";

import { prismaMock } from "./helpers/db";

vi.mock(
  "/home/codeclouds-tanmoy/Personal/Veylo/veylo-express-backend/src/lib/prisma.ts",
  () => ({
    default: prismaMock,
    basePrisma: prismaMock,
  }),
);

vi.mock(
  "/home/codeclouds-tanmoy/Personal/Veylo/veylo-express-backend/src/app/services/rbac.service.ts",
  () => ({
    rbacService: {
      getPermissions: vi.fn(),
      getOrganizationRoles: vi.fn(),
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      assignRole: vi.fn(),
      removeRole: vi.fn(),
      getUserAssignments: vi.fn(),
      getUserPermissionsInScopes: vi.fn().mockResolvedValue([]),
      checkPermission: vi.fn().mockResolvedValue(true),
      authorize: vi.fn().mockResolvedValue(true),
      getPermissionsForContext: vi.fn().mockResolvedValue(["*"]),
    },
  }),
);

// Keep compatibility mocks
vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
  basePrisma: prismaMock,
}));
vi.mock("@/app/services/rbac.service", () => ({
  rbacService: {
    getPermissions: vi.fn(),
    getOrganizationRoles: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    assignRole: vi.fn(),
    removeRole: vi.fn(),
    getUserAssignments: vi.fn(),
    getUserPermissionsInScopes: vi.fn().mockResolvedValue([]),
    checkPermission: vi.fn().mockResolvedValue(true),
    authorize: vi.fn().mockResolvedValue(true),
    getPermissionsForContext: vi.fn().mockResolvedValue(["*"]),
  },
}));
