import prisma from "@/lib/prisma";

export const orgRepository = {
  findOwnerMember(userId: string) {
    return prisma.member.findFirst({
      where: {
        userId,
        role: "owner",
      },
    });
  },

  findOrgBySlug(slug: string) {
    return prisma.organization.findUnique({
      where: { slug },
    });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  findSessionById(id: string) {
    return prisma.session.findUnique({
      where: { id },
    });
  },

  updateOrgLogo(orgId: string, logoUrl: string) {
    return prisma.organization.update({
      where: { id: orgId },
      data: { logo: logoUrl },
    });
  },

  createOrganizationWithOwnerAndWorkspace(data: {
    name: string;
    slug: string;
    workspaceName: string;
    userId: string;
    sessionId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          logo: null,
        },
      });

      await tx.member.create({
        data: {
          organizationId: org.id,
          userId: data.userId,
          role: "owner",
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: data.workspaceName,
          slug: data.workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
          organizationId: org.id,
        },
      });

      await tx.session.update({
        where: { id: data.sessionId },
        data: { activeOrganizationId: org.id }
      });

      return { org, workspace };
    });
  },
};
