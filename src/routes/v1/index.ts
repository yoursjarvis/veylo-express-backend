import { Router } from "express";

import { authRoutes } from "@/routes/v1/auth.routes";
import { mediaRoutes } from "@/routes/v1/media.routes";
import { orgRoutes } from "@/routes/v1/org.routes";
import { projectRoutes } from "@/routes/v1/project.routes";
import { rbacRoutes } from "@/routes/v1/rbac.routes";
import { taskRoutes } from "@/routes/v1/task.routes";
import { workspaceRoutes } from "@/routes/v1/workspace.routes";

export const apiV1Routes = Router();

apiV1Routes.use("/auth", authRoutes);
apiV1Routes.use("/media", mediaRoutes);
apiV1Routes.use("/org", orgRoutes);
apiV1Routes.use("/workspaces", workspaceRoutes);
apiV1Routes.use("/", projectRoutes);
apiV1Routes.use("/", taskRoutes);
apiV1Routes.use("/rbac", rbacRoutes);
