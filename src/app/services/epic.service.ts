import { epicRepository } from "@/app/repositories/epic.repository";

export const epicService = {
  async createEpic(
    projectId: string,
    organizationId: string,
    validatedData: {
      title: string;
      description?: string | null;
      color?: string;
      startDate?: string | null;
      endDate?: string | null;
    }
  ) {
    return epicRepository.create({
      title: validatedData.title,
      description: validatedData.description,
      color: validatedData.color ?? "#6366f1",
      projectId,
      organizationId,
      startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
      endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
      status: "open",
    });
  },

  async getEpics(projectId: string) {
    return epicRepository.findByProjectId(projectId);
  },

  async getEpic(epicId: string) {
    return epicRepository.findByIdWithTasks(epicId);
  },

  async updateEpic(
    epicId: string,
    validatedData: {
      title?: string;
      description?: string | null;
      color?: string;
      status?: "open" | "in_progress" | "done";
      startDate?: string | null;
      endDate?: string | null;
    }
  ) {
    const updateData: Record<string, unknown> = {};
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.color !== undefined) updateData.color = validatedData.color;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.startDate !== undefined) {
      updateData.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null;
    }
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
    }

    return epicRepository.update(epicId, updateData);
  },

  async deleteEpic(epicId: string) {
    await epicRepository.delete(epicId);
  },
};
