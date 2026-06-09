import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { mediaService } from "@/core/media";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";

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
      "avatars"
    );


    const url = await mediaService.getUrl(media.id);

    return ok(res, "Avatar uploaded successfully", {
      media_id: media.id,
      url,
    });
  }),
};
