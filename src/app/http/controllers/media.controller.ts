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
};
