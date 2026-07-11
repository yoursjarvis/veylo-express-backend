import type { Request, Response } from "express";

import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import { searchService } from "@/app/services/search.service";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { UnauthorizedException } from "@/utils/app-error";
import { ok } from "@/utils/http-response";

export const searchController = {
  globalSearch: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    const query = (req.query.q as string) || "";
    const activeOrgId = session.session.activeOrganizationId;

    if (!activeOrgId) {
      return ok(res, "No active organization", { tasks: [], projects: [], workspaces: [] });
    }

    const results = await searchService.globalSearch(activeOrgId, session.user.id, query);
    return ok(res, "Search results fetched", results);
  }),
};
