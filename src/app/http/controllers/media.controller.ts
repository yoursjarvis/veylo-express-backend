import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { mediaService } from "@/app/services/media.service";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";

export const mediaController = {
  uploadAvatar: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new Error("No file uploaded");
    }

    const user = req.auth?.user;
    if (!user) {
      throw new Error("Unauthorized");
    }

    const result = await mediaService.uploadAvatar(user.id as string, req.file);

    return ok(res, "Avatar uploaded successfully", result);
  }),

  uploadOrgLogo: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new Error("No file uploaded");
    }

    const user = req.auth?.user;
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get active organization from session
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    const activeOrgId = session?.session?.activeOrganizationId;

    if (!activeOrgId) {
      return res.status(400).json({ message: "No active organization found" });
    }

    const result = await mediaService.uploadOrgLogo(user.id as string, activeOrgId, req.file);

    return ok(res, "Organization logo uploaded successfully", result);
  }),

  uploadWorkspaceIcon: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    if (!req.file) {
      throw new Error("No file uploaded");
    }

    const user = req.auth?.user;
    if (!user) {
      throw new Error("Unauthorized");
    }

    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });
    const activeOrgId = session?.session?.activeOrganizationId;

    if (!activeOrgId) {
      return res.status(400).json({ message: "No active organization found" });
    }

    const result = await mediaService.uploadWorkspaceIcon(
      workspaceId,
      user.id as string,
      activeOrgId,
      req.file
    );

    return ok(res, "Workspace icon uploaded successfully", result);
  }),

  uploadProjectIcon: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    if (!req.file) {
      throw new Error("No file uploaded");
    }

    const user = req.auth?.user;
    if (!user) {
      throw new Error("Unauthorized");
    }

    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });
    const activeOrgId = session?.session?.activeOrganizationId;

    if (!activeOrgId) {
      return res.status(400).json({ message: "No active organization found" });
    }

    const result = await mediaService.uploadProjectIcon(
      projectId,
      user.id as string,
      activeOrgId,
      req.file
    );

    return ok(res, "Project icon uploaded successfully", result);
  }),

  uploadFile: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new Error("No file uploaded");
    }

    const user = req.auth?.user;
    if (!user) {
      throw new Error("Unauthorized");
    }

    const result = await mediaService.uploadFile(user.id as string, req.file);

    return ok(res, "File uploaded successfully", result);
  }),

  uploadVersion: asyncHandler(async (req: Request, res: Response) => {
    const { parentMediaId } = req.params;
    if (!req.file) {
      throw new Error("No file uploaded");
    }

    const result = await mediaService.uploadVersion(parentMediaId, req.file);
    return ok(res, "New file version uploaded successfully", result);
  }),

  createAnnotation: asyncHandler(async (req: Request, res: Response) => {
    const { mediaId } = req.params;
    const { x, y, content } = req.body;
    const user = req.auth?.user;
    if (!user) {
      throw new Error("Unauthorized");
    }

    if (x === undefined || y === undefined || !content) {
      return res.status(400).json({ message: "Coordinates x, y, and content are required" });
    }

    const annotation = await mediaService.createAnnotation({
      mediaId,
      userId: user.id as string,
      x: parseFloat(x),
      y: parseFloat(y),
      content,
    });

    return ok(res, "Annotation added successfully", annotation);
  }),

  getAnnotations: asyncHandler(async (req: Request, res: Response) => {
    const { mediaId } = req.params;
    const annotations = await mediaService.getAnnotations(mediaId);
    return ok(res, "Annotations fetched successfully", annotations);
  }),

  deleteAnnotation: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.auth?.user;
    if (!user) {
      throw new Error("Unauthorized");
    }

    await mediaService.deleteAnnotation(id, user.id as string);
    return ok(res, "Annotation deleted successfully");
  }),
};
