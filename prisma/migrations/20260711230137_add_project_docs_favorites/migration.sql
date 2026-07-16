-- CreateTable
CREATE TABLE "project_doc_favorites" (
    "id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_doc_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_doc_favorites_doc_id_user_id_key" ON "project_doc_favorites"("doc_id", "user_id");

-- AddForeignKey
ALTER TABLE "project_doc_favorites" ADD CONSTRAINT "project_doc_favorites_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "project_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_doc_favorites" ADD CONSTRAINT "project_doc_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
