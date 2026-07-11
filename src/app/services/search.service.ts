import prisma from "@/lib/prisma";

export const searchService = {
  async globalSearch(organizationId: string, userId: string, query: string) {
    if (!query || query.trim() === "") {
      return { workspaces: [], projects: [], tasks: [] };
    }

    const searchTerm = query.trim();
    const limit = 5;

    // Workspaces
    const workspaces = await prisma.$queryRaw`
      SELECT w.id, w.name, w.slug, w.icon
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.organization_id = ${organizationId}::uuid
        AND w.deleted_at IS NULL
        AND wm.user_id = ${userId}::uuid
        AND similarity(w.name, ${searchTerm}) > 0.05
      ORDER BY similarity(w.name, ${searchTerm}) DESC
      LIMIT ${limit}
    `;

    // Projects
    const projects = await prisma.$queryRaw`
      SELECT p.id, p.title, p.project_key as "projectKey", p.icon,
             json_build_object('slug', w.slug) as workspace
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      JOIN workspaces w ON w.id = p.workspace_id
      WHERE p.organization_id = ${organizationId}::uuid
        AND p.deleted_at IS NULL
        AND pm.user_id = ${userId}::uuid
        AND (similarity(p.title, ${searchTerm}) > 0.05 OR similarity(p.project_key, ${searchTerm}) > 0.05)
      ORDER BY GREATEST(similarity(p.title, ${searchTerm}), similarity(p.project_key, ${searchTerm})) DESC
      LIMIT ${limit}
    `;

    // Tasks
    const tasks = await prisma.$queryRaw`
      SELECT t.id, t.title, t.task_key as "taskKey",
             json_build_object(
               'id', p.id,
               'workspace', json_build_object('slug', w.slug)
             ) as project
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN project_members pm ON pm.project_id = p.id
      JOIN workspaces w ON w.id = p.workspace_id
      WHERE t.organization_id = ${organizationId}::uuid
        AND t.deleted_at IS NULL
        AND pm.user_id = ${userId}::uuid
        AND (similarity(t.title, ${searchTerm}) > 0.05 OR similarity(t.task_key, ${searchTerm}) > 0.05)
      ORDER BY GREATEST(similarity(t.title, ${searchTerm}), similarity(t.task_key, ${searchTerm})) DESC
      LIMIT 10
    `;

    return {
      workspaces,
      projects,
      tasks,
    };
  },
};
