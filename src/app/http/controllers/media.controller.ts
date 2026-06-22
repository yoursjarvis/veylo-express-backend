import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { mediaService } from "@/core/media";
import prisma from "@/lib/prisma";
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

    const media = await mediaService.addMedia(
      "User",
      user.id as string,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      "avatars",
      true // Replace existing avatars
    );


    const url = await mediaService.getUrl(media.id);

    // Update user image in database
    await prisma.user.update({
      where: { id: user.id as string },
      data: { image: url },
    });

    return ok(res, "Avatar uploaded successfully", {
      media_id: media.id,
      url,
    });
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

    // Check if user is owner or admin
    const member = await prisma.member.findFirst({
      where: {
        organizationId: activeOrgId,
        userId: user.id as string,
        role: { in: ["owner", "admin"] }
      }
    });

    if (!member) {
       return res.status(403).json({ message: "You do not have permission to upload logos for this organization" });
    }

    const media = await mediaService.addMedia(
      "Organization",
      activeOrgId,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      "logos",
      true // Replace existing logos
    );

    const url = await mediaService.getUrl(media.id);

    return ok(res, "Organization logo uploaded successfully", {
      media_id: media.id,
      url,
    });
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

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: user.id as string,
        role: "admin",
        workspace: { organizationId: activeOrgId },
      },
    });

    const orgAdmin = await prisma.member.findFirst({
      where: {
        organizationId: activeOrgId,
        userId: user.id as string,
        role: { in: ["owner", "admin"] }
      }
    });

    if (!workspaceMember && !orgAdmin) {
       return res.status(403).json({ message: "You do not have permission to upload icons for this workspace" });
    }

    const media = await mediaService.addMedia(
      "Workspace",
      workspaceId,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      "icons",
      true // Replace existing icon
    );

    const url = await mediaService.getUrl(media.id);

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { icon: url },
    });

    return ok(res, "Workspace icon uploaded successfully", {
      media_id: media.id,
      url,
    });
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

    const db = prisma as any;
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: project.workspaceId,
        userId: user.id as string,
        role: "admin",
        workspace: { organizationId: activeOrgId },
      },
    });

    const orgAdmin = await prisma.member.findFirst({
      where: {
        organizationId: activeOrgId,
        userId: user.id as string,
        role: { in: ["owner", "admin"] }
      }
    });

    if (!workspaceMember && !orgAdmin) {
      return res.status(403).json({ message: "You do not have permission to upload icons for this project" });
    }

    const media = await mediaService.addMedia(
      "Project",
      projectId,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      "icons",
      true // Replace existing icon
    );

    const url = await mediaService.getUrl(media.id);

    await db.project.update({
      where: { id: projectId },
      data: { icon: url },
    });

    return ok(res, "Project icon uploaded successfully", {
      media_id: media.id,
      url,
    });
  }),
};

