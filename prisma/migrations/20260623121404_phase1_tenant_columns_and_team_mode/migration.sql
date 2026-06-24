-- Phase 1: Add tenant organizationId to core tables + teamMode to projects
-- Uses a safe 3-step approach for tables with existing data:
--   1. Add column as nullable
--   2. Backfill from parent table join chain
--   3. Add NOT NULL constraint + FK + index

-- ============================================================
-- PROJECTS: add organization_id (backfill from workspace) + team_mode
-- ============================================================
ALTER TABLE "projects" ADD COLUMN "organization_id" UUID;
ALTER TABLE "projects" ADD COLUMN "team_mode" TEXT NOT NULL DEFAULT 'general';

UPDATE "projects" p
SET "organization_id" = w."organization_id"
FROM "workspaces" w
WHERE p."workspace_id" = w."id";

ALTER TABLE "projects" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_projects_org_id" ON "projects"("organization_id");
CREATE INDEX "idx_projects_workspace_id" ON "projects"("workspace_id");

-- ============================================================
-- TASK_STATUSES: add organization_id (backfill from project)
-- ============================================================
ALTER TABLE "task_statuses" ADD COLUMN "organization_id" UUID;

UPDATE "task_statuses" ts
SET "organization_id" = p."organization_id"
FROM "projects" p
WHERE ts."project_id" = p."id";

ALTER TABLE "task_statuses" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "task_statuses"
  ADD CONSTRAINT "task_statuses_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_task_statuses_org_id" ON "task_statuses"("organization_id");

-- ============================================================
-- TASKS: add organization_id (backfill from project)
-- ============================================================
ALTER TABLE "tasks" ADD COLUMN "organization_id" UUID;

UPDATE "tasks" t
SET "organization_id" = p."organization_id"
FROM "projects" p
WHERE t."project_id" = p."id";

ALTER TABLE "tasks" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_tasks_org_id" ON "tasks"("organization_id");

-- ============================================================
-- SPRINTS: add organization_id (backfill from project)
-- ============================================================
ALTER TABLE "sprints" ADD COLUMN "organization_id" UUID;

UPDATE "sprints" s
SET "organization_id" = p."organization_id"
FROM "projects" p
WHERE s."project_id" = p."id";

ALTER TABLE "sprints" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "sprints"
  ADD CONSTRAINT "sprints_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_sprints_org_id" ON "sprints"("organization_id");

-- ============================================================
-- SUBTASKS: add organization_id (backfill through task → project)
-- ============================================================
ALTER TABLE "subtasks" ADD COLUMN "organization_id" UUID;

UPDATE "subtasks" st
SET "organization_id" = t."organization_id"
FROM "tasks" t
WHERE st."task_id" = t."id";

ALTER TABLE "subtasks" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "subtasks"
  ADD CONSTRAINT "subtasks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_subtasks_org_id" ON "subtasks"("organization_id");

-- ============================================================
-- CUSTOM_FIELD_DEFINITIONS: add organization_id (backfill from project)
-- ============================================================
ALTER TABLE "custom_field_definitions" ADD COLUMN "organization_id" UUID;

UPDATE "custom_field_definitions" cf
SET "organization_id" = p."organization_id"
FROM "projects" p
WHERE cf."project_id" = p."id";

ALTER TABLE "custom_field_definitions" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "custom_field_definitions"
  ADD CONSTRAINT "custom_field_definitions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_custom_field_definitions_org_id" ON "custom_field_definitions"("organization_id");

-- ============================================================
-- COMMENTS: add organization_id (backfill through task → project)
-- ============================================================
ALTER TABLE "comments" ADD COLUMN "organization_id" UUID;

UPDATE "comments" c
SET "organization_id" = t."organization_id"
FROM "tasks" t
WHERE c."task_id" = t."id";

ALTER TABLE "comments" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_comments_org_id" ON "comments"("organization_id");

-- ============================================================
-- TASK_ACTIVITIES: add organization_id (backfill through task → project)
-- ============================================================
ALTER TABLE "task_activities" ADD COLUMN "organization_id" UUID;

UPDATE "task_activities" ta
SET "organization_id" = t."organization_id"
FROM "tasks" t
WHERE ta."task_id" = t."id";

ALTER TABLE "task_activities" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "task_activities"
  ADD CONSTRAINT "task_activities_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_task_activities_org_id" ON "task_activities"("organization_id");
CREATE INDEX "idx_task_activities_task_id" ON "task_activities"("task_id");

-- ============================================================
-- NOTIFICATIONS: add organization_id (backfill through task → project; NULL tasks get org from recipient membership)
-- ============================================================
ALTER TABLE "notifications" ADD COLUMN "organization_id" UUID;

-- Backfill from task if available
UPDATE "notifications" n
SET "organization_id" = t."organization_id"
FROM "tasks" t
WHERE n."task_id" = t."id"
  AND n."organization_id" IS NULL;

-- Backfill remaining (task-less notifications) from recipient's org membership
UPDATE "notifications" n
SET "organization_id" = m."organization_id"
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM "members"
  ORDER BY user_id, created_at ASC
) m
WHERE n."recipient_id" = m."user_id"
  AND n."organization_id" IS NULL;

ALTER TABLE "notifications" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_notifications_org_id" ON "notifications"("organization_id");
