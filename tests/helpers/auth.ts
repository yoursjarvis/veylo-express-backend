import { vi } from "vitest";

// Mutable session data that holds the currently authenticated user
let mockSessionValue: unknown = {
  user: {
    id: "user-123",
    email: "user@example.com",
    firstName: "Test",
    lastName: "User",
  },
  session: {
    id: "session-123",
    activeOrganizationId: "org-123",
    token: "mock-token",
  },
};

/**
 * Dynamic Mock Implementation for Better Auth getSession
 */
export const getSessionMock = vi
  .fn()
  .mockImplementation((options?: { returnHeaders?: boolean }) => {
    if (mockSessionValue === null) {
      if (options?.returnHeaders) {
        return Promise.resolve({
          response: null,
          headers: new Headers(),
        });
      }
      return Promise.resolve(null);
    }

    if (options?.returnHeaders) {
      return Promise.resolve({
        response: mockSessionValue,
        headers: new Headers(),
      });
    }
    return Promise.resolve(mockSessionValue);
  });

/**
 * Configure the mocked user session for subsequent requests.
 */
export function setMockUser(user: unknown, sessionExtra?: unknown) {
  mockSessionValue = {
    user,
    session: {
      id: "session-123",
      activeOrganizationId: "org-123",
      token: "mock-token",
      ...sessionExtra,
    },
  };
}

/**
 * Remove any active mocked session, simulating an unauthenticated caller.
 */
export function clearMockUser() {
  mockSessionValue = null;
}
