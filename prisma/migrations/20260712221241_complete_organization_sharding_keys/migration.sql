/*
  Warnings:

  - The primary key for the `task_labels` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[comment_id,user_id,emoji,organization_id]` on the table `comment_reactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[portfolio_id,project_id,organization_id]` on the table `portfolio_projects` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[project_id,user_id,organization_id]` on the table `project_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[blocking_task_id,blocked_task_id,dependencyType,organization_id]` on the table `task_dependencies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,role_id,scope_type,scope_id,organization_id]` on the table `user_role_assignments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[service_id,key,organization_id]` on the table `vault_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vault_id,name,organization_id]` on the table `vault_services` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspace_id,user_id,organization_id]` on the table `workspace_members` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organization_id` to the `automation_rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `comment_reactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `key_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `portfolio_projects` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `project_members` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `slack_webhooks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `task_dependencies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `task_labels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `user_role_assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `vault_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `vault_services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `vaults` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `work_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `workspace_members` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "uq_comment_reactions_user_emoji";

-- DropIndex
DROP INDEX "portfolio_projects_portfolio_id_project_id_key";

-- DropIndex
DROP INDEX "project_members_project_id_user_id_key";

-- DropIndex
DROP INDEX "task_dependencies_blocking_task_id_blocked_task_id_dependen_key";

-- DropIndex
DROP INDEX "user_role_assignments_user_id_role_id_scope_type_scope_id_key";

-- DropIndex
DROP INDEX "vault_items_service_id_key_key";

-- DropIndex
DROP INDEX "vault_services_vault_id_name_key";

-- DropIndex
DROP INDEX "workspace_members_workspace_id_user_id_key";

-- AlterTable
ALTER TABLE "automation_rules" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "comment_reactions" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "key_results" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "portfolio_projects" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "project_members" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "role_permissions" ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "slack_webhooks" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "task_dependencies" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "task_labels" DROP CONSTRAINT "task_labels_pkey",
ADD COLUMN     "organization_id" UUID NOT NULL,
ADD CONSTRAINT "task_labels_pkey" PRIMARY KEY ("task_id", "label_id", "organization_id");

-- AlterTable
ALTER TABLE "user_role_assignments" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "vault_items" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "vault_services" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "vaults" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "work_logs" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN     "organization_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "automation_rules_organization_id_idx" ON "automation_rules"("organization_id");

-- CreateIndex
CREATE INDEX "comment_reactions_organization_id_idx" ON "comment_reactions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comment_reactions_user_emoji" ON "comment_reactions"("comment_id", "user_id", "emoji", "organization_id");

-- CreateIndex
CREATE INDEX "key_results_organization_id_idx" ON "key_results"("organization_id");

-- CreateIndex
CREATE INDEX "portfolio_projects_organization_id_idx" ON "portfolio_projects"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_projects_portfolio_id_project_id_organization_id_key" ON "portfolio_projects"("portfolio_id", "project_id", "organization_id");

-- CreateIndex
CREATE INDEX "project_members_organization_id_idx" ON "project_members"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_organization_id_key" ON "project_members"("project_id", "user_id", "organization_id");

-- CreateIndex
CREATE INDEX "role_permissions_organization_id_idx" ON "role_permissions"("organization_id");

-- CreateIndex
CREATE INDEX "slack_webhooks_organization_id_idx" ON "slack_webhooks"("organization_id");

-- CreateIndex
CREATE INDEX "task_dependencies_organization_id_idx" ON "task_dependencies"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_blocking_task_id_blocked_task_id_dependen_key" ON "task_dependencies"("blocking_task_id", "blocked_task_id", "dependencyType", "organization_id");

-- CreateIndex
CREATE INDEX "task_labels_organization_id_idx" ON "task_labels"("organization_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_organization_id_idx" ON "user_role_assignments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_user_id_role_id_scope_type_scope_id_o_key" ON "user_role_assignments"("user_id", "role_id", "scope_type", "scope_id", "organization_id");

-- CreateIndex
CREATE INDEX "vault_items_organization_id_idx" ON "vault_items"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "vault_items_service_id_key_organization_id_key" ON "vault_items"("service_id", "key", "organization_id");

-- CreateIndex
CREATE INDEX "vault_services_organization_id_idx" ON "vault_services"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "vault_services_vault_id_name_organization_id_key" ON "vault_services"("vault_id", "name", "organization_id");

-- CreateIndex
CREATE INDEX "vaults_organization_id_idx" ON "vaults"("organization_id");

-- CreateIndex
CREATE INDEX "work_logs_organization_id_idx" ON "work_logs"("organization_id");

-- CreateIndex
CREATE INDEX "workspace_members_organization_id_idx" ON "workspace_members"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_organization_id_key" ON "workspace_members"("workspace_id", "user_id", "organization_id");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_services" ADD CONSTRAINT "vault_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_webhooks" ADD CONSTRAINT "slack_webhooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
