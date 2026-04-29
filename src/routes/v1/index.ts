import { Router } from "express";
import { authRoutes } from "@/routes/v1/auth.routes";

export const apiV1Routes = Router();

apiV1Routes.use("/auth", authRoutes);

