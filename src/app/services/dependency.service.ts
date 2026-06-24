import { dependencyRepository } from "@/app/repositories/dependency.repository";
import { NotFoundException, BadRequestException } from "@/utils/app-error";

export const dependencyService = {
  async getDependencies(taskId: string) {
    const task = await dependencyRepository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const { blockedBy, blocking } = await dependencyRepository.getDependencies(taskId);

    return {
      projectId: task.projectId,
      data: {
        blockedBy: blockedBy.map((d) => ({
          dependencyId: d.id,
          task: d.blockingTask,
        })),
        blocking: blocking.map((d) => ({
          dependencyId: d.id,
          task: d.blockedTask,
        })),
      },
    };
  },

  async createDependency(
    task: { id: string; organizationId: string },
    depTask: { id: string; title: string },
    validatedData: { dependencyTaskId: string; direction: "blocks" | "blocked_by" },
    userId: string
  ) {
    const blockingTaskId = validatedData.direction === "blocks" ? task.id : depTask.id;
    const blockedTaskId = validatedData.direction === "blocks" ? depTask.id : task.id;

    // Check for circular dependency
    const circular = await dependencyRepository.findDependencyPair(blockedTaskId, blockingTaskId);
    if (circular) {
      throw new BadRequestException("Circular dependency detected!");
    }

    // Check for duplicate
    const existing = await dependencyRepository.findDependencyPair(blockingTaskId, blockedTaskId);
    if (existing) {
      throw new BadRequestException("This dependency already exists");
    }

    const dependency = await dependencyRepository.createDependency(blockingTaskId, blockedTaskId);

    await dependencyRepository.createTaskActivity({
      taskId: task.id,
      userId,
      organizationId: task.organizationId,
      action: "dependency_added",
      newValue: `Added dependency: ${validatedData.direction === "blocks" ? "blocks" : "blocked by"} "${depTask.title}"`,
    });

    return dependency;
  },

  async deleteDependency(
    dependency: {
      id: string;
      blockingTaskId: string;
      blockingTask: { organizationId: string };
      blockedTask: { title: string };
    },
    userId: string
  ) {
    await dependencyRepository.deleteDependency(dependency.id);

    await dependencyRepository.createTaskActivity({
      taskId: dependency.blockingTaskId,
      userId,
      organizationId: dependency.blockingTask.organizationId,
      action: "dependency_deleted",
      oldValue: `Removed dependency blocking "${dependency.blockedTask.title}"`,
    });
  },
};
