import { Router } from "express";
import { apiV1Routes } from "@/routes/v1";

export const routes = Router();

routes.use("/api/v1", apiV1Routes);

