import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { setupOrgSchema } from "@/app/http/validators/org.validator";
import { orgService } from "@/app/services/org.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";

export const orgController = {
  setupOrganization: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validatedData = setupOrgSchema.parse(req.body);

    const result = await orgService.setupOrganization(
      session.user.id,
      session.session,
      validatedData,
      req.file,
    );

    return res.status(201).json({
      message: "Organization created successfully",
      data: result,
    });
  }),
};
