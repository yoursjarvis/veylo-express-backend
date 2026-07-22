import { requirePermission } from "@/app/http/middlewares/rbac.middleware";
import { Router, Request } from "express";

import { checklistTemplateController } from "@/app/http/controllers/checklist-template.controller";
import { dependencyController } from "@/app/http/controllers/dependency.controller";
import { epicController } from "@/app/http/controllers/epic.controller";
import { labelController } from "@/app/http/controllers/label.controller";
import { milestoneController } from "@/app/http/controllers/milestone.controller";
import { notificationController } from "@/app/http/controllers/notification.controller";
import { slackWebhookController } from "@/app/http/controllers/slack-webhook.controller";
import { sprintController } from "@/app/http/controllers/sprint.controller";
import { taskExtrasController } from "@/app/http/controllers/task-extras.controller";
import { taskController } from "@/app/http/controllers/task.controller";
import { workLogController } from "@/app/http/controllers/worklog.controller";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { upload } from "@/app/http/middlewares/upload.middleware";

export const taskRoutes = Router();

const extractContext = (req: Request) => ({
  workspaceId: req.params.workspaceId || req.params.id,
  projectId:
    req.params.projectId ||
    (req.baseUrl.includes("projects") ? req.params.id : undefined),
  taskId:
    req.params.taskId ||
    (req.baseUrl.includes("tasks") ? req.params.id : undefined),
  organizationId: req.params.organizationId,
});

// --- TASK CRUD ---
taskRoutes.post(
  "\/projects\/:projectId\/tasks",
  requireAuth,
  requirePermission("task:create", extractContext),
  taskController.createTask,
);
taskRoutes.get(
  "\/projects\/:projectId\/tasks",
  requireAuth,
  requirePermission("task:read", extractContext),
  taskController.getTasks,
);
taskRoutes.get(
  "\/tasks\/:id",
  requireAuth,
  requirePermission("task:read", extractContext),
  requirePermission("task:read", extractContext),
  taskController.getTask,
);
taskRoutes.patch(
  "\/tasks\/:id",
  requireAuth,
  requirePermission("task:update", extractContext),
  requirePermission("task:update", extractContext),
  taskController.updateTask,
);
taskRoutes.delete(
  "\/tasks\/:id",
  requireAuth,
  requirePermission("task:delete", extractContext),
  requirePermission("task:delete", extractContext),
  taskController.deleteTask,
);
taskRoutes.post(
  "\/tasks\/:id\/restore",
  requireAuth,
  requirePermission("task:restore", extractContext),
  requirePermission("task:restore", extractContext),
  taskController.restoreTask,
);
taskRoutes.delete(
  "\/tasks\/:id\/force",
  requireAuth,
  requirePermission("task:force-delete", extractContext),
  taskController.forceDeleteTask,
);
taskRoutes.post(
  "\/tasks\/:taskId\/attachments",
  requireAuth,
  requirePermission("task:update", extractContext),
  upload.single("file"),
  taskController.uploadAttachment,
);
taskRoutes.delete(
  "\/tasks\/:taskId\/attachments\/:attachmentId",
  requireAuth,
  requirePermission("task:update", extractContext),
  taskController.deleteAttachment,
);

// --- SPRINT CRUD ---
taskRoutes.post(
  "\/projects\/:projectId\/sprints",
  requireAuth,
  requirePermission("project:update", extractContext),
  sprintController.createSprint,
);
taskRoutes.get(
  "\/projects\/:projectId\/sprints",
  requireAuth,
  requirePermission("project:read", extractContext),
  sprintController.getSprints,
);
taskRoutes.get(
  "\/sprints\/:id",
  requireAuth,
  requirePermission("project:read", extractContext),
  requirePermission("project:read", extractContext),
  sprintController.getSprint,
);
taskRoutes.patch(
  "\/sprints\/:id",
  requireAuth,
  requirePermission("project:update", extractContext),
  requirePermission("project:update", extractContext),
  sprintController.updateSprint,
);
taskRoutes.delete(
  "\/sprints\/:id",
  requireAuth,
  requirePermission("project:update", extractContext),
  requirePermission("project:update", extractContext),
  sprintController.deleteSprint,
);
taskRoutes.post(
  "\/sprints\/:id\/restore",
  requireAuth,
  requirePermission("project:update", extractContext),
  sprintController.restoreSprint,
);
taskRoutes.delete(
  "\/sprints\/:id\/force",
  requireAuth,
  requirePermission("project:update", extractContext),
  sprintController.forceDeleteSprint,
);

// --- TASK STATUS CRUD ---
taskRoutes.post(
  "\/projects\/:projectId\/statuses",
  requireAuth,
  requirePermission("project-status:create", extractContext),
  taskExtrasController.createStatus,
);
taskRoutes.get(
  "\/projects\/:projectId\/statuses",
  requireAuth,
  requirePermission("project-status:read", extractContext),
  taskExtrasController.getStatuses,
);
taskRoutes.patch(
  "\/statuses\/:id",
  requireAuth,
  requirePermission("project-status:update", extractContext),
  taskExtrasController.updateStatus,
);
taskRoutes.delete(
  "\/statuses\/:id",
  requireAuth,
  requirePermission("project-status:delete", extractContext),
  taskExtrasController.deleteStatus,
);
taskRoutes.post(
  "\/statuses\/:id\/restore",
  requireAuth,
  requirePermission("project-status:restore", extractContext),
  taskExtrasController.restoreStatus,
);
taskRoutes.delete(
  "\/statuses\/:id\/force",
  requireAuth,
  requirePermission("project-status:force-delete", extractContext),
  taskExtrasController.forceDeleteStatus,
);

// --- SUBTASK CHECKLIST CRUD ---
taskRoutes.post(
  "\/tasks\/:taskId\/subtasks",
  requireAuth,
  requirePermission("task:update", extractContext),
  taskExtrasController.createSubtask,
);
taskRoutes.patch(
  "\/subtasks\/:id",
  requireAuth,
  requirePermission("task:update", extractContext),
  taskExtrasController.updateSubtask,
);
taskRoutes.delete(
  "\/subtasks\/:id",
  requireAuth,
  requirePermission("task:update", extractContext),
  taskExtrasController.deleteSubtask,
);

// --- COMMENTS CRUD ---
taskRoutes.post(
  "\/tasks\/:taskId\/comments",
  requireAuth,
  requirePermission("task:comment", extractContext),
  taskExtrasController.createComment,
);
taskRoutes.patch(
  "\/comments\/:id",
  requireAuth,
  requirePermission("task:comment", extractContext),
  taskExtrasController.updateComment,
);
taskRoutes.delete(
  "\/comments\/:id",
  requireAuth,
  requirePermission("task:delete-own-comment", extractContext),
  taskExtrasController.deleteComment,
);
taskRoutes.post(
  "\/comments\/:id\/restore",
  requireAuth,
  requirePermission("task:comment", extractContext),
  taskExtrasController.restoreComment,
);
taskRoutes.delete(
  "\/comments\/:id\/force",
  requireAuth,
  requirePermission("task:delete-any-comment", extractContext),
  taskExtrasController.forceDeleteComment,
);
taskRoutes.get(
  "/comments/:commentId/reactions/:emoji/users",
  requireAuth,
  taskExtrasController.getReactionUsers,
);
taskRoutes.post(
  "\/comments\/:commentId\/reactions",
  requireAuth,
  requirePermission("task:read", extractContext),
  taskExtrasController.toggleCommentReaction,
);

// --- CUSTOM FIELDS CRUD ---
taskRoutes.post(
  "\/projects\/:projectId\/custom-fields",
  requireAuth,
  requirePermission("project-custom-field:create", extractContext),
  taskExtrasController.createCustomField,
);
taskRoutes.get(
  "\/projects\/:projectId\/custom-fields",
  requireAuth,
  requirePermission("project-custom-field:read", extractContext),
  taskExtrasController.getCustomFields,
);
taskRoutes.delete(
  "\/custom-fields\/:id",
  requireAuth,
  requirePermission("project-custom-field:delete", extractContext),
  taskExtrasController.deleteCustomField,
);
taskRoutes.post(
  "\/custom-fields\/:id\/restore",
  requireAuth,
  requirePermission("project-custom-field:restore", extractContext),
  taskExtrasController.restoreCustomField,
);
taskRoutes.delete(
  "\/custom-fields\/:id\/force",
  requireAuth,
  requirePermission("project-custom-field:force-delete", extractContext),
  taskExtrasController.forceDeleteCustomField,
);

// --- IN-APP NOTIFICATIONS ---
taskRoutes.get(
  "\/notifications",
  requireAuth,
  requirePermission("task:read", extractContext),
  notificationController.getNotifications,
);
taskRoutes.patch(
  "/notifications/read-all",
  requireAuth,
  notificationController.markAllAsRead,
);
taskRoutes.patch(
  "/notifications/:id/read",
  requireAuth,
  notificationController.markAsRead,
);

// --- SLACK INTEGRATIONS ---
taskRoutes.post(
  "\/projects\/:projectId\/slack-webhooks",
  requireAuth,
  requirePermission("project-webhook:create", extractContext),
  slackWebhookController.createWebhook,
);
taskRoutes.get(
  "\/projects\/:projectId\/slack-webhooks",
  requireAuth,
  requirePermission("project-webhook:read", extractContext),
  slackWebhookController.getWebhooks,
);
taskRoutes.delete(
  "\/slack-webhooks\/:id",
  requireAuth,
  requirePermission("project-webhook:delete", extractContext),
  slackWebhookController.deleteWebhook,
);

// --- TASK DEPENDENCIES ---
taskRoutes.get(
  "\/tasks\/:taskId\/dependencies",
  requireAuth,
  requirePermission("task:read", extractContext),
  dependencyController.getDependencies,
);
taskRoutes.post(
  "\/tasks\/:taskId\/dependencies",
  requireAuth,
  requirePermission("task:update", extractContext),
  dependencyController.createDependency,
);
taskRoutes.delete(
  "\/dependencies\/:id",
  requireAuth,
  requirePermission("task:update", extractContext),
  dependencyController.deleteDependency,
);

// --- EPIC CRUD ---
taskRoutes.post(
  "\/projects\/:projectId\/epics",
  requireAuth,
  requirePermission("project-epic:create", extractContext),
  epicController.createEpic,
);
taskRoutes.get(
  "\/projects\/:projectId\/epics",
  requireAuth,
  requirePermission("project-epic:read", extractContext),
  epicController.getEpics,
);
taskRoutes.get(
  "\/epics\/:id",
  requireAuth,
  requirePermission("project-epic:read", extractContext),
  requirePermission("project-epic:read", extractContext),
  epicController.getEpic,
);
taskRoutes.patch(
  "\/epics\/:id",
  requireAuth,
  requirePermission("project-epic:update", extractContext),
  requirePermission("project-epic:update", extractContext),
  epicController.updateEpic,
);
taskRoutes.delete(
  "\/epics\/:id",
  requireAuth,
  requirePermission("project-epic:delete", extractContext),
  requirePermission("project-epic:delete", extractContext),
  epicController.deleteEpic,
);
taskRoutes.post(
  "\/epics\/:id\/restore",
  requireAuth,
  requirePermission("project-epic:restore", extractContext),
  requirePermission("project-epic:restore", extractContext),
  epicController.restoreEpic,
);
taskRoutes.delete(
  "\/epics\/:id\/force",
  requireAuth,
  requirePermission("project-epic:force-delete", extractContext),
  epicController.forceDeleteEpic,
);

// --- LABEL CRUD ---
taskRoutes.post(
  "\/projects\/:projectId\/labels",
  requireAuth,
  requirePermission("project-label:create", extractContext),
  labelController.createLabel,
);
taskRoutes.get(
  "\/projects\/:projectId\/labels",
  requireAuth,
  requirePermission("project-label:read", extractContext),
  labelController.getLabels,
);
taskRoutes.patch(
  "\/labels\/:id",
  requireAuth,
  requirePermission("project-label:update", extractContext),
  requirePermission("project-label:update", extractContext),
  labelController.updateLabel,
);
taskRoutes.delete(
  "\/labels\/:id",
  requireAuth,
  requirePermission("project-label:delete", extractContext),
  requirePermission("project-label:delete", extractContext),
  labelController.deleteLabel,
);
taskRoutes.post(
  "\/labels\/:id\/restore",
  requireAuth,
  requirePermission("project-label:restore", extractContext),
  labelController.restoreLabel,
);
taskRoutes.delete(
  "\/labels\/:id\/force",
  requireAuth,
  requirePermission("project-label:force-delete", extractContext),
  labelController.forceDeleteLabel,
);

// --- MILESTONE CRUD ---
taskRoutes.post(
  "\/projects\/:projectId\/milestones",
  requireAuth,
  requirePermission("project-milestone:create", extractContext),
  milestoneController.createMilestone,
);
taskRoutes.get(
  "\/projects\/:projectId\/milestones",
  requireAuth,
  requirePermission("project-milestone:read", extractContext),
  milestoneController.getMilestones,
);
taskRoutes.patch(
  "\/milestones\/:id",
  requireAuth,
  requirePermission("project-milestone:update", extractContext),
  milestoneController.updateMilestone,
);
taskRoutes.delete(
  "\/milestones\/:id",
  requireAuth,
  requirePermission("project-milestone:delete", extractContext),
  milestoneController.deleteMilestone,
);
taskRoutes.post(
  "\/milestones\/:id\/restore",
  requireAuth,
  requirePermission("project-milestone:restore", extractContext),
  milestoneController.restoreMilestone,
);
taskRoutes.delete(
  "\/milestones\/:id\/force",
  requireAuth,
  requirePermission("project-milestone:force-delete", extractContext),
  milestoneController.forceDeleteMilestone,
);

// --- WORK LOGS CRUD ---
taskRoutes.post(
  "\/tasks\/:taskId\/work-logs",
  requireAuth,
  requirePermission("task:update", extractContext),
  workLogController.createWorkLog,
);
taskRoutes.get(
  "\/tasks\/:taskId\/work-logs",
  requireAuth,
  requirePermission("task:read", extractContext),
  workLogController.getTaskWorkLogs,
);
taskRoutes.get(
  "\/projects\/:projectId\/work-logs",
  requireAuth,
  requirePermission("project:read", extractContext),
  workLogController.getProjectWorkLogs,
);
taskRoutes.patch(
  "\/work-logs\/:id",
  requireAuth,
  requirePermission("task:update", extractContext),
  workLogController.updateWorkLog,
);
taskRoutes.delete(
  "\/work-logs\/:id",
  requireAuth,
  requirePermission("task:update", extractContext),
  workLogController.deleteWorkLog,
);

// --- CHECKLIST TEMPLATE CRUD ---
taskRoutes.get(
  "\/checklist-templates",
  requireAuth,
  requirePermission("checklist-template:read", extractContext),
  checklistTemplateController.getTemplates,
);
taskRoutes.post(
  "\/checklist-templates",
  requireAuth,
  requirePermission("checklist-template:create", extractContext),
  checklistTemplateController.createTemplate,
);
taskRoutes.patch(
  "\/checklist-templates\/:id",
  requireAuth,
  requirePermission("checklist-template:update", extractContext),
  checklistTemplateController.updateTemplate,
);
taskRoutes.delete(
  "\/checklist-templates\/:id",
  requireAuth,
  requirePermission("checklist-template:delete", extractContext),
  checklistTemplateController.deleteTemplate,
);
taskRoutes.post(
  "\/tasks\/:taskId\/apply-checklist",
  requireAuth,
  requirePermission("task:update", extractContext),
  checklistTemplateController.applyTemplate,
);
