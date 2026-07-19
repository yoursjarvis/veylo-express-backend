-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "awarded_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimated_points" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "kpi_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "kpi_ledger_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "workspace_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_ledger_entries_user_id_idx" ON "kpi_ledger_entries"("user_id");

-- CreateIndex
CREATE INDEX "kpi_ledger_entries_workspace_id_idx" ON "kpi_ledger_entries"("workspace_id");

-- CreateIndex
CREATE INDEX "kpi_ledger_entries_organization_id_idx" ON "kpi_ledger_entries"("organization_id");

-- AddForeignKey
ALTER TABLE "kpi_ledger_entries" ADD CONSTRAINT "kpi_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_ledger_entries" ADD CONSTRAINT "kpi_ledger_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_ledger_entries" ADD CONSTRAINT "kpi_ledger_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_ledger_entries" ADD CONSTRAINT "kpi_ledger_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
