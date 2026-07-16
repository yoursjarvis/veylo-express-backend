-- DropIndex
DROP INDEX "project_key_trgm_idx";

-- DropIndex
DROP INDEX "project_title_trgm_idx";

-- DropIndex
DROP INDEX "task_key_trgm_idx";

-- DropIndex
DROP INDEX "task_title_trgm_idx";

-- DropIndex
DROP INDEX "workspace_name_trgm_idx";

-- CreateTable
CREATE TABLE "project_docs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "emoji" TEXT,
    "icon" TEXT,
    "cover_image" TEXT,
    "content" JSONB,
    "plain_text" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_doc_permissions" (
    "id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_doc_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_doc_comments" (
    "id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_doc_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_doc_versions" (
    "id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_doc_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_doc_activities" (
    "id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_doc_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_project_docs_project_id" ON "project_docs"("project_id");

-- CreateIndex
CREATE INDEX "idx_project_docs_parent_id" ON "project_docs"("parent_id");

-- CreateIndex
CREATE INDEX "idx_project_docs_created_by" ON "project_docs"("created_by");

-- CreateIndex
CREATE INDEX "idx_project_doc_perms_doc_id" ON "project_doc_permissions"("doc_id");

-- CreateIndex
CREATE INDEX "idx_project_doc_perms_user_id" ON "project_doc_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_doc_permissions_doc_id_user_id_key" ON "project_doc_permissions"("doc_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_project_doc_comments_doc_id" ON "project_doc_comments"("doc_id");

-- CreateIndex
CREATE INDEX "idx_project_doc_versions_doc_id" ON "project_doc_versions"("doc_id");

-- CreateIndex
CREATE INDEX "idx_project_doc_activities_doc_id" ON "project_doc_activities"("doc_id");

-- AddForeignKey
ALTER TABLE "project_docs" ADD CONSTRAINT "project_docs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_docs" ADD CONSTRAINT "project_docs_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "project_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_docs" ADD CONSTRAINT "project_docs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_docs" ADD CONSTRAINT "project_docs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_permissions" ADD CONSTRAINT "project_doc_permissions_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "project_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_permissions" ADD CONSTRAINT "project_doc_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_comments" ADD CONSTRAINT "project_doc_comments_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "project_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_comments" ADD CONSTRAINT "project_doc_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_versions" ADD CONSTRAINT "project_doc_versions_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "project_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_versions" ADD CONSTRAINT "project_doc_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_activities" ADD CONSTRAINT "project_doc_activities_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "project_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_activities" ADD CONSTRAINT "project_doc_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
