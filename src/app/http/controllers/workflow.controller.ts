import { Request, Response } from "express";
import { workflowService } from "@/app/services/workflow.service";
import { workflowRepository } from "@/app/repositories/workflow.repository";
import { ok } from "@/utils/http-response";

export const workflowController = {
  async getTransitions(req: Request, res: Response) {
    const { projectId } = req.params;
    const transitions = await workflowService.getProjectWorkflow(projectId as string);
    return ok(res, "Transitions fetched successfully", transitions);
  },

  async createTransition(req: Request, res: Response) {
    const { projectId, organizationId, fromStatusId, toStatusId, requiredRoleId } = req.body;
    const transition = await workflowService.createTransition({
      projectId,
      organizationId,
      fromStatusId,
      toStatusId,
      requiredRoleId,
    });
    return ok(res, "Transition created successfully", transition);
  },

  async deleteTransition(req: Request, res: Response) {
    const id = req.params.id as string;
    await workflowRepository.deleteTransition(id);
    return ok(res, "Transition deleted successfully");
  },
};
