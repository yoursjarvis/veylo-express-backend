import { Router } from "express";
import { authRoutes } from "@/routes/v1/auth.routes";
import { mediaRoutes } from "@/routes/v1/media.routes";
import { orgRoutes } from "@/routes/v1/org.routes";

export const apiV1Routes = Router();

apiV1Routes.use("/auth", authRoutes);
apiV1Routes.use("/media", mediaRoutes);
apiV1Routes.use("/org", orgRoutes);



