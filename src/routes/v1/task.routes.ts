import { Router } from "express";

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

// --- TASK CRUD ---
taskRoutes.post(
  "/projects/:projectId/tasks",
  requireAuth,
  taskController.createTask,
);
taskRoutes.get(
  "/projects/:projectId/tasks",
  requireAuth,
  taskController.getTasks,
);
taskRoutes.get("/tasks/:id", requireAuth, taskController.getTask);
taskRoutes.patch("/tasks/:id", requireAuth, taskController.updateTask);
taskRoutes.delete("/tasks/:id", requireAuth, taskController.deleteTask);
taskRoutes.post("/tasks/:id/restore", requireAuth, taskController.restoreTask);
taskRoutes.delete(
  "/tasks/:id/force",
  requireAuth,
  taskController.forceDeleteTask,
);
taskRoutes.post(
  "/tasks/:taskId/attachments",
  requireAuth,
  upload.single("file"),
  taskController.uploadAttachment,
);
taskRoutes.delete(
  "/tasks/:taskId/attachments/:attachmentId",
  requireAuth,
  taskController.deleteAttachment,
);

// --- SPRINT CRUD ---
taskRoutes.post(
  "/projects/:projectId/sprints",
  requireAuth,
  sprintController.createSprint,
);
taskRoutes.get(
  "/projects/:projectId/sprints",
  requireAuth,
  sprintController.getSprints,
);
taskRoutes.get("/sprints/:id", requireAuth, sprintController.getSprint);
taskRoutes.patch("/sprints/:id", requireAuth, sprintController.updateSprint);
taskRoutes.delete("/sprints/:id", requireAuth, sprintController.deleteSprint);
taskRoutes.post(
  "/sprints/:id/restore",
  requireAuth,
  sprintController.restoreSprint,
);
taskRoutes.delete(
  "/sprints/:id/force",
  requireAuth,
  sprintController.forceDeleteSprint,
);

// --- TASK STATUS CRUD ---
taskRoutes.post(
  "/projects/:projectId/statuses",
  requireAuth,
  taskExtrasController.createStatus,
);
taskRoutes.get(
  "/projects/:projectId/statuses",
  requireAuth,
  taskExtrasController.getStatuses,
);
taskRoutes.patch(
  "/statuses/:id",
  requireAuth,
  taskExtrasController.updateStatus,
);
taskRoutes.delete(
  "/statuses/:id",
  requireAuth,
  taskExtrasController.deleteStatus,
);
taskRoutes.post(
  "/statuses/:id/restore",
  requireAuth,
  taskExtrasController.restoreStatus,
);
taskRoutes.delete(
  "/statuses/:id/force",
  requireAuth,
  taskExtrasController.forceDeleteStatus,
);

// --- SUBTASK CHECKLIST CRUD ---
taskRoutes.post(
  "/tasks/:taskId/subtasks",
  requireAuth,
  taskExtrasController.createSubtask,
);
taskRoutes.patch(
  "/subtasks/:id",
  requireAuth,
  taskExtrasController.updateSubtask,
);
taskRoutes.delete(
  "/subtasks/:id",
  requireAuth,
  taskExtrasController.deleteSubtask,
);

// --- COMMENTS CRUD ---
taskRoutes.post(
  "/tasks/:taskId/comments",
  requireAuth,
  taskExtrasController.createComment,
);
taskRoutes.patch(
  "/comments/:id",
  requireAuth,
  taskExtrasController.updateComment,
);
taskRoutes.delete(
  "/comments/:id",
  requireAuth,
  taskExtrasController.deleteComment,
);
taskRoutes.post(
  "/comments/:id/restore",
  requireAuth,
  taskExtrasController.restoreComment,
);
taskRoutes.delete(
  "/comments/:id/force",
  requireAuth,
  taskExtrasController.forceDeleteComment,
);
taskRoutes.get(
  "/comments/:commentId/reactions/:emoji/users",
  requireAuth,
  taskExtrasController.getReactionUsers,
);
taskRoutes.post(
  "/comments/:commentId/reactions",
  requireAuth,
  taskExtrasController.toggleCommentReaction,
);

// --- CUSTOM FIELDS CRUD ---
taskRoutes.post(
  "/projects/:projectId/custom-fields",
  requireAuth,
  taskExtrasController.createCustomField,
);
taskRoutes.get(
  "/projects/:projectId/custom-fields",
  requireAuth,
  taskExtrasController.getCustomFields,
);
taskRoutes.delete(
  "/custom-fields/:id",
  requireAuth,
  taskExtrasController.deleteCustomField,
);
taskRoutes.post(
  "/custom-fields/:id/restore",
  requireAuth,
  taskExtrasController.restoreCustomField,
);
taskRoutes.delete(
  "/custom-fields/:id/force",
  requireAuth,
  taskExtrasController.forceDeleteCustomField,
);

// --- IN-APP NOTIFICATIONS ---
taskRoutes.get(
  "/notifications",
  requireAuth,
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
  "/projects/:projectId/slack-webhooks",
  requireAuth,
  slackWebhookController.createWebhook,
);
taskRoutes.get(
  "/projects/:projectId/slack-webhooks",
  requireAuth,
  slackWebhookController.getWebhooks,
);
taskRoutes.delete(
  "/slack-webhooks/:id",
  requireAuth,
  slackWebhookController.deleteWebhook,
);

// --- TASK DEPENDENCIES ---
taskRoutes.get(
  "/tasks/:taskId/dependencies",
  requireAuth,
  dependencyController.getDependencies,
);
taskRoutes.post(
  "/tasks/:taskId/dependencies",
  requireAuth,
  dependencyController.createDependency,
);
taskRoutes.delete(
  "/dependencies/:id",
  requireAuth,
  dependencyController.deleteDependency,
);

// --- EPIC CRUD ---
taskRoutes.post(
  "/projects/:projectId/epics",
  requireAuth,
  epicController.createEpic,
);
taskRoutes.get(
  "/projects/:projectId/epics",
  requireAuth,
  epicController.getEpics,
);
taskRoutes.get("/epics/:id", requireAuth, epicController.getEpic);
taskRoutes.patch("/epics/:id", requireAuth, epicController.updateEpic);
taskRoutes.delete("/epics/:id", requireAuth, epicController.deleteEpic);
taskRoutes.post("/epics/:id/restore", requireAuth, epicController.restoreEpic);
taskRoutes.delete(
  "/epics/:id/force",
  requireAuth,
  epicController.forceDeleteEpic,
);

// --- LABEL CRUD ---
taskRoutes.post(
  "/projects/:projectId/labels",
  requireAuth,
  labelController.createLabel,
);
taskRoutes.get(
  "/projects/:projectId/labels",
  requireAuth,
  labelController.getLabels,
);
taskRoutes.patch("/labels/:id", requireAuth, labelController.updateLabel);
taskRoutes.delete("/labels/:id", requireAuth, labelController.deleteLabel);
taskRoutes.post(
  "/labels/:id/restore",
  requireAuth,
  labelController.restoreLabel,
);
taskRoutes.delete(
  "/labels/:id/force",
  requireAuth,
  labelController.forceDeleteLabel,
);

// --- MILESTONE CRUD ---
taskRoutes.post(
  "/projects/:projectId/milestones",
  requireAuth,
  milestoneController.createMilestone,
);
taskRoutes.get(
  "/projects/:projectId/milestones",
  requireAuth,
  milestoneController.getMilestones,
);
taskRoutes.patch(
  "/milestones/:id",
  requireAuth,
  milestoneController.updateMilestone,
);
taskRoutes.delete(
  "/milestones/:id",
  requireAuth,
  milestoneController.deleteMilestone,
);
taskRoutes.post(
  "/milestones/:id/restore",
  requireAuth,
  milestoneController.restoreMilestone,
);
taskRoutes.delete(
  "/milestones/:id/force",
  requireAuth,
  milestoneController.forceDeleteMilestone,
);

// --- WORK LOGS CRUD ---
taskRoutes.post(
  "/tasks/:taskId/work-logs",
  requireAuth,
  workLogController.createWorkLog,
);
taskRoutes.get(
  "/tasks/:taskId/work-logs",
  requireAuth,
  workLogController.getTaskWorkLogs,
);
taskRoutes.get(
  "/projects/:projectId/work-logs",
  requireAuth,
  workLogController.getProjectWorkLogs,
);
taskRoutes.patch(
  "/work-logs/:id",
  requireAuth,
  workLogController.updateWorkLog,
);
taskRoutes.delete(
  "/work-logs/:id",
  requireAuth,
  workLogController.deleteWorkLog,
);

// --- CHECKLIST TEMPLATE CRUD ---
taskRoutes.get(
  "/checklist-templates",
  requireAuth,
  checklistTemplateController.getTemplates,
);
taskRoutes.post(
  "/checklist-templates",
  requireAuth,
  checklistTemplateController.createTemplate,
);
taskRoutes.patch(
  "/checklist-templates/:id",
  requireAuth,
  checklistTemplateController.updateTemplate,
);
taskRoutes.delete(
  "/checklist-templates/:id",
  requireAuth,
  checklistTemplateController.deleteTemplate,
);
taskRoutes.post(
  "/tasks/:taskId/apply-checklist",
  requireAuth,
  checklistTemplateController.applyTemplate,
);
