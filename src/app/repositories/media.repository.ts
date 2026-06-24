import prisma from "@/lib/prisma";

export const mediaRepository = {
  async updateUserAvatar(userId: string, url: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { image: url },
    });
  },

  async findOrgMember(organizationId: string, userId: string) {
    return prisma.member.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ["owner", "admin"] },
      },
    });
  },

  async findWorkspaceMember(workspaceId: string, userId: string, activeOrgId: string) {
    return prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        role: "admin",
        workspace: { organizationId: activeOrgId },
      },
    });
  },

  async findProjectById(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
    });
  },

  async updateWorkspaceIcon(workspaceId: string, url: string) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data: { icon: url },
    });
  },

  async updateProjectIcon(projectId: string, url: string) {
    return prisma.project.update({
      where: { id: projectId },
      data: { icon: url },
    });
  },
};
