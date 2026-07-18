import { describe, it, expect, vi } from "vitest";
import { docRepository } from "@/app/repositories/doc.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("DocRepository", () => {
  it("should create document", async () => {
    const data = {
      projectId: "proj-1",
      organizationId: "org-1",
      title: "Doc 1",
      slug: "doc-1",
      createdBy: "user-1",
      updatedBy: "user-1",
    };
    prismaMock.projectDoc.create.mockResolvedValueOnce({ id: "doc-1", ...data });
    const result = await docRepository.createDoc(data);
    expect(prismaMock.projectDoc.create).toHaveBeenCalled();
    expect(result.id).toBe("doc-1");
  });

  it("should find document by id (with & without trashed)", async () => {
    prismaMock.projectDoc.findFirst.mockResolvedValue({ id: "doc-1" });
    expect(await docRepository.findDocById("doc-1")).toEqual({ id: "doc-1" });
    expect(await docRepository.findDocByIdWithTrashed("doc-1")).toEqual({ id: "doc-1" });
  });

  it("should update document", async () => {
    prismaMock.projectDoc.update.mockResolvedValueOnce({ id: "doc-1", title: "Updated" });
    const result = await docRepository.updateDoc("doc-1", { title: "Updated", updatedBy: "user-1" });
    expect(prismaMock.projectDoc.update).toHaveBeenCalled();
    expect(result.title).toBe("Updated");
  });

  it("should delete & restore documents", async () => {
    prismaMock.projectDoc.update.mockResolvedValue({ id: "doc-1" });
    expect(await docRepository.deleteDoc("doc-1", "user-1")).toBeDefined();
    expect(await docRepository.restoreDoc("doc-1", "user-1")).toBeDefined();
  });

  it("should list project docs, search, and get recent docs", async () => {
    prismaMock.projectDoc.findMany.mockResolvedValue([{ id: "doc-1" }]);

    expect(await docRepository.getProjectDocs("proj-1", "user-1")).toHaveLength(1);
    expect(await docRepository.searchDocs("proj-1", "query", "user-1")).toHaveLength(1);
    expect(await docRepository.getRecentDocs("proj-1", "user-1")).toHaveLength(1);
  });

  it("should manage favorite/pin upsert and list favorites/pinned", async () => {
    prismaMock.projectDocFavorite.upsert.mockResolvedValueOnce({ id: "fav-1" });
    prismaMock.projectDoc.findMany.mockResolvedValueOnce([{ id: "doc-1" }]);

    const upserted = await docRepository.upsertFavorite("doc-1", "user-1", "org-1", { isFavorite: true });
    const listed = await docRepository.getFavoritesAndPinned("proj-1", "user-1");

    expect(upserted).toBeDefined();
    expect(listed).toHaveLength(1);
  });

  it("should manage document versions (create, list, findLatest, findById)", async () => {
    prismaMock.projectDocVersion.create.mockResolvedValueOnce({ id: "ver-1" });
    prismaMock.projectDocVersion.findMany.mockResolvedValueOnce([{ id: "ver-1" }]);
    prismaMock.projectDocVersion.findFirst.mockResolvedValueOnce({ id: "ver-1", version: 1 });
    prismaMock.projectDocVersion.findUnique.mockResolvedValueOnce({ id: "ver-1" });

    expect(await docRepository.createVersion({ docId: "doc-1", organizationId: "org-1", content: {}, createdBy: "user-1", version: 1 })).toEqual({ id: "ver-1" });
    expect(await docRepository.getVersions("doc-1")).toHaveLength(1);
    expect(await docRepository.findLatestVersion("doc-1")).toEqual({ id: "ver-1", version: 1 });
    expect(await docRepository.findVersionById("ver-1")).toEqual({ id: "ver-1" });
  });

  it("should manage comments (create, update, getById, delete, list)", async () => {
    prismaMock.projectDocComment.create.mockResolvedValueOnce({ id: "c-1" });
    prismaMock.projectDocComment.update.mockResolvedValueOnce({ id: "c-1", content: "New" });
    prismaMock.projectDocComment.findUnique.mockResolvedValueOnce({ id: "c-1" });
    prismaMock.projectDocComment.delete.mockResolvedValueOnce({ id: "c-1" });
    prismaMock.projectDocComment.findMany.mockResolvedValueOnce([{ id: "c-1" }]);

    expect(await docRepository.createComment({ docId: "doc-1", userId: "user-1", organizationId: "org-1", content: "comment" })).toEqual({ id: "c-1" });
    expect(await docRepository.updateComment("c-1", { content: "New" })).toEqual({ id: "c-1", content: "New" });
    expect(await docRepository.getCommentById("c-1")).toEqual({ id: "c-1" });
    expect(await docRepository.deleteComment("c-1")).toEqual({ id: "c-1" });
    expect(await docRepository.getComments("doc-1")).toHaveLength(1);
  });

  it("should manage document activities", async () => {
    prismaMock.projectDocActivity.create.mockResolvedValueOnce({ id: "act-1" });
    prismaMock.projectDocActivity.findMany.mockResolvedValueOnce([{ id: "act-1" }]);

    expect(await docRepository.createActivity({ docId: "doc-1", userId: "user-1", organizationId: "org-1", action: "create" })).toEqual({ id: "act-1" });
    expect(await docRepository.getActivities("doc-1")).toHaveLength(1);
  });

  it("should manage document custom permissions", async () => {
    prismaMock.projectDocPermission.upsert.mockResolvedValueOnce({ id: "perm-1" });
    prismaMock.projectDocPermission.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.projectDocPermission.findMany.mockResolvedValueOnce([{ id: "perm-1" }]);

    expect(await docRepository.updateDocPermission("doc-1", "user-1", "org-1", "edit")).toEqual({ id: "perm-1" });
    expect(await docRepository.deleteDocPermission("doc-1", "user-1")).toBeDefined();
    expect(await docRepository.getDocPermissions("doc-1")).toHaveLength(1);
  });

  it("should toggle comment reaction (create if not exist, delete if exist)", async () => {
    // Case 1: Reaction exists -> delete it
    prismaMock.projectDocCommentReaction.findUnique.mockResolvedValueOnce({ id: "re-1" });
    prismaMock.projectDocCommentReaction.delete.mockResolvedValueOnce({ id: "re-1" });
    const res1 = await docRepository.toggleReaction({ commentId: "c-1", userId: "user-1", organizationId: "org-1", emoji: "smile" });
    expect(prismaMock.projectDocCommentReaction.delete).toHaveBeenCalled();

    // Case 2: Reaction does not exist -> create it
    prismaMock.projectDocCommentReaction.findUnique.mockResolvedValueOnce(null);
    prismaMock.projectDocCommentReaction.create.mockResolvedValueOnce({ id: "re-2" });
    const res2 = await docRepository.toggleReaction({ commentId: "c-1", userId: "user-1", organizationId: "org-1", emoji: "smile" });
    expect(prismaMock.projectDocCommentReaction.create).toHaveBeenCalled();
  });
});
