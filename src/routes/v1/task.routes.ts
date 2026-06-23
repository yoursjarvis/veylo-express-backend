import { Router } from "express";
import { requireAuth } from "@/app/http/middlewares/require-auth.middleware";
import { taskController } from "@/app/http/controllers/task.controller";
import { sprintController } from "@/app/http/controllers/sprint.controller";
import { taskExtrasController } from "@/app/http/controllers/task-extras.controller";
import { notificationController } from "@/app/http/controllers/notification.controller";
import { slackWebhookController } from "@/app/http/controllers/slack-webhook.controller";
import { dependencyController } from "@/app/http/controllers/dependency.controller";

export const taskRoutes = Router();

// Apply auth middleware to all routes
taskRoutes.use(requireAuth);

// --- TASK CRUD ---
taskRoutes.post("/projects/:projectId/tasks", taskController.createTask);
taskRoutes.get("/projects/:projectId/tasks", taskController.getTasks);
taskRoutes.get("/tasks/:id", taskController.getTask);
taskRoutes.patch("/tasks/:id", taskController.updateTask);
taskRoutes.delete("/tasks/:id", taskController.deleteTask);

// --- SPRINT CRUD ---
taskRoutes.post("/projects/:projectId/sprints", sprintController.createSprint);
taskRoutes.get("/projects/:projectId/sprints", sprintController.getSprints);
taskRoutes.get("/sprints/:id", sprintController.getSprint);
taskRoutes.patch("/sprints/:id", sprintController.updateSprint);
taskRoutes.delete("/sprints/:id", sprintController.deleteSprint);

// --- TASK STATUS CRUD ---
taskRoutes.post("/projects/:projectId/statuses", taskExtrasController.createStatus);
taskRoutes.get("/projects/:projectId/statuses", taskExtrasController.getStatuses);
taskRoutes.patch("/statuses/:id", taskExtrasController.updateStatus);
taskRoutes.delete("/statuses/:id", taskExtrasController.deleteStatus);

// --- SUBTASK CHECKLIST CRUD ---
taskRoutes.post("/tasks/:taskId/subtasks", taskExtrasController.createSubtask);
taskRoutes.patch("/subtasks/:id", taskExtrasController.updateSubtask);
taskRoutes.delete("/subtasks/:id", taskExtrasController.deleteSubtask);

// --- COMMENTS CRUD ---
taskRoutes.post("/tasks/:taskId/comments", taskExtrasController.createComment);
taskRoutes.patch("/comments/:id", taskExtrasController.updateComment);
taskRoutes.delete("/comments/:id", taskExtrasController.deleteComment);
taskRoutes.get("/comments/:commentId/reactions/:emoji/users", taskExtrasController.getReactionUsers);
taskRoutes.post("/comments/:commentId/reactions", taskExtrasController.toggleCommentReaction);

// --- CUSTOM FIELDS CRUD ---
taskRoutes.post("/projects/:projectId/custom-fields", taskExtrasController.createCustomField);
taskRoutes.get("/projects/:projectId/custom-fields", taskExtrasController.getCustomFields);
taskRoutes.delete("/custom-fields/:id", taskExtrasController.deleteCustomField);

// --- IN-APP NOTIFICATIONS ---
taskRoutes.get("/notifications", notificationController.getNotifications);
taskRoutes.patch("/notifications/read-all", notificationController.markAllAsRead);
taskRoutes.patch("/notifications/:id/read", notificationController.markAsRead);

// --- SLACK INTEGRATIONS ---
taskRoutes.post("/projects/:projectId/slack-webhooks", slackWebhookController.createWebhook);
taskRoutes.get("/projects/:projectId/slack-webhooks", slackWebhookController.getWebhooks);
taskRoutes.delete("/slack-webhooks/:id", slackWebhookController.deleteWebhook);

// --- TASK DEPENDENCIES ---
taskRoutes.get("/tasks/:taskId/dependencies", dependencyController.getDependencies);
taskRoutes.post("/tasks/:taskId/dependencies", dependencyController.createDependency);
taskRoutes.delete("/dependencies/:id", dependencyController.deleteDependency);

