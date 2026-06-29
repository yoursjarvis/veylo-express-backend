import { labelRepository } from "@/app/repositories/label.repository";
import { BadRequestException } from "@/utils/app-error";

export const labelService = {
  async createLabel(
    projectId: string,
    organizationId: string,
    validatedData: { name: string; color: string },
  ) {
    const existingLabel = await labelRepository.findByNameAndProjectId(
      validatedData.name,
      projectId,
    );
    if (existingLabel) {
      throw new BadRequestException(
        "Label with this name already exists in the project",
      );
    }

    return labelRepository.create({
      name: validatedData.name,
      color: validatedData.color,
      projectId,
      organizationId,
    });
  },

  async getLabels(projectId: string) {
    return labelRepository.findByProjectId(projectId);
  },

  async updateLabel(
    label: { id: string; projectId: string },
    validatedData: { name?: string; color?: string },
  ) {
    if (validatedData.name) {
      const existingLabel = await labelRepository.findDuplicateName(
        label.projectId,
        validatedData.name,
        label.id,
      );
      if (existingLabel) {
        throw new BadRequestException(
          "Label with this name already exists in the project",
        );
      }
    }

    return labelRepository.update(label.id, validatedData);
  },

  async deleteLabel(labelId: string) {
    await labelRepository.delete(labelId);
  },
};
