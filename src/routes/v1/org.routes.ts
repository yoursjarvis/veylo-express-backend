import { orgController } from "@/app/http/controllers/org.controller";
import { orgMembersController } from "@/app/http/controllers/org-members.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { upload } from "@/app/http/middlewares/upload.middleware";
import { Router } from "express";

export const orgRoutes = Router();

orgRoutes.post(
  "/setup",
  requireAuth,
  upload.single("logo"),
  orgController.setupOrganization
);

orgRoutes.post(
  "/members/:id/ban",
  requireAuth,
  orgMembersController.banMember
);

orgRoutes.post(
  "/members/:id/unban",
  requireAuth,
  orgMembersController.unbanMember
);

orgRoutes.post(
  "/members/:id/revoke-sessions",
  requireAuth,
  orgMembersController.revokeSessions
);

orgRoutes.post(
  "/members/:id/impersonate",
  requireAuth,
  orgMembersController.impersonateUser
);

orgRoutes.post(
  "/members/invite-bulk",
  requireAuth,
  upload.single("file"),
  orgMembersController.bulkInvite
);

orgRoutes.post(
  "/members/invite",
  requireAuth,
  orgMembersController.inviteMember
);

orgRoutes.get(
  "/members",
  requireAuth,
  orgMembersController.getMembers
);

orgRoutes.get(
  "/invitations/:id/public",
  orgMembersController.getInvitationPublic
);

