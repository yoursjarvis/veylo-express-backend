import { Router } from "express";
import { authRoutes } from "@/routes/v1/auth.routes";
import { mediaRoutes } from "@/routes/v1/media.routes";
import { orgRoutes } from "@/routes/v1/org.routes";
import { workspaceRoutes } from "@/routes/v1/workspace.routes";

export const apiV1Routes = Router();

apiV1Routes.use("/auth", authRoutes);
apiV1Routes.use("/media", mediaRoutes);
apiV1Routes.use("/org", orgRoutes);
apiV1Routes.use("/workspaces", workspaceRoutes);



