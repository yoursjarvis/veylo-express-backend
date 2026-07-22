import { describe, expect, it, vi, beforeEach } from "vitest";
import { docService } from "../../src/app/services/doc.service";
import { prismaMock } from "../helpers/db";
import { rbacService } from "../../src/app/services/rbac.service";

const { docRepositoryMock } = vi.hoisted(() => ({
  docRepositoryMock: {
    createDoc: vi.fn(),
    createVersion: vi.fn(),
    createActivity: vi.fn(),
    findDocById: vi.fn(),
    findDocByIdWithTrashed: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    restoreDoc: vi.fn(),
    getProjectDocs: vi.fn(),
    searchDocs: vi.fn(),
    getRecentDocs: vi.fn(),
    upsertFavorite: vi.fn(),
    getFavoritesAndPinned: vi.fn(),
    getVersions: vi.fn(),
    findLatestVersion: vi.fn(),
    findVersionById: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    getCommentById: vi.fn(),
    deleteComment: vi.fn(),
    getComments: vi.fn(),
    getActivities: vi.fn(),
    updateDocPermission: vi.fn(),
    deleteDocPermission: vi.fn(),
    getDocPermissions: vi.fn(),
    toggleReaction: vi.fn(),
  },
}));

vi.mock("@/app/repositories/doc.repository", () => ({
  docRepository: docRepositoryMock,
}));

describe("DocService Extended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkPermission", () => {
    it("UT-DOC-01: throws ForbiddenException if user not authorized", async () => {
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(false);
      await expect(
        docService.checkPermission("u1", "p1", "perm"),
      ).rejects.toThrow(
        "Forbidden: You do not have permission to perform this action.",
      );
    });

    it("UT-DOC-02: does not throw if user is authorized", async () => {
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      await expect(
        docService.checkPermission("u1", "p1", "perm"),
      ).resolves.not.toThrow();
    });
  });

  describe("createDoc", () => {
    it("UT-DOC-03: creates doc and version and enqueues activity", async () => {
      vi.spyOn(rbacService, "authorize").mockResolvedValue(true);
      prismaMock.project.findUnique.mockResolvedValueOnce({
        organizationId: "org-1",
      });
      prismaMock.projectDoc.findFirst.mockResolvedValueOnce(null); // slug is unique
      prismaMock.projectDoc.count.mockResolvedValueOnce(0); // siblings count

      const mockDoc = { id: "d1", title: "My First Doc" };
      docRepositoryMock.createDoc.mockResolvedValueOnce(mockDoc);

      const res = await docService.createDoc(
        "p1",
        {
          title: "My First Doc",
          content: { type: "doc" },
        },
        "u1",
      );

      expect(docRepositoryMock.createDoc).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "p1",
          organizationId: "org-1",
          title: "My First Doc",
          slug: "my-first-doc",
          order: 0,
        }),
      );
      expect(docRepositoryMock.createVersion).toHaveBeenCalled();
      expect(docRepositoryMock.createActivity).toHaveBeenCalled();
      expect(res).toEqual(mockDoc);
    });
  });

  describe("updateDoc", () => {
    it("UT-DOC-04: throws NotFoundException if doc not found", async () => {
      vi.spyOn(rbacService, "authorize").mockResolvedValue(true);
      docRepositoryMock.findDocById.mockResolvedValueOnce(null);

      await expect(
        docService.updateDoc("d1", "p1", { title: "New Title" }, "u1"),
      ).rejects.toThrow("Document not found");
    });

    it("UT-DOC-05: updates doc successfully and adds version", async () => {
      vi.spyOn(rbacService, "authorize").mockResolvedValue(true);
      const mockDoc = {
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
        title: "Old Title",
        permissions: [],
      };
      docRepositoryMock.findDocById.mockResolvedValueOnce(mockDoc);
      docRepositoryMock.findLatestVersion.mockResolvedValueOnce({ version: 1 });
      docRepositoryMock.updateDoc.mockResolvedValueOnce({
        ...mockDoc,
        title: "New Title",
      });

      const res = await docService.updateDoc(
        "d1",
        { title: "New Title", content: "hello" },
        "u1",
      );

      expect(docRepositoryMock.updateDoc).toHaveBeenCalledWith("d1", {
        title: "New Title",
        content: "hello",
        slug: "new-title",
        updatedBy: "u1",
      });
      expect(docRepositoryMock.createVersion).toHaveBeenCalledWith({
        docId: "d1",
        organizationId: "org-1",
        content: "hello",
        createdBy: "u1",
        version: 2,
      });
      expect(res.title).toBe("New Title");
    });
  });

  describe("getDoc", () => {
    it("throws NotFoundException if document not found", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce(null);
      await expect(docService.getDoc("d-missing", "u1")).rejects.toThrow(
        "Document not found",
      );
    });

    it("allows access with matching custom permissions", async () => {
      const mockDoc = {
        id: "d1",
        projectId: "p1",
        permissions: [{ userId: "u1", permission: "view" }],
      };
      docRepositoryMock.findDocById.mockResolvedValueOnce(mockDoc);
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true); // checkPermission

      const res = await docService.getDoc("d1", "u1");
      expect(res).toEqual(mockDoc);
    });

    it("allows access for project manager if custom permissions exist but user not explicitly permitted", async () => {
      const mockDoc = {
        id: "d1",
        projectId: "p1",
        permissions: [{ userId: "other", permission: "view" }],
      };
      docRepositoryMock.findDocById.mockResolvedValueOnce(mockDoc);
      vi.spyOn(rbacService, "authorize")
        .mockResolvedValueOnce(true) // checkPermission
        .mockResolvedValueOnce(true); // manage-permissions check

      const res = await docService.getDoc("d1", "u1");
      expect(res).toEqual(mockDoc);
    });

    it("throws ForbiddenException if document has custom permissions and user is not permitted and is not project admin", async () => {
      const mockDoc = {
        id: "d1",
        projectId: "p1",
        permissions: [{ userId: "other", permission: "view" }],
      };
      docRepositoryMock.findDocById.mockResolvedValueOnce(mockDoc);
      vi.spyOn(rbacService, "authorize")
        .mockResolvedValueOnce(true) // checkPermission
        .mockResolvedValueOnce(false); // manage-permissions check

      await expect(docService.getDoc("d1", "u1")).rejects.toThrow(
        "You do not have permission to access this document.",
      );
    });
  });

  describe("updateDoc edit checks", () => {
    it("throws ForbiddenException if document has custom permissions and user is read-only", async () => {
      const mockDoc = {
        id: "d1",
        projectId: "p1",
        permissions: [{ userId: "u1", permission: "view" }],
      };
      docRepositoryMock.findDocById.mockResolvedValueOnce(mockDoc);
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true); // checkPermission

      await expect(
        docService.updateDoc("d1", { title: "Attempt edit" }, "u1"),
      ).rejects.toThrow("You only have read-only access to this document.");
    });

    it("auto versioning checks logic inside updateDoc", async () => {
      const mockDoc = {
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
        title: "Title",
        permissions: [],
      };
      docRepositoryMock.findDocById.mockResolvedValueOnce(mockDoc);
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      docRepositoryMock.updateDoc.mockResolvedValueOnce(mockDoc);

      // Latest version exists, was created by the same user and is recent (< 5 mins) -> do not save version
      docRepositoryMock.findLatestVersion.mockResolvedValueOnce({
        version: 1,
        createdBy: "u1",
        createdAt: new Date().toISOString(),
      });

      await docService.updateDoc("d1", { content: "updated-content" }, "u1");
      expect(docRepositoryMock.createVersion).not.toHaveBeenCalled();
    });
  });

  describe("deleteDoc and restoreDoc", () => {
    it("deletes a document and writes delete activity", async () => {
      const mockDoc = {
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
        title: "D",
      };
      docRepositoryMock.findDocById.mockResolvedValueOnce(mockDoc);
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      docRepositoryMock.deleteDoc.mockResolvedValueOnce(undefined);

      await docService.deleteDoc("d1", "u1");
      expect(docRepositoryMock.deleteDoc).toHaveBeenCalledWith("d1", "u1");
      expect(docRepositoryMock.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "deleted" }),
      );
    });

    it("restores a document and writes restore activity", async () => {
      const mockDoc = {
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
        title: "D",
      };
      docRepositoryMock.findDocByIdWithTrashed.mockResolvedValueOnce(mockDoc);
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      docRepositoryMock.restoreDoc.mockResolvedValueOnce(undefined);

      await docService.restoreDoc("d1", "u1");
      expect(docRepositoryMock.restoreDoc).toHaveBeenCalledWith("d1", "u1");
      expect(docRepositoryMock.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "restored" }),
      );
    });

    it("throws NotFoundException if restore target not found", async () => {
      docRepositoryMock.findDocByIdWithTrashed.mockResolvedValueOnce(null);
      await expect(docService.restoreDoc("d-missing", "u1")).rejects.toThrow(
        "Document not found",
      );
    });
  });

  describe("duplicateDoc recursive", () => {
    it("recursively duplicates document and its children", async () => {
      const parentDoc = {
        id: "d1",
        projectId: "p1",
        parentId: null,
        title: "Parent",
      };
      docRepositoryMock.findDocById.mockResolvedValueOnce(parentDoc);
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);

      prismaMock.projectDoc.findUnique.mockResolvedValueOnce({
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
        title: "Parent",
        emoji: "📁",
        children: [{ id: "child-1", deleted: false }],
      } as unknown);
      prismaMock.projectDoc.findFirst.mockResolvedValueOnce(null); // Parent Copy slug check
      prismaMock.projectDoc.create.mockResolvedValueOnce({
        id: "d1-copy",
      } as unknown);

      // Child mock
      prismaMock.projectDoc.findUnique.mockResolvedValueOnce({
        id: "child-1",
        projectId: "p1",
        organizationId: "org-1",
        title: "Child",
        children: [],
      } as unknown);
      prismaMock.projectDoc.findFirst.mockResolvedValueOnce(null); // Child slug check
      prismaMock.projectDoc.create.mockResolvedValueOnce({
        id: "child-1-copy",
      } as unknown);

      docRepositoryMock.findDocById.mockResolvedValueOnce({
        id: "d1-copy",
        organizationId: "org-1",
        title: "Parent Copy",
      });

      const res = await docService.duplicateDoc("d1", "u1");
      expect(res).toBeDefined();
      expect(prismaMock.projectDoc.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("various endpoints: search, recent, favorites, versions, comments", () => {
    it("searches and returns project docs", async () => {
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      docRepositoryMock.searchDocs.mockResolvedValueOnce([]);
      await docService.searchDocs("p1", "query", "u1");
      expect(docRepositoryMock.searchDocs).toHaveBeenCalledWith(
        "p1",
        "query",
        "u1",
      );
    });

    it("gets recent docs", async () => {
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      docRepositoryMock.getRecentDocs.mockResolvedValueOnce([]);
      await docService.getRecentDocs("p1", "u1", 5);
      expect(docRepositoryMock.getRecentDocs).toHaveBeenCalledWith(
        "p1",
        "u1",
        5,
      );
    });

    it("toggles favorite", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce({
        id: "d1",
        organizationId: "org-1",
      });
      await docService.toggleFavorite("d1", "u1", { isFavorite: true });
      expect(docRepositoryMock.upsertFavorite).toHaveBeenCalledWith(
        "d1",
        "u1",
        "org-1",
        { isFavorite: true },
      );
    });

    it("gets versions and restores a specific version", async () => {
      docRepositoryMock.findDocById.mockResolvedValue({
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
      });
      vi.spyOn(rbacService, "authorize").mockResolvedValue(true);
      docRepositoryMock.getVersions.mockResolvedValueOnce([{ id: "v1" }]);
      docRepositoryMock.findVersionById.mockResolvedValueOnce({
        docId: "d1",
        version: 1,
        content: "old content",
      });
      docRepositoryMock.updateDoc.mockResolvedValueOnce({});
      docRepositoryMock.findLatestVersion.mockResolvedValueOnce({ version: 1 });

      await docService.getVersions("d1", "u1");
      expect(docRepositoryMock.getVersions).toHaveBeenCalledWith("d1");

      await docService.restoreVersion("d1", "v1", "u1");
      expect(docRepositoryMock.updateDoc).toHaveBeenCalledWith(
        "d1",
        expect.objectContaining({ content: "old content" }),
      );
      expect(docRepositoryMock.createVersion).toHaveBeenCalled();
    });

    it("gets favorites", async () => {
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      docRepositoryMock.getFavoritesAndPinned.mockResolvedValueOnce([]);
      await docService.getFavorites("p1", "u1");
      expect(docRepositoryMock.getFavoritesAndPinned).toHaveBeenCalledWith(
        "p1",
        "u1",
      );
    });

    it("gets comments", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce({
        id: "d1",
        projectId: "p1",
      });
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      await docService.getComments("d1", "u1");
      expect(docRepositoryMock.getComments).toHaveBeenCalledWith("d1");
    });

    it("creates comment (parent/reply)", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce({
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
      });
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      docRepositoryMock.createComment.mockResolvedValueOnce({ id: "c1" });

      await docService.createComment("d1", "content", "u1", "parent-c");
      expect(docRepositoryMock.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: "parent-c", content: "content" }),
      );
    });

    it("updates and deletes comment permissions/owner constraints", async () => {
      docRepositoryMock.getCommentById.mockResolvedValue({
        id: "c1",
        userId: "author-user",
        docId: "d1",
        doc: { projectId: "p1", organizationId: "org-1" },
      } as unknown);
      vi.spyOn(rbacService, "authorize").mockResolvedValue(true);

      // Updating content for someone else's comment throws Forbidden
      await expect(
        docService.updateComment(
          "c1",
          { content: "Updated content" },
          "not-author",
        ),
      ).rejects.toThrow("You can only edit your own comments.");

      // Resolving comment does not throw, writes activity
      docRepositoryMock.updateComment.mockResolvedValueOnce({});
      await docService.updateComment("c1", { resolved: true }, "any-user");
      expect(docRepositoryMock.createActivity).toHaveBeenCalled();

      // Deleting someone else's comment checks project admin permission
      vi.spyOn(rbacService, "authorize")
        .mockResolvedValueOnce(true) // checkPermission
        .mockResolvedValueOnce(false); // delete permission bypass check

      await expect(
        docService.deleteComment("c1", "not-author"),
      ).rejects.toThrow("You can only delete your own comments.");

      vi.spyOn(rbacService, "authorize")
        .mockResolvedValueOnce(true) // checkPermission
        .mockResolvedValueOnce(true); // delete permission bypass check

      await docService.deleteComment("c1", "not-author");
      expect(docRepositoryMock.deleteComment).toHaveBeenCalledWith("c1");
    });
  });

  describe("Permissions, reactions and breadcrumbs", () => {
    it("gets permissions, updates, and deletes permissions", async () => {
      docRepositoryMock.findDocById.mockResolvedValue({
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
      });
      vi.spyOn(rbacService, "authorize").mockResolvedValue(true);

      await docService.getPermissions("d1", "u1");
      expect(docRepositoryMock.getDocPermissions).toHaveBeenCalledWith("d1");

      await docService.updatePermission("d1", "target-u", "edit", "u1");
      expect(docRepositoryMock.updateDocPermission).toHaveBeenCalledWith(
        "d1",
        "target-u",
        "org-1",
        "edit",
      );

      await docService.deletePermission("d1", "target-u", "u1");
      expect(docRepositoryMock.deleteDocPermission).toHaveBeenCalledWith(
        "d1",
        "target-u",
      );
    });

    it("gets breadcrumbs", async () => {
      docRepositoryMock.findDocById.mockResolvedValue({
        id: "d2",
        parentId: "d1",
        title: "Child",
        slug: "child",
      });
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      prismaMock.projectDoc.findUnique.mockResolvedValueOnce({
        id: "d1",
        parentId: null,
        title: "Parent",
        slug: "parent",
      } as unknown);

      const breadcrumbs = await docService.getBreadcrumbs("d2", "u1");
      expect(breadcrumbs).toHaveLength(2);
      expect(breadcrumbs[0].title).toBe("Parent");
      expect(breadcrumbs[1].title).toBe("Child");
    });

    it("toggles reaction on comment", async () => {
      docRepositoryMock.getCommentById.mockResolvedValue({
        id: "c1",
        doc: { projectId: "p1", organizationId: "org-1" },
      } as unknown);
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);

      await docService.toggleReaction("c1", "❤️", "u1");
      expect(docRepositoryMock.toggleReaction).toHaveBeenCalledWith(
        expect.objectContaining({ emoji: "❤️", userId: "u1" }),
      );
    });

    it("gets activities", async () => {
      docRepositoryMock.findDocById.mockResolvedValue({
        id: "d1",
        projectId: "p1",
      });
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);

      await docService.getActivities("d1", "u1");
      expect(docRepositoryMock.getActivities).toHaveBeenCalledWith("d1");
    });
  });

  describe("Exceptions and not found checks for document details", () => {
    it("throws NotFoundException if document not found in toggleFavorite", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce(null);
      await expect(
        docService.toggleFavorite("d-missing", "u1", { isFavorite: true }),
      ).rejects.toThrow("Document not found");
    });

    it("throws NotFoundException if document not found in getVersions", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce(null);
      await expect(docService.getVersions("d-missing", "u1")).rejects.toThrow(
        "Document not found",
      );
    });

    it("throws NotFoundException if document not found in restoreVersion", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce(null);
      await expect(
        docService.restoreVersion("d-missing", "v1", "u1"),
      ).rejects.toThrow("Document not found");
    });

    it("throws NotFoundException if version not found or document ID mismatch in restoreVersion", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce({
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
      });
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      docRepositoryMock.findVersionById.mockResolvedValueOnce(null); // not found
      await expect(docService.restoreVersion("d1", "v1", "u1")).rejects.toThrow(
        "Version not found for this document",
      );

      docRepositoryMock.findDocById.mockResolvedValueOnce({
        id: "d1",
        projectId: "p1",
        organizationId: "org-1",
      });
      vi.spyOn(rbacService, "authorize").mockResolvedValueOnce(true);
      docRepositoryMock.findVersionById.mockResolvedValueOnce({
        docId: "different-doc",
      }); // mismatch
      await expect(docService.restoreVersion("d1", "v1", "u1")).rejects.toThrow(
        "Version not found for this document",
      );
    });

    it("throws NotFoundException if document not found in getComments", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce(null);
      await expect(docService.getComments("d-missing", "u1")).rejects.toThrow(
        "Document not found",
      );
    });

    it("throws NotFoundException if document not found in createComment", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce(null);
      await expect(
        docService.createComment("d-missing", "content", "u1"),
      ).rejects.toThrow("Document not found");
    });

    it("throws NotFoundException if comment not found in updateComment", async () => {
      docRepositoryMock.getCommentById.mockResolvedValueOnce(null);
      await expect(
        docService.updateComment("c-missing", { content: "content" }, "u1"),
      ).rejects.toThrow("Comment not found");
    });

    it("throws NotFoundException if comment not found in deleteComment", async () => {
      docRepositoryMock.getCommentById.mockResolvedValueOnce(null);
      await expect(docService.deleteComment("c-missing", "u1")).rejects.toThrow(
        "Comment not found",
      );
    });

    it("throws NotFoundException if document not found in permissions endpoints", async () => {
      docRepositoryMock.findDocById.mockResolvedValue(null);
      await expect(
        docService.getPermissions("d-missing", "u1"),
      ).rejects.toThrow("Document not found");
      await expect(
        docService.updatePermission("d-missing", "target-u", "edit", "u1"),
      ).rejects.toThrow("Document not found");
      await expect(
        docService.deletePermission("d-missing", "target-u", "u1"),
      ).rejects.toThrow("Document not found");
    });

    it("throws NotFoundException if document not found in getBreadcrumbs", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce(null);
      await expect(
        docService.getBreadcrumbs("d-missing", "u1"),
      ).rejects.toThrow("Document not found");
    });

    it("throws NotFoundException if comment not found in toggleReaction", async () => {
      docRepositoryMock.getCommentById.mockResolvedValueOnce(null);
      await expect(
        docService.toggleReaction("c-missing", "👍", "u1"),
      ).rejects.toThrow("Comment not found");
    });

    it("throws NotFoundException if document not found in getActivities", async () => {
      docRepositoryMock.findDocById.mockResolvedValueOnce(null);
      await expect(docService.getActivities("d-missing", "u1")).rejects.toThrow(
        "Document not found",
      );
    });
  });
});
