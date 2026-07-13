import { taskRepository } from "@/app/repositories/task.repository";
import { automationService } from "@/app/services/automation.service";
import { notificationService } from "@/app/services/notification.service";
import { workflowService } from "@/app/services/workflow.service";
import { mediaService } from "@/core/media";
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@/utils/app-error";

import { Prisma } from "../../../generated/prisma/client.js";

async function logActivity(
  taskId: string,
  userId: string,
  organizationIdOrAction: string,
  actionOrOldValue?: string | null,
  oldValueOrNewValue?: string | null,
  newValue?: string | null,
) {
  let organizationId = organizationIdOrAction;
  let action = actionOrOldValue as string;
  let oldValue = oldValueOrNewValue;
  let valNew = newValue;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
      startDate?: string | null;
      dueDate?: string | null;
      assigneeId?: string | null;
      reporterId?: string | null;
      parentTaskId?: string | null;
      position?: number;
      customFields?: Record<string, unknown>;
      labelIds?: string[];
      isPrivate?: boolean;
    },
  ) {
    // Verify status belongs to project
    const status = await taskRepository.findTaskStatusById(
      data.statusId,
      projectId,
    );
    if (!status) {
      throw new BadRequestException(
        "Selected status does not belong to this project",
      );
    }

    // Verify sprint belongs to project
    if (data.sprintId) {
      const sprint = await taskRepository.findSprintById(
        data.sprintId,
        projectId,
      );
      if (!sprint) {
        throw new BadRequestException(
          "Selected sprint does not belong to this project",
        );
      }
    }

    // Verify epic belongs to project
    if (data.epicId) {
      const epic = await taskRepository.findEpicById(data.epicId, projectId);
      if (!epic) {
        throw new BadRequestException(
          "Selected epic does not belong to this project",
        );
      }
    }

    // Verify milestone belongs to project
    if (data.milestoneId) {
      const milestone = await taskRepository.findMilestoneById(
        data.milestoneId,
        projectId,
      );
      if (!milestone) {
        throw new BadRequestException(
          "Selected milestone does not belong to this project",
        );
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
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      creatorId: userId,
      assigneeId: data.assigneeId ?? null,
      reporterId: data.reporterId ?? null,
      parentTaskId: data.parentTaskId ?? null,
      position: data.position ?? 0,
      customFields: data.customFields as Prisma.InputJsonValue,
      isPrivate: data.isPrivate ?? false,
      labels:
        data.labelIds && data.labelIds.length > 0
          ? {
              create: data.labelIds.map((labelId) => ({
                labelId,
                organizationId,
              })),
            }
          : undefined,
    });

    // Log creation
    await logActivity(
      task.id,
      userId,
      organizationId,
      "created",
      null,
      task.title,
    );

    // Trigger notification in background
    notificationService.handleTaskCreated(task.id, userId);

    // Trigger automation rules in background
    automationService
      .handleTaskCreated(task.id, userId)
      .catch((err) =>
        console.error("Error running task_created automation:", err),
      );

    return task;
  },

  async getTasks(
    projectId: string,
    query: {
      sprintId?: string;
      assigneeId?: string;
      statusId?: string;
      priority?: string;
      type?: string;
      search?: string;
      epicId?: string;
      milestoneId?: string;
      labelId?: string;
      filters?: string;
    },
    userId?: string,
  ) {
    const {
      sprintId,
      assigneeId,
      statusId,
      priority,
      type,
      search,
      epicId,
      milestoneId,
      labelId,
    } = query;

    const project = await taskRepository.findProjectById(projectId);
    if (!project) throw new NotFoundException("Project not found");

    let isAdmin = false;
    if (userId) {
      const isOrgAdmin = !!(await taskRepository.findMember(
        project.organizationId,
        userId,
      ));
      const isWorkspaceAdmin = !!(await taskRepository.findWorkspaceMember(
        project.workspaceId,
        userId,
      ));
      isAdmin = isOrgAdmin || isWorkspaceAdmin;
    }

    const whereClause: {
      projectId: string;
      deletedAt: null;
      parentTaskId: null;
      AND?: Prisma.TaskWhereInput[];
      [key: string]: unknown;
    } = {
      projectId,
      deletedAt: null,
      parentTaskId: null,
    };

    if (userId && !isAdmin) {
      whereClause.AND = [
        {
          OR: [
            { isPrivate: false },
            { creatorId: userId },
            { assigneeId: userId },
            { reporterId: userId },
          ],
        },
      ];
    }

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

    if (query.filters) {
      try {
        const filters = JSON.parse(query.filters as string);
        const andConditions: Prisma.TaskWhereInput[] = [];
        for (const filter of filters) {
          const { field, operator, values } = filter;
          if (!field || !operator) continue;

          if (field === "search") {
            const val = values[0];
            if (val) {
              andConditions.push({
                OR: [
                  { title: { contains: val, mode: "insensitive" } },
                  { description: { contains: val, mode: "insensitive" } },
                ],
              });
            }
            continue;
          }

          let condition: Record<string, unknown> = {};

          if (field === "labelId") {
            if (operator === "empty") {
              andConditions.push({ labels: { none: {} } });
            } else if (operator === "not_empty") {
              andConditions.push({ labels: { some: {} } });
            } else if (values && values.length > 0) {
              if (
                operator === "is" ||
                operator === "is_any_of" ||
                operator === "includes_any_of" ||
                operator === "includes"
              ) {
                andConditions.push({
                  labels: { some: { labelId: { in: values } } },
                });
              } else if (
                operator === "is_not" ||
                operator === "is_not_any_of" ||
                operator === "excludes_all" ||
                operator === "excludes"
              ) {
                andConditions.push({
                  labels: { none: { labelId: { in: values } } },
                });
              } else if (operator === "includes_all") {
                for (const val of values) {
                  andConditions.push({ labels: { some: { labelId: val } } });
                }
              }
            }
            continue;
          }

          const val = values && values.length > 0 ? values[0] : null;
          const mappedField = field === "assignee" ? "assigneeId" : field;

          switch (operator) {
            case "is":
            case "equals":
              condition[mappedField] = val === "null" ? null : val;
              break;
            case "is_not":
            case "not_equals":
              condition[mappedField] =
                val === "null" ? { not: null } : { not: val };
              break;
            case "is_any_of":
              condition[mappedField] = {
                in: values.map((v: string) => (v === "null" ? null : v)),
              };
              break;
            case "is_not_any_of":
              condition[mappedField] = {
                notIn: values.map((v: string) => (v === "null" ? null : v)),
              };
              break;
            case "empty":
              condition[mappedField] = null;
              break;
            case "not_empty":
              condition[mappedField] = { not: null };
              break;
            case "contains":
              if (val)
                condition[mappedField] = { contains: val, mode: "insensitive" };
              break;
            case "not_contains":
              if (val)
                condition[mappedField] = {
                  not: { contains: val, mode: "insensitive" },
                };
              break;
          }

          if (Object.keys(condition).length > 0) {
            andConditions.push(condition);
          }
        }

        if (andConditions.length > 0) {
          if (!whereClause.AND) whereClause.AND = [];
          whereClause.AND.push(...andConditions);
        }
      } catch (error) {
        console.error("Failed to parse filters:", error);
      }
    }

    return taskRepository.getTasks(whereClause);
  },

  async getTask(taskId: string, userId?: string) {
    const task = await taskRepository.findTaskDetails(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (task.isPrivate && userId) {
      const project = await taskRepository.findProjectById(task.projectId);

      const { rbacService } = await import("@/app/services/rbac.service");
      const isAllowed = await rbacService.authorize(userId, "task:read", {
        organizationId: task.organizationId,
        workspaceId: project?.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
      });

      if (!isAllowed) {
        throw new ForbiddenException("Forbidden: This task is private");
      }
    }

    const attachments = await mediaService.getMedia(
      "Task",
      taskId,
      "task_attachments",
    );
    const attachmentsWithUrls = attachments.map(
      (a: {
        id: string;
        disk: string;
        modelType: string;
        collectionName: string;
        fileName: string;
        [key: string]: unknown;
      }) => ({
        ...a,
        url: mediaService.generateUrl(a),
      }),
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
      startDate?: string | null;
      dueDate?: string | null;
      assigneeId?: string | null;
      reporterId?: string | null;
      position?: number;
      customFields?: Record<string, unknown>;
      labelIds?: string[];
      isPrivate?: boolean;
    },
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

    const updateData: Record<string, unknown> = {};

    // Validate and audit status change
    if (data.statusId && data.statusId !== existingTask.statusId) {
      const newStatus = await taskRepository.findTaskStatusById(
        data.statusId,
        existingTask.projectId,
      );
      if (!newStatus) {
        throw new BadRequestException(
          "Selected status does not belong to this project",
        );
      }

      // Workflow transition validation
      await workflowService.validateTransition(
        existingTask.projectId,
        existingTask.statusId,
        data.statusId,
        userId,
      );

      // Advanced transition validation: Auto-complete subtasks when transitioning to Done
      if (newStatus.category === "done") {
        await taskRepository.completeAllSubtasks(
          taskId,
          existingTask.projectId,
        );
      }

      updateData.statusId = data.statusId;
      await logActivity(
        taskId,
        userId,
        "status_changed",
        existingTask.status.name,
        newStatus.name,
      );
    }

    // Validate and audit sprint change
    if (
      data.sprintId !== undefined &&
      data.sprintId !== existingTask.sprintId
    ) {
      let sprintName = "Backlog";
      if (data.sprintId) {
        const sprint = await taskRepository.findSprintById(
          data.sprintId,
          existingTask.projectId,
        );
        if (!sprint) {
          throw new BadRequestException(
            "Selected sprint does not belong to this project",
          );
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
        sprintName,
      );
    }

    // Validate and audit assignee change
    if (
      data.assigneeId !== undefined &&
      data.assigneeId !== existingTask.assigneeId
    ) {
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
        assigneeName,
      );
    }

    // Validate and audit reporter change
    if (
      data.reporterId !== undefined &&
      data.reporterId !== existingTask.reporterId
    ) {
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
        reporterName,
      );
    }

    // Audit priority change
    if (data.priority && data.priority !== existingTask.priority) {
      updateData.priority = data.priority;
      await logActivity(
        taskId,
        userId,
        "priority_changed",
        existingTask.priority,
        data.priority,
      );
    }

    // Audit estimate change
    if (
      data.estimate !== undefined &&
      data.estimate !== existingTask.estimate
    ) {
      updateData.estimate = data.estimate;
      await logActivity(
        taskId,
        userId,
        "estimate_changed",
        existingTask.estimate?.toString() || "No Estimate",
        data.estimate?.toString() || "No Estimate",
      );
    }

    // Validate and audit epic change
    if (data.epicId !== undefined && data.epicId !== existingTask.epicId) {
      let epicName = "None";
      if (data.epicId) {
        const epic = await taskRepository.findEpicById(
          data.epicId,
          existingTask.projectId,
        );
        if (!epic) {
          throw new BadRequestException(
            "Selected epic does not belong to this project",
          );
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
        epicName,
      );
    }

    // Validate and audit milestone change
    if (
      data.milestoneId !== undefined &&
      data.milestoneId !== existingTask.milestoneId
    ) {
      let milestoneName = "None";
      if (data.milestoneId) {
        const milestone = await taskRepository.findMilestoneById(
          data.milestoneId,
          existingTask.projectId,
        );
        if (!milestone) {
          throw new BadRequestException(
            "Selected milestone does not belong to this project",
          );
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
        milestoneName,
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
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.customFields !== undefined)
      updateData.customFields = data.customFields;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.isPrivate !== undefined) {
      updateData.isPrivate = data.isPrivate;
      await logActivity(
        taskId,
        userId,
        "privacy_changed",
        existingTask.isPrivate ? "Private" : "Public",
        data.isPrivate ? "Private" : "Public",
      );
    }

    const updatedTask = await taskRepository.updateTask(taskId, updateData);

    // Trigger notification
    notificationService.handleTaskUpdated(taskId, userId, oldTaskInfo);

    // Trigger automation rules in background if status changed
    if (data.statusId && data.statusId !== existingTask.statusId) {
      const newStatus = await taskRepository.findTaskStatusById(
        data.statusId,
        existingTask.projectId,
      );
      if (newStatus) {
        automationService
          .handleTaskStatusChanged(
            taskId,
            userId,
            existingTask.status.name,
            newStatus.name,
          )
          .catch((err) =>
            console.error("Error running automation rules:", err),
          );
      }
    }

    // Trigger automation rules in background if priority changed
    if (data.priority && data.priority !== existingTask.priority) {
      automationService
        .handlePriorityChanged(
          taskId,
          userId,
          existingTask.priority,
          data.priority,
        )
        .catch((err) =>
          console.error("Error running priority changed automation:", err),
        );
    }

    return updatedTask;
  },

  async deleteTask(taskId: string, userId: string) {
    const task = await taskRepository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await taskRepository.deleteTask(taskId);

    await logActivity(taskId, userId, "deleted", task.title, null);
  },

  async restoreTask(taskId: string, userId: string) {
    const task = await taskRepository.findTaskByIdWithTrashed(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await taskRepository.restoreTask(taskId);

    await logActivity(taskId, userId, "restored", null, task.title);
  },

  async forceDeleteTask(taskId: string, _userId: string) {
    const task = await taskRepository.findTaskByIdWithTrashed(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await taskRepository.forceDeleteTask(taskId);
  },
};
