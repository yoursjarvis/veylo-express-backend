-- CreateTable
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workspace_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_projects" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_portfolios_org_id" ON "portfolios"("organization_id");

-- CreateIndex
CREATE INDEX "idx_portfolios_workspace_id" ON "portfolios"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_projects_portfolio_id_project_id_key" ON "portfolio_projects"("portfolio_id", "project_id");

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
