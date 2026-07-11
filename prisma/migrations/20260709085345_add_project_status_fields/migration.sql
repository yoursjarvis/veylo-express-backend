-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "end_date" TIMESTAMPTZ(6),
ADD COLUMN     "owner_id" UUID,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "start_date" TIMESTAMPTZ(6),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'on_track';

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
