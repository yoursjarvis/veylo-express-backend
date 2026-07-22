import { describe, expect, it, vi, beforeEach } from "vitest";
import { orgService } from "../../src/app/services/org.service";

const { orgRepositoryMock } = vi.hoisted(() => ({
  orgRepositoryMock: {
    findUserById: vi.fn(),
    findSessionById: vi.fn(),
    findOwnerMember: vi.fn(),
    findOrgBySlug: vi.fn(),
    createOrganizationWithOwnerAndWorkspace: vi.fn(),
    updateOrgLogo: vi.fn(),
  },
}));

const { mediaServiceMock } = vi.hoisted(() => ({
  mediaServiceMock: {
    addMedia: vi.fn(),
    generateUrl: vi.fn(),
  },
}));

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    del: vi.fn(),
  },
}));

vi.mock("@/app/repositories/org.repository", () => ({
  orgRepository: orgRepositoryMock,
}));

vi.mock("@/core/media/media.service", () => ({
  mediaService: mediaServiceMock,
}));

vi.mock("@/lib/redis", () => ({
  redis: redisMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("OrgService", () => {
  const userId = "user-1";
  const session = { id: "session-1", token: "token-abc" };
  const data = { name: "Acme Inc", slug: "acme", workspaceName: "Default" };

  const mockOrgResult = {
    org: { id: "org-1", name: "Acme Inc", logo: null },
    workspace: { id: "ws-1" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws UnauthorizedException when user or session not found in DB", async () => {
    orgRepositoryMock.findUserById.mockResolvedValueOnce(null);
    orgRepositoryMock.findSessionById.mockResolvedValueOnce({
      id: "session-1",
    });

    await expect(
      orgService.setupOrganization(userId, session, data),
    ).rejects.toThrow("Unauthorized: Session is stale or invalid");
  });

  it("throws UnauthorizedException when session not found", async () => {
    orgRepositoryMock.findUserById.mockResolvedValueOnce({ id: userId });
    orgRepositoryMock.findSessionById.mockResolvedValueOnce(null);

    await expect(
      orgService.setupOrganization(userId, session, data),
    ).rejects.toThrow("Unauthorized: Session is stale or invalid");
  });

  it("throws BadRequestException if user already owns an org", async () => {
    orgRepositoryMock.findUserById.mockResolvedValueOnce({ id: userId });
    orgRepositoryMock.findSessionById.mockResolvedValueOnce({
      id: "session-1",
    });
    orgRepositoryMock.findOwnerMember.mockResolvedValueOnce({
      id: "org-existing",
    });

    await expect(
      orgService.setupOrganization(userId, session, data),
    ).rejects.toThrow("You have already created an organization.");
  });

  it("throws BadRequestException if slug is already taken", async () => {
    orgRepositoryMock.findUserById.mockResolvedValueOnce({ id: userId });
    orgRepositoryMock.findSessionById.mockResolvedValueOnce({
      id: "session-1",
    });
    orgRepositoryMock.findOwnerMember.mockResolvedValueOnce(null);
    orgRepositoryMock.findOrgBySlug.mockResolvedValueOnce({ id: "org-taken" });

    await expect(
      orgService.setupOrganization(userId, session, data),
    ).rejects.toThrow("This URL slug is already taken.");
  });

  it("creates org successfully without a logo file", async () => {
    orgRepositoryMock.findUserById.mockResolvedValueOnce({ id: userId });
    orgRepositoryMock.findSessionById.mockResolvedValueOnce({
      id: "session-1",
    });
    orgRepositoryMock.findOwnerMember.mockResolvedValueOnce(null);
    orgRepositoryMock.findOrgBySlug.mockResolvedValueOnce(null);
    orgRepositoryMock.createOrganizationWithOwnerAndWorkspace.mockResolvedValueOnce(
      mockOrgResult,
    );
    redisMock.del.mockResolvedValue(undefined);

    const result = await orgService.setupOrganization(userId, session, data);

    expect(
      orgRepositoryMock.createOrganizationWithOwnerAndWorkspace,
    ).toHaveBeenCalledWith({
      name: data.name,
      slug: data.slug,
      workspaceName: data.workspaceName,
      userId,
      sessionId: session.id,
    });
    expect(result).toEqual(mockOrgResult);
    expect(redisMock.del).toHaveBeenCalledTimes(2);
  });

  it("creates org and uploads logo when file is provided", async () => {
    orgRepositoryMock.findUserById.mockResolvedValueOnce({ id: userId });
    orgRepositoryMock.findSessionById.mockResolvedValueOnce({
      id: "session-1",
    });
    orgRepositoryMock.findOwnerMember.mockResolvedValueOnce(null);
    orgRepositoryMock.findOrgBySlug.mockResolvedValueOnce(null);
    orgRepositoryMock.createOrganizationWithOwnerAndWorkspace.mockResolvedValueOnce(
      { ...mockOrgResult },
    );
    mediaServiceMock.addMedia.mockResolvedValueOnce({
      id: "media-1",
      key: "path/logo.png",
      provider: "s3",
    });
    mediaServiceMock.generateUrl.mockReturnValueOnce(
      "https://cdn.example.com/logo.png",
    );
    orgRepositoryMock.updateOrgLogo.mockResolvedValueOnce(undefined);
    redisMock.del.mockResolvedValue(undefined);

    const file = {
      buffer: Buffer.from("fake"),
      originalname: "logo.png",
      mimetype: "image/png",
      size: 100,
    } as Express.Multer.File;

    const result = await orgService.setupOrganization(
      userId,
      session,
      data,
      file,
    );

    expect(mediaServiceMock.addMedia).toHaveBeenCalled();
    expect(orgRepositoryMock.updateOrgLogo).toHaveBeenCalledWith(
      "org-1",
      "https://cdn.example.com/logo.png",
    );
    expect(result.org.logo).toBe("https://cdn.example.com/logo.png");
  });

  it("handles logo upload error gracefully (does not throw)", async () => {
    orgRepositoryMock.findUserById.mockResolvedValueOnce({ id: userId });
    orgRepositoryMock.findSessionById.mockResolvedValueOnce({
      id: "session-1",
    });
    orgRepositoryMock.findOwnerMember.mockResolvedValueOnce(null);
    orgRepositoryMock.findOrgBySlug.mockResolvedValueOnce(null);
    orgRepositoryMock.createOrganizationWithOwnerAndWorkspace.mockResolvedValueOnce(
      mockOrgResult,
    );
    mediaServiceMock.addMedia.mockRejectedValueOnce(new Error("S3 error"));
    redisMock.del.mockResolvedValue(undefined);

    const file = {
      buffer: Buffer.from("fake"),
      originalname: "logo.png",
      mimetype: "image/png",
      size: 100,
    } as Express.Multer.File;

    // Should not throw - error is caught in try/catch
    const result = await orgService.setupOrganization(
      userId,
      session,
      data,
      file,
    );
    expect(result).toEqual(mockOrgResult);
    expect(orgRepositoryMock.updateOrgLogo).not.toHaveBeenCalled();
  });

  it("handles Redis invalidation error gracefully (does not throw)", async () => {
    orgRepositoryMock.findUserById.mockResolvedValueOnce({ id: userId });
    orgRepositoryMock.findSessionById.mockResolvedValueOnce({
      id: "session-1",
    });
    orgRepositoryMock.findOwnerMember.mockResolvedValueOnce(null);
    orgRepositoryMock.findOrgBySlug.mockResolvedValueOnce(null);
    orgRepositoryMock.createOrganizationWithOwnerAndWorkspace.mockResolvedValueOnce(
      mockOrgResult,
    );
    redisMock.del.mockRejectedValue(new Error("Redis down"));

    // Should not throw - redis error is caught
    const result = await orgService.setupOrganization(userId, session, data);
    expect(result).toEqual(mockOrgResult);
  });

  it("skips logo update when generateUrl returns null/falsy", async () => {
    const freshResult = {
      org: { id: "org-1", name: "Acme Inc", logo: null },
      workspace: { id: "ws-1" },
    };
    orgRepositoryMock.findUserById.mockResolvedValueOnce({ id: userId });
    orgRepositoryMock.findSessionById.mockResolvedValueOnce({
      id: "session-1",
    });
    orgRepositoryMock.findOwnerMember.mockResolvedValueOnce(null);
    orgRepositoryMock.findOrgBySlug.mockResolvedValueOnce(null);
    orgRepositoryMock.createOrganizationWithOwnerAndWorkspace.mockResolvedValueOnce(
      freshResult,
    );
    mediaServiceMock.addMedia.mockResolvedValueOnce({
      id: "media-1",
      key: "path/logo.png",
      provider: "s3",
    });
    mediaServiceMock.generateUrl.mockReturnValueOnce(null); // No URL generated
    redisMock.del.mockResolvedValue(undefined);

    const file = {
      buffer: Buffer.from("fake"),
      originalname: "logo.png",
      mimetype: "image/png",
      size: 100,
    } as Express.Multer.File;

    const result = await orgService.setupOrganization(
      userId,
      session,
      data,
      file,
    );
    // updateOrgLogo should NOT be called when url is null
    expect(orgRepositoryMock.updateOrgLogo).not.toHaveBeenCalled();
    expect(result.org.logo).toBeNull();
  });
});
