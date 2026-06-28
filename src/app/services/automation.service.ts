import prisma from "@/lib/prisma";

export const automationService = {
  /**
   * Run automation rules for a project when a task is created
   */
  async handleTaskCreated(taskId: string, userId: string) {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });
      if (!task) return;

      const rules = await prisma.automationRule.findMany({
        where: {
          projectId: task.projectId,
          trigger: "task_created",
          isActive: true,
        },
      });

      for (const rule of rules) {
        await this.executeAction(rule, task, userId);
      }
    } catch (error) {
      console.error("Error in handleTaskCreated automation:", error);
    }
  },

  /**
   * Run automation rules for a project when a task status changes
   */
  async handleTaskStatusChanged(taskId: string, userId: string, fromStatusName: string, toStatusName: string) {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { status: true },
      });
      if (!task) return;

      const rules = await prisma.automationRule.findMany({
        where: {
          projectId: task.projectId,
          trigger: "task_status_changed",
          isActive: true,
        },
      });

      for (const rule of rules) {
        // Trigger condition check: status name or status category
        const matchesStatus =
          !rule.triggerVal ||
          rule.triggerVal.toLowerCase() === task.status.name.toLowerCase() ||
          rule.triggerVal.toLowerCase() === task.status.category.toLowerCase();

        if (!matchesStatus) continue;

        // Perform action
        await this.executeAction(rule, task, userId);
      }

      // Check "subtasks_all_done" rule for the parent task
      if (task.parentTaskId) {
        await this.handleSubtaskCompleted(task.parentTaskId, userId);
      }
    } catch (error) {
      console.error("Error in handleTaskStatusChanged automation:", error);
    }
  },

  /**
   * Run automation rules for a project when a task priority changes
   */
  async handlePriorityChanged(taskId: string, userId: string, fromPriority: string, toPriority: string) {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });
      if (!task) return;

      const rules = await prisma.automationRule.findMany({
        where: {
          projectId: task.projectId,
          trigger: "priority_changed",
          isActive: true,
        },
      });

      for (const rule of rules) {
        const matchesPriority =
          !rule.triggerVal ||
          rule.triggerVal.toLowerCase() === toPriority.toLowerCase();

        if (!matchesPriority) continue;

        await this.executeAction(rule, task, userId);
      }
    } catch (error) {
      console.error("Error in handlePriorityChanged automation:", error);
    }
  },

  /**
   * Handle checks when a subtask status is updated.
   * Check if all subtasks of a parent task are done, and execute matching rules.
   */
  async handleSubtaskCompleted(parentTaskId: string, userId: string) {
    try {
      // Find parent task and its subtasks
      const parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        include: {
          subtasks: {
            include: { status: true },
          },
        },
      });

      if (!parentTask || parentTask.subtasks.length === 0) return;

      // Check if all subtasks are in the "done" category
      const allDone = parentTask.subtasks.every((sub) => sub.status.category.toLowerCase() === "done");

      if (allDone) {
        const rules = await prisma.automationRule.findMany({
          where: {
            projectId: parentTask.projectId,
            trigger: "subtasks_all_done",
            isActive: true,
          },
        });

        for (const rule of rules) {
          await this.executeAction(rule, parentTask, userId);
        }
      }
    } catch (error) {
      console.error("Error in handleSubtaskCompleted automation:", error);
    }
  },

  /**
   * Execute automation action
   */
  async executeAction(rule: any, task: any, userId: string) {
    try {
      console.log(`Executing automation rule "${rule.name}" for task ${task.id} (${task.title})`);
      const { taskService } = await import("./task.service");

      if (rule.action === "close_parent" || rule.action === "update_status") {
        // Find a status in the project matching the actionVal (e.g. "Done" or "done")
        const targetStatusNameOrCategory = rule.actionVal || "Done";
        
        // Find task status for the project
        const statuses = await prisma.taskStatus.findMany({
          where: { projectId: task.projectId },
        });

        const targetStatus =
          statuses.find((s) => s.name.toLowerCase() === targetStatusNameOrCategory.toLowerCase()) ||
          statuses.find((s) => s.category.toLowerCase() === targetStatusNameOrCategory.toLowerCase()) ||
          statuses.find((s) => s.category.toLowerCase() === "done");

        if (targetStatus && task.statusId !== targetStatus.id) {
          await taskService.updateTask(task.id, userId, {
            statusId: targetStatus.id,
          });
        }
      } else if (rule.action === "assign_to_creator") {
        if (task.creatorId && task.assigneeId !== task.creatorId) {
          await taskService.updateTask(task.id, userId, {
            assigneeId: task.creatorId,
          });
        }
      } else if (rule.action === "assign_to_user") {
        if (rule.actionVal && task.assigneeId !== rule.actionVal) {
          await taskService.updateTask(task.id, userId, {
            assigneeId: rule.actionVal,
          });
        }
      } else if (rule.action === "set_priority") {
        const priorityVal = (rule.actionVal || "medium").toLowerCase();
        if (["low", "medium", "high", "urgent"].includes(priorityVal) && task.priority !== priorityVal) {
          await taskService.updateTask(task.id, userId, {
            priority: priorityVal as any,
          });
        }
      } else if (rule.action === "add_comment") {
        const commentContent = rule.actionVal || "Automated action executed.";
        await prisma.comment.create({
          data: {
            taskId: task.id,
            userId: userId || task.creatorId,
            content: commentContent,
            organizationId: task.organizationId,
          },
        });
      }
    } catch (error) {
      console.error(`Failed to execute action for rule ${rule.id}:`, error);
    }
  },
};
