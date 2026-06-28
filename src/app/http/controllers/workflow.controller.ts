import { Request, Response } from "express";
import { workflowService } from "@/app/services/workflow.service";
import { workflowRepository } from "@/app/repositories/workflow.repository";
import { HttpResponse } from "@/utils/http-response";

export const workflowController = {
  async getTransitions(req: Request, res: Response) {
    const { projectId } = req.params;
    const transitions = await workflowService.getProjectWorkflow(projectId);
    return HttpResponse.ok(transitions);
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
    return HttpResponse.ok(transition);
  },

  async deleteTransition(req: Request, res: Response) {
    const id = req.params.id as string;
    await workflowRepository.deleteTransition(id);
    return HttpResponse.ok({ message: "Transition deleted successfully" });
  },
};
