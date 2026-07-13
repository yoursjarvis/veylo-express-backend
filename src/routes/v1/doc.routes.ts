import { Router } from "express";
import { docController } from "@/app/http/controllers/doc.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";

export const docRoutes = Router();

// Project docs list, search, recent, favorites
docRoutes.post("/projects/:projectId/docs", requireAuth, docController.createDoc);
docRoutes.get("/projects/:projectId/docs", requireAuth, docController.getProjectDocs);
docRoutes.get("/projects/:projectId/docs/search", requireAuth, docController.searchDocs);
docRoutes.get("/projects/:projectId/docs/recent", requireAuth, docController.getRecentDocs);
docRoutes.get("/projects/:projectId/docs/favorites", requireAuth, docController.getFavorites);

// Single doc operations
docRoutes.get("/docs/:id", requireAuth, docController.getDoc);
docRoutes.patch("/docs/:id", requireAuth, docController.updateDoc);
docRoutes.delete("/docs/:id", requireAuth, docController.deleteDoc);
docRoutes.post("/docs/:id/restore", requireAuth, docController.restoreDoc);
docRoutes.post("/docs/:id/duplicate", requireAuth, docController.duplicateDoc);
docRoutes.post("/docs/:id/favorite", requireAuth, docController.toggleFavorite);
docRoutes.get("/docs/:id/breadcrumbs", requireAuth, docController.getBreadcrumbs);
docRoutes.get("/docs/:id/activities", requireAuth, docController.getActivities);

// Document version history
docRoutes.get("/docs/:id/versions", requireAuth, docController.getVersions);
docRoutes.post("/docs/:id/versions/:versionId/restore", requireAuth, docController.restoreVersion);

// Document comments
docRoutes.get("/docs/:id/comments", requireAuth, docController.getComments);
docRoutes.post("/docs/:id/comments", requireAuth, docController.createComment);
docRoutes.patch("/comments/:commentId", requireAuth, docController.updateComment);
docRoutes.delete("/comments/:commentId", requireAuth, docController.deleteComment);
docRoutes.post("/comments/:commentId/reaction", requireAuth, docController.toggleReaction);

// Document sharing permissions
docRoutes.get("/docs/:id/permissions", requireAuth, docController.getPermissions);
docRoutes.post("/docs/:id/permissions", requireAuth, docController.updatePermission);
docRoutes.delete("/docs/:id/permissions/:targetUserId", requireAuth, docController.deletePermission);
