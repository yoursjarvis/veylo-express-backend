import { Router } from "express";

import { searchController } from "@/app/http/controllers/search.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";

export const searchRoutes = Router();

searchRoutes.get("/", requireAuth, searchController.globalSearch);
