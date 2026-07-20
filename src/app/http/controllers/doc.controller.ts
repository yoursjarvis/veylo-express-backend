import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { docService } from "@/app/services/doc.service";
import {
  createDocSchema,
  updateDocSchema,
  favoriteSchema,
  commentSchema,
  commentUpdateSchema,
  docPermissionSchema,
} from "@/app/http/validators/doc.validator";
import { ok } from "@/utils/http-response";
import { BadRequestException } from "@/utils/app-error";

export const docController = {
  createDoc: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const userId = req.auth!.user.id as string;
    const validatedData = createDocSchema.parse(req.body);

    const doc = await docService.createDoc(projectId, validatedData as unknown as Parameters<typeof docService.createDoc>[1], userId);
    return ok(res, "Document created successfully", doc, 201);
  }),

  getDoc: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;

    const doc = await docService.getDoc(id, userId);
    return ok(res, "Document retrieved successfully", doc);
  }),

  updateDoc: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;
    const validatedData = updateDocSchema.parse(req.body);

    const doc = await docService.updateDoc(id, validatedData as unknown as Parameters<typeof docService.updateDoc>[1], userId);
    return ok(res, "Document updated successfully", doc);
  }),

  deleteDoc: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;

    await docService.deleteDoc(id, userId);
    return ok(res, "Document deleted successfully");
  }),

  restoreDoc: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;

    const doc = await docService.restoreDoc(id, userId);
    return ok(res, "Document restored successfully", doc);
  }),

  duplicateDoc: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;

    const doc = await docService.duplicateDoc(id, userId);
    return ok(res, "Document duplicated successfully", doc, 201);
  }),

  getProjectDocs: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const userId = req.auth!.user.id as string;

    const docs = await docService.getProjectDocs(projectId, userId);
    return ok(res, "Documents retrieved successfully", docs);
  }),

  searchDocs: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const query = req.query.q as string;
    const userId = req.auth!.user.id as string;

    if (!query) {
      throw new BadRequestException("Search query 'q' is required.");
    }

    const docs = await docService.searchDocs(projectId, query, userId);
    return ok(res, "Documents searched successfully", docs);
  }),

  getRecentDocs: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const userId = req.auth!.user.id as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const docs = await docService.getRecentDocs(projectId, userId, limit);
    return ok(res, "Recent documents retrieved successfully", docs);
  }),

  // Favorites
  toggleFavorite: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;
    const validatedData = favoriteSchema.parse(req.body);

    const favorite = await docService.toggleFavorite(id, userId, validatedData);
    return ok(res, "Favorite updated successfully", favorite);
  }),

  getFavorites: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const userId = req.auth!.user.id as string;

    const docs = await docService.getFavorites(projectId, userId);
    return ok(res, "Favorite documents retrieved successfully", docs);
  }),

  // Versions
  getVersions: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;

    const versions = await docService.getVersions(id, userId);
    return ok(res, "Document versions retrieved successfully", versions);
  }),

  restoreVersion: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const versionId = req.params.versionId as string;
    const userId = req.auth!.user.id as string;

    const doc = await docService.restoreVersion(id, versionId, userId);
    return ok(res, "Document version restored successfully", doc);
  }),

  // Comments
  getComments: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;

    const comments = await docService.getComments(id, userId);
    return ok(res, "Comments retrieved successfully", comments);
  }),

  createComment: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;
    const validatedData = commentSchema.parse(req.body);

    const comment = await docService.createComment(id, validatedData.content, userId, validatedData.parentId);
    return ok(res, "Comment created successfully", comment, 201);
  }),

  updateComment: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const userId = req.auth!.user.id as string;
    const validatedData = commentUpdateSchema.parse(req.body);

    const comment = await docService.updateComment(commentId, validatedData, userId);
    return ok(res, "Comment updated successfully", comment);
  }),

  deleteComment: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const userId = req.auth!.user.id as string;

    await docService.deleteComment(commentId, userId);
    return ok(res, "Comment deleted successfully");
  }),

  toggleReaction: asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const userId = req.auth!.user.id as string;
    const validatedData = z.object({
      emoji: z.string().min(1)
    }).parse(req.body);

    const reaction = await docService.toggleReaction(commentId, validatedData.emoji, userId);
    return ok(res, "Comment reaction toggled successfully", reaction);
  }),

  // Sharing & permissions
  getPermissions: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;

    const permissions = await docService.getPermissions(id, userId);
    return ok(res, "Document permissions retrieved successfully", permissions);
  }),

  updatePermission: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;
    const validatedData = docPermissionSchema.parse(req.body);

    const perm = await docService.updatePermission(id, validatedData.userId, validatedData.permission, userId);
    return ok(res, "Permission updated successfully", perm);
  }),

  deletePermission: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const targetUserId = req.params.targetUserId as string;
    const userId = req.auth!.user.id as string;

    await docService.deletePermission(id, targetUserId, userId);
    return ok(res, "Permission deleted successfully");
  }),

  // Breadcrumbs
  getBreadcrumbs: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;

    const breadcrumbs = await docService.getBreadcrumbs(id, userId);
    return ok(res, "Breadcrumbs retrieved successfully", breadcrumbs);
  }),

  // Activities
  getActivities: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.auth!.user.id as string;

    const activities = await docService.getActivities(id, userId);
    return ok(res, "Activities retrieved successfully", activities);
  })
};
