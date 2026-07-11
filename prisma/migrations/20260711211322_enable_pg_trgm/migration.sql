CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX workspace_name_trgm_idx ON "workspaces" USING GIN ("name" gin_trgm_ops);
CREATE INDEX project_title_trgm_idx ON "projects" USING GIN ("title" gin_trgm_ops);
CREATE INDEX project_key_trgm_idx ON "projects" USING GIN ("project_key" gin_trgm_ops);
CREATE INDEX task_title_trgm_idx ON "tasks" USING GIN ("title" gin_trgm_ops);
CREATE INDEX task_key_trgm_idx ON "tasks" USING GIN ("task_key" gin_trgm_ops);