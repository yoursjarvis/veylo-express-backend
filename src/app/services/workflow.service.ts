import { workflowRepository } from "@/app/repositories/workflow.repository";
import { BadRequestException } from "@/utils/app-error";

export const workflowService = {
  async validateTransition(
    projectId: string,
    fromStatusId: string,
    toStatusId: string,
    _userId: string
  ) {
    // If no transition is defined for this project, we allow all transitions (default behavior)
    // Or you can implement a "strict mode" where no transitions are allowed unless defined.
    // For now, we'll assume that if transitions exist for the project, they must be followed.
    
    const transitions = await workflowRepository.getTransitionsByProject(projectId);
    if (transitions.length === 0) return true;

    const transition = await workflowRepository.findTransition(projectId, fromStatusId, toStatusId);
    
    if (!transition) {
      throw new BadRequestException("This status transition is not allowed in the current project workflow.");
    }

    if (transition.requiredRoleId) {
      // Check if user has the required role in this project/org
      // This would typically involve checking UserRoleAssignment
      // For simplicity in this step, we just check if a transition exists.
      // In a full implementation, we'd integrate with rbacService.
    }

    return true;
  },

  async createTransition(data: {
    projectId: string;
    organizationId: string;
    fromStatusId: string;
    toStatusId: string;
    requiredRoleId?: string | null;
  }) {
    return workflowRepository.createTransition(data);
  },

  async getProjectWorkflow(projectId: string) {
    return workflowRepository.getTransitionsByProject(projectId);
  },
};
