/**
 * Test entity factories for generating mock data structures
 */

export function createUser(overrides?: any) {
  const rand = Math.random().toString(36).substring(2, 7);
  return {
    id: `user-${rand}`,
    email: `test-${rand}@example.com`,
    firstName: "Test",
    lastName: "User",
    isActive: true,
    deletedAt: null,
    lockedUntil: null,
    ...overrides,
  };
}

export function createWorkspace(overrides?: any) {
  const rand = Math.random().toString(36).substring(2, 7);
  return {
    id: `ws-${rand}`,
    name: "Acme Web Workspace",
    slug: `acme-web-${rand}`,
    organizationId: "org-123",
    createdAt: new Date(),
    ...overrides,
  };
}

export function createOrganization(overrides?: any) {
  const rand = Math.random().toString(36).substring(2, 7);
  return {
    id: `org-${rand}`,
    name: "Acme Corporation",
    slug: `acme-corp-${rand}`,
    logo: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createProject(overrides?: any) {
  const rand = Math.random().toString(36).substring(2, 7);
  return {
    id: `proj-${rand}`,
    title: "Veylo Development",
    description: "Main workspace project",
    icon: "Folder",
    template: "software-scrum",
    teamMode: "software",
    workspaceId: "ws-123",
    organizationId: "org-123",
    createdAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}
