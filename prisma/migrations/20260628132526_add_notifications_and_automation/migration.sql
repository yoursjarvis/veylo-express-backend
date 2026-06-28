-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notification_preferences" TEXT DEFAULT '[]';

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "trigger_val" TEXT,
    "action" TEXT NOT NULL,
    "action_val" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
