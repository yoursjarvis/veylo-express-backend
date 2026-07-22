import { requirePermission } from "@/app/http/middlewares/rbac.middleware";
import { Router, Request } from "express";

import { auditLogController } from "@/app/http/controllers/audit-log.controller";
import { orgMembersController } from "@/app/http/controllers/org-members.controller";
import { orgController } from "@/app/http/controllers/org.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { upload } from "@/app/http/middlewares/upload.middleware";

export const orgRoutes = Router();

const extractContext = (req: Request) => ({
  workspaceId: req.params.workspaceId || req.params.id,
  projectId: req.params.projectId || (req.baseUrl.includes('projects') ? req.params.id : undefined),
  taskId: req.params.taskId || (req.baseUrl.includes('tasks') ? req.params.id : undefined),
  organizationId: req.params.organizationId
});


orgRoutes.post(
  "/setup",
  requireAuth,
  upload.single("logo"),
  orgController.setupOrganization,
);

orgRoutes.post("\/members\/:id\/ban", requireAuth, requirePermission("member:ban", extractContext), requirePermission("member:ban", extractContext), orgMembersController.banMember);

orgRoutes.post("\/members\/:id\/unban",
  requireAuth, requirePermission("member:unban", extractContext),
  orgMembersController.unbanMember,
);

orgRoutes.post("\/members\/:id\/revoke-sessions",
  requireAuth, requirePermission("member:update", extractContext),
  orgMembersController.revokeSessions,
);

orgRoutes.post("\/members\/:id\/impersonate",
  requireAuth, requirePermission("member:update", extractContext),
  orgMembersController.impersonateUser,
);

orgRoutes.get("\/members\/:id\/sessions",
  requireAuth, requirePermission("member:read", extractContext),
  orgMembersController.getSessions,
);

orgRoutes.delete("\/members\/:id\/sessions\/:sessionId",
  requireAuth, requirePermission("member:update", extractContext),
  orgMembersController.revokeSession,
);

orgRoutes.put("\/members\/:id\/password",
  requireAuth, requirePermission("member:change-password", extractContext),
  orgMembersController.setPassword,
);

orgRoutes.put("\/members\/:id\/photo",
  requireAuth, requirePermission("member:update", extractContext),
  upload.single("photo"),
  orgMembersController.updatePhoto,
);

orgRoutes.put("\/members\/:id", requireAuth, requirePermission("member:update", extractContext), requirePermission("member:update", extractContext), orgMembersController.updateProfile);

orgRoutes.post("\/members\/invite-bulk",
  requireAuth, requirePermission("member:invite", extractContext),
  upload.single("file"),
  orgMembersController.bulkInvite,
);

orgRoutes.post("\/members\/invite",
  requireAuth, requirePermission("member:invite", extractContext),
  orgMembersController.inviteMember,
);

orgRoutes.get("\/members", requireAuth, requirePermission("member:read", extractContext), requirePermission("member:read", extractContext), orgMembersController.getMembers);

orgRoutes.get("\/invitations",
  requireAuth, requirePermission("invitation:read", extractContext),
  orgMembersController.getPendingInvitations,
);

orgRoutes.post("\/invitations\/:id\/revoke",
  requireAuth, requirePermission("invitation:cancel", extractContext),
  orgMembersController.revokeInvitation,
);

orgRoutes.post("\/invitations\/:id\/resend",
  requireAuth, requirePermission("invitation:create", extractContext),
  orgMembersController.resendInvitation,
);

orgRoutes.get(
  "/invitations/:id/public",
  orgMembersController.getInvitationPublic,
);

orgRoutes.get("\/audit-logs",
  requireAuth, requirePermission("audit-log:read", extractContext),
  auditLogController.getOrgLogs,
);

orgRoutes.post("\/audit-logs\/export",
  requireAuth, requirePermission("audit-log:export", extractContext),
  auditLogController.exportOrgLogs,
);
