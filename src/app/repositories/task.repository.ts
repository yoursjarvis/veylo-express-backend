import prisma from "@/lib/prisma";

import { Prisma } from "../../../generated/prisma/client.js";

export const taskRepository = {
  async findTaskById(taskId: string) {
    return prisma.task.findUnique({
      where: { id: taskId },
    });
  },

  async findTaskDetails(taskId: string) {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, image: true, email: true },
        },
        reporter: {
          select: { id: true, name: true, image: true, email: true },
        },
        creator: {
          select: { id: true, name: true, image: true, email: true },
        },
        epic: true,
        milestone: true,
        labels: {
          include: {
            label: true,
          },
        },
        subtasks: {
          include: {
            assignee: { select: { id: true, name: true, image: true } },
            reporter: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        blockingDependencies: {
          include: {
            blockedTask: {
              select: { id: true, title: true, taskKey: true, statusId: true },
            },
          },
        },
        blockedByDependencies: {
          include: {
            blockingTask: {
              select: { id: true, title: true, taskKey: true, statusId: true },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, image: true, email: true },
            },
            reactions: {
              select: {
                id: true,
                emoji: true,
                userId: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        activityLogs: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  },

  async findTaskWithRelations(taskId: string) {
    return prisma.task.findUnique({
      where: { id: taskId },
      include: {
        status: true,
        assignee: true,
        reporter: true,
        sprint: true,
        epic: true,
        milestone: true,
      },
    });
  },

  findTaskStatusById(statusId: string, projectId: string) {
    return prisma.taskStatus.findFirst({
      where: { id: statusId, projectId },
    });
  },

  findSprintById(sprintId: string, projectId: string) {
    return prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });
  },

  findEpicById(epicId: string, projectId: string) {
    return prisma.epic.findFirst({
      where: { id: epicId, projectId },
    });
  },

  findMilestoneById(milestoneId: string, projectId: string) {
    return prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
    });
  },

  async incrementTaskSequence(projectId: string) {
    return prisma.project.update({
      where: { id: projectId },
      data: { taskSequence: { increment: 1 } },
      select: { projectKey: true, taskSequence: true },
    });
  },

  createTask(data: Prisma.TaskUncheckedCreateInput) {
    return prisma.task.create({
      data,
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, image: true, email: true },
        },
        reporter: {
          select: { id: true, name: true, image: true, email: true },
        },
        epic: true,
        milestone: true,
        labels: {
          include: {
            label: true,
          },
        },
      },
    });
  },

  getTasks(whereClause: Prisma.TaskWhereInput) {
    return prisma.task.findMany({
      where: whereClause,
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, image: true, email: true },
        },
        reporter: {
          select: { id: true, name: true, image: true, email: true },
        },
        epic: true,
        milestone: true,
        labels: {
          include: {
            label: true,
          },
        },
        _count: {
          select: { subtasks: true, comments: true },
        },
        subtasks: {
          include: {
            status: true,
            assignee: {
              select: { id: true, name: true, image: true, email: true },
            },
          },
          orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        },
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });
  },

  countIncompleteSubtasks(taskId: string) {
    return prisma.task.count({
      where: { parentTaskId: taskId, status: { category: { not: "done" } } },
    });
  },

  async completeAllSubtasks(taskId: string, projectId: string) {
    const doneStatus = await prisma.taskStatus.findFirst({
      where: { projectId, category: "done" },
    });
    if (doneStatus) {
      return prisma.task.updateMany({
        where: { parentTaskId: taskId, status: { category: { not: "done" } } },
        data: { statusId: doneStatus.id },
      });
    }
    return { count: 0 };
  },

  findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  },

  updateTask(taskId: string, updateData: Prisma.TaskUncheckedUpdateInput) {
    return prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        status: true,
        assignee: {
          select: { id: true, name: true, image: true, email: true },
        },
        reporter: {
          select: { id: true, name: true, image: true, email: true },
        },
        epic: true,
        milestone: true,
        labels: {
          include: {
            label: true,
          },
        },
      },
    });
  },

  deleteTask(taskId: string) {
    return prisma.task.delete({
      where: { id: taskId },
    });
  },

  createTaskActivity(data: {
    taskId: string;
    userId: string;
    organizationId: string;
    action: string;
    oldValue: string | null;
    newValue: string | null;
  }) {
    return prisma.taskActivity.create({
      data,
    });
  },

  findProjectById(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
    });
  },

  findMember(organizationId: string, userId: string) {
    return prisma.member.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ["owner", "admin"] },
      },
    });
  },

  findWorkspaceMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        role: "admin",
      },
    });
  },
};
