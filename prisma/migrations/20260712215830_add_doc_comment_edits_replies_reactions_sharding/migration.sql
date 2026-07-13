/*
  Warnings:

  - Added the required column `organization_id` to the `project_doc_activities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `project_doc_comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `project_doc_favorites` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `project_doc_permissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `project_doc_versions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `project_docs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "project_doc_activities" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "project_doc_comments" ADD COLUMN     "is_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organization_id" UUID NOT NULL,
ADD COLUMN     "parent_id" UUID;

-- AlterTable
ALTER TABLE "project_doc_favorites" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "project_doc_permissions" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "project_doc_versions" ADD COLUMN     "organization_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "project_docs" ADD COLUMN     "organization_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "project_doc_comment_reactions" (
    "id" UUID NOT NULL,
    "comment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "emoji" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_doc_comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_doc_comment_reactions_comment_id_user_id_emoji_key" ON "project_doc_comment_reactions"("comment_id", "user_id", "emoji");

-- AddForeignKey
ALTER TABLE "project_docs" ADD CONSTRAINT "project_docs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_permissions" ADD CONSTRAINT "project_doc_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_comments" ADD CONSTRAINT "project_doc_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_comments" ADD CONSTRAINT "project_doc_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "project_doc_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_versions" ADD CONSTRAINT "project_doc_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_activities" ADD CONSTRAINT "project_doc_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_favorites" ADD CONSTRAINT "project_doc_favorites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_comment_reactions" ADD CONSTRAINT "project_doc_comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "project_doc_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_comment_reactions" ADD CONSTRAINT "project_doc_comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_comment_reactions" ADD CONSTRAINT "project_doc_comment_reactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
