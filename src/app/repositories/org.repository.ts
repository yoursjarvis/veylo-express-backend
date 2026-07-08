import prisma from "@/lib/prisma";

import { rbacRepository } from "./rbac.repository";

export const orgRepository = {
  async findOwnerMember(userId: string) {
    // Find if the user has an owner role assignment
    return prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        scopeType: "ORGANIZATION",
        role: {
          name: "owner",
        },
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
          ownerId: data.userId,
        },
      });

      await tx.member.create({
        data: {
          organizationId: org.id,
          userId: data.userId,
        },
      });

      await rbacRepository.seedOrgDefaultRoles(tx, org.id);
      
      const ownerRole = await tx.role.findFirst({
        where: { organizationId: org.id, name: "owner" }
      });
      
      if (ownerRole) {
        await tx.userRoleAssignment.create({
          data: {
            userId: data.userId,
            roleId: ownerRole.id,
            scopeType: "ORGANIZATION",
            scopeId: org.id
          }
        });
      }

      const workspace = await tx.workspace.create({
        data: {
          name: data.workspaceName,
          slug: data.workspaceName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, ""),
          organizationId: org.id,
        },
      });

      await tx.session.update({
        where: { id: data.sessionId },
        data: { activeOrganizationId: org.id },
      });

      return { org, workspace };
    });
  },
};
