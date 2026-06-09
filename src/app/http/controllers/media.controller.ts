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
};

