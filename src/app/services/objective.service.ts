import { objectiveRepository } from "@/app/repositories/objective.repository";
import { NotFoundException } from "@/utils/app-error";

export const objectiveService = {
  async getObjectives(workspaceId: string, withTrashed = false) {
    return objectiveRepository.findObjectivesByWorkspace(workspaceId, withTrashed);
  },

  async createObjective(
    organizationId: string,
    data: {
      title: string;
      description?: string;
      projectId: string;
      epicId?: string | null;
      krTitle: string;
      krTarget: string;
    },
  ) {
    const project = await objectiveRepository.findProjectById(data.projectId);
    if (!project || project.organizationId !== organizationId) {
      throw new NotFoundException("Project not found in this organization");
    }

    return objectiveRepository.createObjective({
      ...data,
      organizationId,
    });
  },

  async deleteObjective(objectiveId: string) {
    const objective =
      await objectiveRepository.findObjectiveByIdWithTrashed(objectiveId);
    if (!objective) {
      throw new NotFoundException("Objective not found");
    }
    return objectiveRepository.deleteObjective(objectiveId);
  },

  async restoreObjective(objectiveId: string) {
    const objective =
      await objectiveRepository.findObjectiveByIdWithTrashed(objectiveId);
    if (!objective) {
      throw new NotFoundException("Objective not found");
    }
    return objectiveRepository.restoreObjective(objectiveId);
  },

  async forceDeleteObjective(objectiveId: string) {
    const objective =
      await objectiveRepository.findObjectiveByIdWithTrashed(objectiveId);
    if (!objective) {
      throw new NotFoundException("Objective not found");
    }
    return objectiveRepository.forceDeleteObjective(objectiveId);
  },

  async updateObjective(
    objectiveId: string,
    organizationId: string,
    data: {
      title?: string;
      description?: string;
      projectId?: string;
      epicId?: string | null;
      krTitle?: string;
      krTarget?: string;
    },
  ) {
    const objective =
      await objectiveRepository.findObjectiveByIdWithTrashed(objectiveId);
    if (!objective) {
      throw new NotFoundException("Objective not found");
    }

    if (data.projectId) {
      const project = await objectiveRepository.findProjectById(data.projectId);
      if (!project || project.organizationId !== organizationId) {
        throw new NotFoundException("Project not found in this organization");
      }
    }

    return objectiveRepository.updateObjective(objectiveId, data);
  },
};
