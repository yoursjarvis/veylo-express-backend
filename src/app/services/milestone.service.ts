import { milestoneRepository } from "@/app/repositories/milestone.repository";
import { NotFoundException } from "@/utils/app-error";

export const milestoneService = {
  async createMilestone(
    projectId: string,
    organizationId: string,
    validatedData: {
      title: string;
      description?: string | null;
      dueDate?: string | null;
    },
  ) {
    return milestoneRepository.create({
      title: validatedData.title,
      description: validatedData.description,
      projectId,
      organizationId,
      dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
      isCompleted: false,
    });
  },

  async getMilestones(projectId: string) {
    return milestoneRepository.findByProjectId(projectId);
  },

  async updateMilestone(
    milestoneId: string,
    validatedData: {
      title?: string;
      description?: string | null;
      isCompleted?: boolean;
      dueDate?: string | null;
    },
  ) {
    const updateData: Record<string, unknown> = {};
    if (validatedData.title !== undefined)
      updateData.title = validatedData.title;
    if (validatedData.description !== undefined)
      updateData.description = validatedData.description;
    if (validatedData.isCompleted !== undefined)
      updateData.isCompleted = validatedData.isCompleted;
    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate
        ? new Date(validatedData.dueDate)
        : null;
    }

    return milestoneRepository.update(milestoneId, updateData);
  },

  async deleteMilestone(milestoneId: string) {
    await milestoneRepository.delete(milestoneId);
  },

  async restoreMilestone(milestoneId: string) {
    const milestone = await milestoneRepository.findByIdWithTrashed(milestoneId);
    if (!milestone) {
      throw new NotFoundException("Milestone not found");
    }
    return milestoneRepository.restore(milestoneId);
  },

  async forceDeleteMilestone(milestoneId: string) {
    const milestone = await milestoneRepository.findByIdWithTrashed(milestoneId);
    if (!milestone) {
      throw new NotFoundException("Milestone not found");
    }
    return milestoneRepository.forceDelete(milestoneId);
  },
};
