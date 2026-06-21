import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { mediaService } from "@/core/media/media.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import type { Request, Response } from "express";
import { z } from "zod";

const setupOrgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters long"),
  slug: z.string().min(2, "Slug must be at least 2 characters long").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters long"),
});

export const orgController = {
  setupOrganization: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = session.user.id;

    // Check if the user and session exist in the primary database (prevents errors from stale cached Redis sessions)
    const [dbUser, dbSession] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.session.findUnique({ where: { id: session.session.id } }),
    ]);

    if (!dbUser || !dbSession) {
      return res.status(401).json({ 
        message: "Unauthorized: Session is stale or invalid in the database. Please log out and log in again." 
      });
    }

    const validatedData = setupOrgSchema.parse(req.body);

    // 1. Check if user already owns an organization
    const existingOrg = await prisma.member.findFirst({
      where: {
        userId,
        role: "owner",
      },
    });

    if (existingOrg) {
      return res.status(400).json({ message: "You have already created an organization." });
    }

    // 2. Check if slug is taken
    const existingSlug = await prisma.organization.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingSlug) {
      return res.status(400).json({ message: "This URL slug is already taken." });
    }

    // 3. Handle Logo Upload (if present in req.file)
    let logoUrl: string | null = null;
    let mediaId: string | undefined;

    try {
      // Use transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // A. Create Organization using Better Auth API to ensure hooks/cache fire correctly
        // However, Better Auth doesn't easily expose this in a transaction context natively for our complex flow.
        // We will create it manually via Prisma to ensure the workspace and logo tie in atomitcally.
        
        const org = await tx.organization.create({
          data: {
            name: validatedData.name,
            slug: validatedData.slug,
            logo: null, // We'll update this later if we have a file
          },
        });

        // B. Create Member (Owner)
        await tx.member.create({
          data: {
            organizationId: org.id,
            userId: userId,
            role: "owner",
          },
        });

        // C. Create Workspace
        const workspace = await tx.workspace.create({
          data: {
            name: validatedData.workspaceName,
            slug: validatedData.workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
            organizationId: org.id,
          },
        });

        // D. Update Active Organization for Session
        await tx.session.update({
          where: { id: session.session.id },
          data: { activeOrganizationId: org.id }
        });

        return { org, workspace };
      });

      // Handle Logo outside transaction because mediaService interacts with the file system/S3
      if (req.file) {
        try {
          const media = await mediaService.addMedia(
            "Organization",
            result.org.id,
            {
              buffer: req.file.buffer,
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size,
            },
            "logo"
          );
          
          const url = await mediaService.getUrl(media.id);
          if (url) {
             await prisma.organization.update({
               where: { id: result.org.id },
               data: { logo: url }
             });
             result.org.logo = url;
          }
        } catch (mediaError) {
           logger.error({ mediaError, orgId: result.org.id }, "Failed to process logo upload during org setup");
        }
      }

      // Invalidate Redis session cache to force reload from PostgreSQL on the next request
      try {
        const token = session.session.token;
        const userId = session.user.id;
        await Promise.all([
          redis.del(token),
          redis.del(`active-sessions-${userId}`),
        ]);
      } catch (redisError) {
        logger.error({ redisError }, "Failed to invalidate Redis session cache during org setup");
      }

      return res.status(201).json({
        message: "Organization created successfully",
        data: result,
      });
    } catch (error: any) {
      logger.error(error, "Failed to setup organization", { userId });
      return res.status(500).json({ 
        message: "Failed to create organization",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }),
};
