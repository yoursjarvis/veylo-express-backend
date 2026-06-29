import { sprintRepository } from "@/app/repositories/sprint.repository";
import { BadRequestException } from "@/utils/app-error";

export const sprintService = {
  async createSprint(
    projectId: string,
    organizationId: string,
    validatedData: {
      name: string;
      goal?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    }
  ) {
    return sprintRepository.create({
      name: validatedData.name,
      goal: validatedData.goal,
      projectId,
      organizationId,
      startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
      endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
      status: "planned",
    });
  },

  async getSprints(projectId: string) {
    return sprintRepository.findByProjectId(projectId);
  },

  async getSprint(sprintId: string) {
    return sprintRepository.findByIdWithTasks(sprintId);
  },

  async updateSprint(
    existingSprint: {
      id: string;
      projectId: string;
      organizationId: string;
      name: string;
      status: string;
      startDate: Date | null;
    },
    validatedData: {
      name?: string;
      goal?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      status?: "planned" | "active" | "completed";
      uncompletedTasksDestination?: string | null;
    },
    userId: string
  ) {
    const sprintId = existingSprint.id;
    const updateData: Record<string, string | Date | null | undefined> = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.goal !== undefined) updateData.goal = validatedData.goal;
    if (validatedData.startDate !== undefined) {
      updateData.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null;
    }
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
    }

    if (validatedData.status && validatedData.status !== existingSprint.status) {
      if (validatedData.status === "active") {
        const activeSprint = await sprintRepository.findFirstActiveByProjectId(
          existingSprint.projectId
        );
        if (activeSprint) {
          throw new BadRequestException(
            "An active sprint already exists. Close it before starting a new one."
          );
        }
        updateData.status = "active";
        if (!existingSprint.startDate) {
          updateData.startDate = new Date();
        }
      } else if (validatedData.status === "completed") {
        updateData.status = "completed";
        updateData.completedAt = new Date();

        const destSprintId = validatedData.uncompletedTasksDestination ?? null;

        if (destSprintId) {
          const destSprint = await sprintRepository.findSprintInProject(
            destSprintId,
            existingSprint.projectId
          );
          if (!destSprint) {
            throw new BadRequestException(
              "Selected destination sprint does not belong to this project"
            );
          }
        }

        const uncompletedTasks = await sprintRepository.findUncompletedTasksInSprint(sprintId);

        if (uncompletedTasks.length > 0) {
          const taskIds = uncompletedTasks.map((t) => t.id);

          await sprintRepository.updateTasksSprint(taskIds, destSprintId);

          const logPayloads = taskIds.map((taskId) => ({
            taskId,
            userId,
            organizationId: existingSprint.organizationId,
            action: "sprint_changed",
            oldValue: existingSprint.name,
            newValue: destSprintId ? "Next Sprint" : "Backlog",
          }));

          await sprintRepository.createTaskActivities(logPayloads);
        }
      } else {
        updateData.status = validatedData.status;
      }
    }

    return sprintRepository.update(sprintId, updateData);
  },

  async deleteSprint(sprintId: string) {
    await sprintRepository.delete(sprintId);
  },
};
