import { orgRepository } from "@/app/repositories/org.repository";
import { mediaService } from "@/core/media/media.service";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { BadRequestException, UnauthorizedException } from "@/utils/app-error";

export const orgService = {
  async setupOrganization(
    userId: string,
    session: { id: string; token: string },
    data: { name: string; slug: string; workspaceName: string },
    file?: Express.Multer.File
  ) {
    // Check if the user and session exist in the primary database (prevents errors from stale cached Redis sessions)
    const [dbUser, dbSession] = await Promise.all([
      orgRepository.findUserById(userId),
      orgRepository.findSessionById(session.id),
    ]);

    if (!dbUser || !dbSession) {
      throw new UnauthorizedException(
        "Unauthorized: Session is stale or invalid in the database. Please log out and log in again."
      );
    }

    // 1. Check if user already owns an organization
    const existingOrg = await orgRepository.findOwnerMember(userId);
    if (existingOrg) {
      throw new BadRequestException("You have already created an organization.");
    }

    // 2. Check if slug is taken
    const existingSlug = await orgRepository.findOrgBySlug(data.slug);
    if (existingSlug) {
      throw new BadRequestException("This URL slug is already taken.");
    }

    // 3. Create Org, Member (Owner), Workspace and Update Session inside a single Transaction
    const result = await orgRepository.createOrganizationWithOwnerAndWorkspace({
      name: data.name,
      slug: data.slug,
      workspaceName: data.workspaceName,
      userId,
      sessionId: session.id,
    });

    // 4. Handle Logo Upload (if file is present)
    if (file) {
      try {
        const media = await mediaService.addMedia(
          "Organization",
          result.org.id,
          {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
          "logo"
        );

        const url = mediaService.generateUrl(media);
        if (url) {
          await orgRepository.updateOrgLogo(result.org.id, url);
          result.org.logo = url;
        }
      } catch (mediaError) {
        logger.error(
          { mediaError, orgId: result.org.id },
          "Failed to process logo upload during org setup"
        );
      }
    }

    // 5. Invalidate Redis session cache to force reload from PostgreSQL on the next request
    try {
      await Promise.all([
        redis.del(session.token),
        redis.del(`active-sessions-${userId}`),
      ]);
    } catch (redisError) {
      logger.error(
        { redisError },
        "Failed to invalidate Redis session cache during org setup"
      );
    }

    return result;
  },
};
