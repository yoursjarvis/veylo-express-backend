import { taskExtrasRepository } from "@/app/repositories/task-extras.repository";
import { taskRepository } from "@/app/repositories/task.repository";
import prisma from "@/lib/prisma";
import { NotFoundException } from "@/utils/app-error";

export const checklistTemplateService = {
  async getTemplates(workspaceId: string) {
    return prisma.checklistTemplate.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  },

  async getTemplate(id: string) {
    const template = await prisma.checklistTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException("Checklist template not found");
    }
    return template;
  },

  async createTemplate(data: {
    name: string;
    description?: string | null;
    items: string[];
    workspaceId: string;
    organizationId: string;
  }) {
    return prisma.checklistTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        items: data.items,
        workspaceId: data.workspaceId,
        organizationId: data.organizationId,
      },
    });
  },

  async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      items?: string[];
    }
  ) {
    await this.getTemplate(id);
    return prisma.checklistTemplate.update({
      where: { id },
      data,
    });
  },

  async deleteTemplate(id: string) {
    await this.getTemplate(id);
    return prisma.checklistTemplate.delete({
      where: { id },
    });
  },

  async applyTemplateToTask(taskId: string, templateId: string, userId: string) {
    const template = await this.getTemplate(templateId);
    const parentTask = await taskExtrasRepository.findTaskById(taskId);
    if (!parentTask) {
      throw new NotFoundException("Parent task not found");
    }

    const statuses = await taskExtrasRepository.findStatusesByProjectId(parentTask.projectId);
    const todoStatus = statuses.find((s) => s.category === "todo") || statuses[0];
    if (!todoStatus) {
      throw new NotFoundException("No status found for project");
    }

    const items = template.items as string[];
    const createdSubtasks = [];

    for (const itemTitle of items) {
      const projectData = await taskRepository.incrementTaskSequence(parentTask.projectId);
      const taskKey = `${projectData.projectKey}-${projectData.taskSequence}`;

      const subtask = await taskExtrasRepository.createSubtask({
        title: itemTitle,
        taskKey,
        parentTaskId: taskId,
        organizationId: parentTask.organizationId,
        projectId: parentTask.projectId,
        statusId: todoStatus.id,
        creatorId: userId,
      });

      await taskExtrasRepository.createTaskActivity({
        taskId: parentTask.id,
        userId,
        organizationId: parentTask.organizationId,
        action: "subtask_created",
        newValue: itemTitle,
      });

      createdSubtasks.push(subtask);
    }

    return createdSubtasks;
  },
};
