import prisma from "@/lib/prisma";

export const taskExtrasRepository = {
  async findTaskById(id: string) {
    return prisma.task.findUnique({
      where: { id },
    });
  },

  // --- TASK STATUS ---
  async findStatusByNameAndProjectId(name: string, projectId: string) {
    return prisma.taskStatus.findFirst({
      where: { projectId, name },
    });
  },

  async createStatus(data: {
    name: string;
    category: "backlog" | "todo" | "in_progress" | "done";
    order: number;
    projectId: string;
    organizationId: string;
  }) {
    return prisma.taskStatus.create({
      data,
    });
  },

  async findStatusesByProjectId(projectId: string) {
    return prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });
  },

  async findStatusById(id: string) {
    return prisma.taskStatus.findUnique({
      where: { id },
    });
  },

  async updateStatus(id: string, data: Record<string, unknown>) {
    return prisma.taskStatus.update({
      where: { id },
      data,
    });
  },

  async countTasksWithStatus(statusId: string) {
    return prisma.task.count({
      where: { statusId, deletedAt: null },
    });
  },

  async deleteStatus(id: string) {
    return prisma.taskStatus.delete({
      where: { id },
    });
  },

  // --- SUBTASKS ---
  async createSubtask(data: {
    title: string;
    taskKey: string;
    parentTaskId: string;
    organizationId: string;
    projectId: string;
    statusId: string;
    creatorId: string;
    assigneeId?: string | null;
  }) {
    return prisma.task.create({
      data: {
        taskKey: data.taskKey,
        title: data.title,
        parentTaskId: data.parentTaskId,
        organizationId: data.organizationId,
        projectId: data.projectId,
        statusId: data.statusId,
        creatorId: data.creatorId,
        assigneeId: data.assigneeId,
        type: "subtask",
      },
    });
  },

  async findSubtaskById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: { parentTask: true, status: true },
    });
  },

  async updateSubtask(id: string, data: Record<string, unknown>) {
    return prisma.task.update({
      where: { id },
      data,
    });
  },

  async deleteSubtask(id: string) {
    return prisma.task.delete({
      where: { id },
    });
  },

  // --- TASK ACTIVITY ---
  async createTaskActivity(data: {
    taskId: string;
    userId: string;
    organizationId: string;
    action: string;
    newValue?: string;
    oldValue?: string;
  }) {
    return prisma.taskActivity.create({
      data,
    });
  },

  // --- COMMENTS ---
  async createComment(data: {
    content: string;
    taskId: string;
    userId: string;
    organizationId: string;
    parentId?: string | null;
  }) {
    return prisma.comment.create({
      data,
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });
  },

  async findCommentById(id: string) {
    return prisma.comment.findUnique({
      where: { id },
      include: { task: true },
    });
  },

  async deleteComment(id: string) {
    return prisma.comment.delete({
      where: { id },
    });
  },

  async updateComment(id: string, content: string) {
    return prisma.comment.update({
      where: { id },
      data: { content, isEdited: true },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
      },
    });
  },

  // --- ORG / WORKSPACE MEMBERSHIP FOR COMMENT DELETE AUTH ---
  async findOrgMember(organizationId: string, userId: string, roles: string[]) {
    return prisma.member.findFirst({
      where: { organizationId, userId, role: { in: roles } },
    });
  },

  async findWorkspaceMember(workspaceId: string, userId: string, role: string) {
    return prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, role },
    });
  },

  // --- CUSTOM FIELDS ---
  async findCustomFieldByName(name: string, projectId: string) {
    return prisma.customFieldDefinition.findFirst({
      where: { projectId, name },
    });
  },

  async createCustomField(data: {
    name: string;
    type: "text" | "number" | "date" | "select" | "checkbox";
    options?: string[] | null;
    projectId: string;
    organizationId: string;
  }) {
    return prisma.customFieldDefinition.create({
      data: {
        name: data.name,
        type: data.type,
        options: data.options ?? undefined,
        projectId: data.projectId,
        organizationId: data.organizationId,
      },
    });
  },

  async findCustomFieldsByProjectId(projectId: string) {
    return prisma.customFieldDefinition.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  },

  async findCustomFieldById(id: string) {
    return prisma.customFieldDefinition.findUnique({
      where: { id },
    });
  },

  async deleteCustomField(id: string) {
    return prisma.customFieldDefinition.delete({
      where: { id },
    });
  },

  // --- REACTIONS ---
  async findCommentReactions(commentId: string, emoji: string) {
    return prisma.commentReaction.findMany({
      where: { commentId, emoji },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async findCommentReaction(commentId: string, userId: string, emoji: string) {
    return prisma.commentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId, emoji } },
    });
  },

  async deleteCommentReaction(id: string) {
    return prisma.commentReaction.delete({
      where: { id },
    });
  },

  async createCommentReaction(
    commentId: string,
    userId: string,
    emoji: string,
  ) {
    return prisma.commentReaction.create({
      data: { commentId, userId, emoji },
    });
  },
};
