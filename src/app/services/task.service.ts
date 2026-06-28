import { taskRepository } from "@/app/repositories/task.repository";
import { notificationService } from "@/app/services/notification.service";
import { mediaService } from "@/core/media";
import { BadRequestException, NotFoundException } from "@/utils/app-error";

async function logActivity(
  taskId: string,
  userId: string,
  organizationIdOrAction: string,
  actionOrOldValue?: string | null,
  oldValueOrNewValue?: string | null,
  newValue?: string | null
) {
  let organizationId = organizationIdOrAction;
  let action = actionOrOldValue as string;
  let oldValue = oldValueOrNewValue;
  let valNew = newValue;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(organizationId)) {
    action = organizationIdOrAction;
    oldValue = actionOrOldValue;
    valNew = oldValueOrNewValue;

    const task = await taskRepository.findTaskById(taskId);
    organizationId = task?.organizationId || "";
  }

  await taskRepository.createTaskActivity({
    taskId,
    userId,
    organizationId,
    action,
    oldValue: oldValue ?? null,
    newValue: valNew ?? null,
  });
}

export const taskService = {
  async createTask(
    projectId: string,
    userId: string,
    organizationId: string,
    data: {
      title: string;
      description?: string | null;
      statusId: string;
      sprintId?: string | null;
      epicId?: string | null;
      milestoneId?: string | null;
      type: "task" | "bug" | "feature" | "subtask";
      priority: "low" | "medium" | "high" | "urgent";
      estimate?: number | null;
      dueDate?: string | null;
      assigneeId?: string | null;
      reporterId?: string | null;
      parentTaskId?: string | null;
      position?: number;
      customFields?: Record<string, any>;
      labelIds?: string[];
    }
  ) {
    // Verify status belongs to project
    const status = await taskRepository.findTaskStatusById(data.statusId, projectId);
    if (!status) {
      throw new BadRequestException("Selected status does not belong to this project");
    }

    // Verify sprint belongs to project
    if (data.sprintId) {
      const sprint = await taskRepository.findSprintById(data.sprintId, projectId);
      if (!sprint) {
        throw new BadRequestException("Selected sprint does not belong to this project");
      }
    }

    // Verify epic belongs to project
    if (data.epicId) {
      const epic = await taskRepository.findEpicById(data.epicId, projectId);
      if (!epic) {
        throw new BadRequestException("Selected epic does not belong to this project");
      }
    }

    // Verify milestone belongs to project
    if (data.milestoneId) {
      const milestone = await taskRepository.findMilestoneById(data.milestoneId, projectId);
      if (!milestone) {
        throw new BadRequestException("Selected milestone does not belong to this project");
      }
    }

    const projectData = await taskRepository.incrementTaskSequence(projectId);
    const taskKey = `${projectData.projectKey}-${projectData.taskSequence}`;

    const task = await taskRepository.createTask({
      taskKey,
      title: data.title,
      description: data.description,
      statusId: data.statusId,
      projectId,
      organizationId,
      sprintId: data.sprintId ?? null,
      epicId: data.epicId ?? null,
      milestoneId: data.milestoneId ?? null,
      type: data.type,
      priority: data.priority,
      estimate: data.estimate,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      creatorId: userId,
      assigneeId: data.assigneeId ?? null,
      reporterId: data.reporterId ?? null,
      parentTaskId: data.parentTaskId ?? null,
      position: data.position ?? 0,
      customFields: data.customFields,
      labels:
        data.labelIds && data.labelIds.length > 0
          ? {
              create: data.labelIds.map((labelId) => ({ labelId })),
            }
          : undefined,
    });

    // Log creation
    await logActivity(task.id, userId, organizationId, "created", null, task.title);

    // Trigger notification in background
    notificationService.handleTaskCreated(task.id, userId);

    return task;
  },

  async getTasks(projectId: string, query: any) {
    const { sprintId, assigneeId, statusId, priority, type, search, epicId, milestoneId, labelId } = query;

    const whereClause: any = {
      projectId,
      deletedAt: null,
      parentTaskId: null,
    };

    if (sprintId === "null") {
      whereClause.sprintId = null;
    } else if (sprintId) {
      whereClause.sprintId = sprintId as string;
    }

    if (epicId === "null") {
      whereClause.epicId = null;
    } else if (epicId) {
      whereClause.epicId = epicId as string;
    }

    if (milestoneId === "null") {
      whereClause.milestoneId = null;
    } else if (milestoneId) {
      whereClause.milestoneId = milestoneId as string;
    }

    if (labelId) {
      const labelIds = (labelId as string).split(",");
      whereClause.labels = {
        some: {
          labelId: { in: labelIds },
        },
      };
    }

    if (assigneeId === "null") {
      whereClause.assigneeId = null;
    } else if (assigneeId) {
      whereClause.assigneeId = assigneeId as string;
    }

    if (statusId) {
      whereClause.statusId = statusId as string;
    }

    if (priority) {
      whereClause.priority = priority as string;
    }

    if (type) {
      whereClause.type = type as string;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    return taskRepository.getTasks(whereClause);
  },

  async getTask(taskId: string) {
    const task = await taskRepository.findTaskDetails(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const attachments = await mediaService.getMedia("Task", taskId, "task_attachments");
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (a: any) => ({
        ...a,
        url: await mediaService.getUrl(a.id),
      }))
    );

    return {
      ...task,
      attachments: attachmentsWithUrls,
    };
  },

  async updateTask(
    taskId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      statusId?: string;
      sprintId?: string | null;
      epicId?: string | null;
      milestoneId?: string | null;
      type?: "task" | "bug" | "feature" | "subtask";
      priority?: "low" | "medium" | "high" | "urgent";
      estimate?: number | null;
      dueDate?: string | null;
      assigneeId?: string | null;
      reporterId?: string | null;
      position?: number;
      customFields?: Record<string, any>;
      labelIds?: string[];
    }
  ) {
    const existingTask = await taskRepository.findTaskWithRelations(taskId);
    if (!existingTask) {
      throw new NotFoundException("Task not found");
    }

    const oldTaskInfo = {
      statusId: existingTask.statusId,
      statusName: existingTask.status.name,
      assigneeId: existingTask.assigneeId,
      assigneeName: existingTask.assignee?.name,
      description: existingTask.description,
    };

    const updateData: any = {};

    // Validate and audit status change
    if (data.statusId && data.statusId !== existingTask.statusId) {
      const newStatus = await taskRepository.findTaskStatusById(data.statusId, existingTask.projectId);
      if (!newStatus) {
        throw new BadRequestException("Selected status does not belong to this project");
      }

      // Advanced transition validation: Auto-complete subtasks when transitioning to Done
      if (newStatus.category === "done") {
        await taskRepository.completeAllSubtasks(taskId, existingTask.projectId);
      }

      updateData.statusId = data.statusId;
      await logActivity(taskId, userId, "status_changed", existingTask.status.name, newStatus.name);
    }

    // Validate and audit sprint change
    if (data.sprintId !== undefined && data.sprintId !== existingTask.sprintId) {
      let sprintName = "Backlog";
      if (data.sprintId) {
        const sprint = await taskRepository.findSprintById(data.sprintId, existingTask.projectId);
        if (!sprint) {
          throw new BadRequestException("Selected sprint does not belong to this project");
        }
        updateData.sprintId = data.sprintId;
        sprintName = sprint.name;
      } else {
        updateData.sprintId = null;
      }
      await logActivity(
        taskId,
        userId,
        "sprint_changed",
        existingTask.sprint?.name || "Backlog",
        sprintName
      );
    }

    // Validate and audit assignee change
    if (data.assigneeId !== undefined && data.assigneeId !== existingTask.assigneeId) {
      let assigneeName = "Unassigned";
      if (data.assigneeId) {
        const newAssignee = await taskRepository.findUserById(data.assigneeId);
        if (!newAssignee) {
          throw new BadRequestException("Assignee not found");
        }
        updateData.assigneeId = data.assigneeId;
        assigneeName = newAssignee.name;
      } else {
        updateData.assigneeId = null;
      }
      await logActivity(
        taskId,
        userId,
        "assignee_changed",
        existingTask.assignee?.name || "Unassigned",
        assigneeName
      );
    }

    // Validate and audit reporter change
    if (data.reporterId !== undefined && data.reporterId !== existingTask.reporterId) {
      let reporterName = "Unassigned";
      if (data.reporterId) {
        const newReporter = await taskRepository.findUserById(data.reporterId);
        if (!newReporter) {
          throw new BadRequestException("Reporter not found");
        }
        updateData.reporterId = data.reporterId;
        reporterName = newReporter.name;
      } else {
        updateData.reporterId = null;
      }
      await logActivity(
        taskId,
        userId,
        "reporter_changed",
        existingTask.reporter?.name || "Unassigned",
        reporterName
      );
    }

    // Audit priority change
    if (data.priority && data.priority !== existingTask.priority) {
      updateData.priority = data.priority;
      await logActivity(taskId, userId, "priority_changed", existingTask.priority, data.priority);
    }

    // Audit estimate change
    if (data.estimate !== undefined && data.estimate !== existingTask.estimate) {
      updateData.estimate = data.estimate;
      await logActivity(
        taskId,
        userId,
        "estimate_changed",
        existingTask.estimate?.toString() || "No Estimate",
        data.estimate?.toString() || "No Estimate"
      );
    }

    // Validate and audit epic change
    if (data.epicId !== undefined && data.epicId !== existingTask.epicId) {
      let epicName = "None";
      if (data.epicId) {
        const epic = await taskRepository.findEpicById(data.epicId, existingTask.projectId);
        if (!epic) {
          throw new BadRequestException("Selected epic does not belong to this project");
        }
        updateData.epicId = data.epicId;
        epicName = epic.title;
      } else {
        updateData.epicId = null;
      }
      await logActivity(
        taskId,
        userId,
        "epic_changed",
        existingTask.epic?.title || "None",
        epicName
      );
    }

    // Validate and audit milestone change
    if (data.milestoneId !== undefined && data.milestoneId !== existingTask.milestoneId) {
      let milestoneName = "None";
      if (data.milestoneId) {
        const milestone = await taskRepository.findMilestoneById(data.milestoneId, existingTask.projectId);
        if (!milestone) {
          throw new BadRequestException("Selected milestone does not belong to this project");
        }
        updateData.milestoneId = data.milestoneId;
        milestoneName = milestone.title;
      } else {
        updateData.milestoneId = null;
      }
      await logActivity(
        taskId,
        userId,
        "milestone_changed",
        existingTask.milestone?.title || "None",
        milestoneName
      );
    }

    // Handle labelIds changes
    if (data.labelIds !== undefined) {
      updateData.labels = {
        deleteMany: {},
        create: data.labelIds.map((labelId) => ({ labelId })),
      };
    }

    // Rest of fields
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.customFields !== undefined) updateData.customFields = data.customFields;
    if (data.position !== undefined) updateData.position = data.position;

    const updatedTask = await taskRepository.updateTask(taskId, updateData);

    // Trigger notification
    notificationService.handleTaskUpdated(taskId, userId, oldTaskInfo);

    return updatedTask;
  },

  async deleteTask(taskId: string, userId: string) {
    const task = await taskRepository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    // Soft delete is automated via middleware, but we invoke delete
    await taskRepository.deleteTask(taskId);

    await logActivity(taskId, userId, "deleted", task.title, null);
  },
};
