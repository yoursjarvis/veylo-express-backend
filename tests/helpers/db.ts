import { vi } from "vitest";

const standardMock = () => ({
  findUnique: vi.fn().mockResolvedValue(null),
  findFirst: vi.fn().mockResolvedValue(null),
  findMany: vi.fn().mockResolvedValue([]),
  create: vi
    .fn()
    .mockImplementation((args) =>
      Promise.resolve({ id: "mock-id", ...(args?.data || {}) }),
    ),
  update: vi
    .fn()
    .mockImplementation((args) =>
      Promise.resolve({ id: "mock-id", ...(args?.data || {}) }),
    ),
  delete: vi.fn().mockImplementation(() => Promise.resolve({ id: "mock-id" })),
  createMany: vi.fn().mockResolvedValue({ count: 1 }),
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  count: vi.fn().mockResolvedValue(0),
  upsert: vi.fn().mockImplementation((args) =>
    Promise.resolve({
      id: "mock-id",
      ...(args?.create || args?.update || {}),
    }),
  ),
  findUniqueWithTrashed: vi.fn().mockResolvedValue(null),
  findFirstWithTrashed: vi.fn().mockResolvedValue(null),
  findManyWithTrashed: vi.fn().mockResolvedValue([]),
  restore: vi.fn().mockImplementation(() => Promise.resolve({ id: "mock-id" })),
  forceDelete: vi
    .fn()
    .mockImplementation(() => Promise.resolve({ id: "mock-id" })),
});

export const prismaMock = {
  // Mock transaction interface to execute callbacks using the same mock layer
  $transaction: vi.fn().mockImplementation((cb) => cb(prismaMock)),
  $queryRaw: vi.fn(),

  member: standardMock(),
  workspaceMember: standardMock(),
  workspace: standardMock(),
  session: {
    ...standardMock(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  project: standardMock(),
  objective: {
    ...standardMock(),
    findFirstWithTrashed: vi.fn().mockResolvedValue(null),
    findUniqueWithTrashed: vi.fn().mockResolvedValue(null),
  },
  projectDoc: standardMock(),
  projectDocFavorite: standardMock(),
  projectDocVersion: standardMock(),
  projectDocComment: standardMock(),
  projectDocActivity: standardMock(),
  projectDocPermission: standardMock(),
  projectDocCommentReaction: standardMock(),
  projectMember: standardMock(),
  projectTemplate: standardMock(),
  user: standardMock(),
  organization: standardMock(),
  invitation: standardMock(),
  task: standardMock(),
  taskStatus: standardMock(),
  taskDependency: standardMock(),
  taskActivity: standardMock(),
  subtask: standardMock(),
  comment: standardMock(),
  commentReaction: standardMock(),
  customFieldDefinition: standardMock(),
  epic: standardMock(),
  milestone: standardMock(),
  label: standardMock(),
  sprint: standardMock(),
  workLog: standardMock(),
  media: standardMock(),
  verification: standardMock(),
  account: standardMock(),
  twoFactor: standardMock(),
  twoFactorBackup: standardMock(),
  vault: standardMock(),
  vaultService: standardMock(),
  vaultItem: standardMock(),
  slackWebhook: standardMock(),
  notification: standardMock(),
  taskLabel: standardMock(),
  workflowTransition: standardMock(),
  role: standardMock(),
  permission: standardMock(),
  rolePermission: standardMock(),
  userRoleAssignment: standardMock(),
  auditLog: standardMock(),
  keyResult: standardMock(),
  automationRule: standardMock(),
  portfolio: standardMock(),
  portfolioProject: standardMock(),
  annotation: standardMock(),
  checklistTemplate: standardMock(),
  kpiLedgerEntry: {
    ...standardMock(),
    groupBy: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn().mockResolvedValue({ _sum: { points: 0 } }),
  },
};
