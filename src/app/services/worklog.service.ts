import prisma from "@/lib/prisma";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@/utils/app-error";

export const workLogService = {
  async createWorkLog(
    taskId: string,
    userId: string,
    data: {
      hoursLogged: number;
      loggedAt?: string;
      description?: string | null;
    },
  ) {
    if (data.hoursLogged <= 0) {
      throw new BadRequestException("Hours logged must be greater than zero");
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const workLog = await prisma.workLog.create({
      data: {
        taskId,
        userId,
        hoursLogged: data.hoursLogged,
        loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
        description: data.description,
      },
      include: {
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
    });

    return workLog;
  },

  async getTaskWorkLogs(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return prisma.workLog.findMany({
      where: { taskId },
      include: {
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
      orderBy: { loggedAt: "desc" },
    });
  },

  async getProjectWorkLogs(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return prisma.workLog.findMany({
      where: {
        task: {
          projectId,
        },
      },
      include: {
        task: {
          select: { id: true, title: true, taskKey: true },
        },
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
      orderBy: { loggedAt: "desc" },
    });
  },

  async updateWorkLog(
    workLogId: string,
    userId: string,
    data: {
      hoursLogged?: number;
      loggedAt?: string;
      description?: string | null;
    },
  ) {
    const workLog = await prisma.workLog.findUnique({
      where: { id: workLogId },
    });
    if (!workLog) {
      throw new NotFoundException("Work log not found");
    }

    // Only owner of the log or admins can update it
    if (workLog.userId !== userId) {
      throw new ForbiddenException("You cannot edit someone else's work log");
    }

    if (data.hoursLogged !== undefined && data.hoursLogged <= 0) {
      throw new BadRequestException("Hours logged must be greater than zero");
    }

    const updateData: Record<string, number | Date | string | null> = {};
    if (data.hoursLogged !== undefined)
      updateData.hoursLogged = data.hoursLogged;
    if (data.loggedAt !== undefined)
      updateData.loggedAt = new Date(data.loggedAt);
    if (data.description !== undefined)
      updateData.description = data.description;

    return prisma.workLog.update({
      where: { id: workLogId },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
    });
  },

  async deleteWorkLog(workLogId: string, userId: string) {
    const workLog = await prisma.workLog.findUnique({
      where: { id: workLogId },
    });
    if (!workLog) {
      throw new NotFoundException("Work log not found");
    }

    // Only owner of the log or admins can delete it
    if (workLog.userId !== userId) {
      throw new ForbiddenException("You cannot delete someone else's work log");
    }

    await prisma.workLog.delete({
      where: { id: workLogId },
    });
  },
};
