import { asyncHandler } from "@/app/http/middlewares/async-handler.middleware";
import prisma from "@/lib/prisma";
import { ok } from "@/utils/http-response";
import type { Request, Response } from "express";
import { auth } from "@/lib/auth/auth";
import { betterAuthHeaders } from "@/lib/auth/node-headers";
import { z } from "zod";

async function verifyOrgAdmin(req: Request) {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    throw new Error("No active organization found");
  }

  const callerMember = await prisma.member.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: session.user.id,
      role: { in: ["owner", "admin"] },
    },
  });

  if (!callerMember) {
    throw new Error("Forbidden: You must be an organization admin");
  }

  return { activeOrgId, userId: session.user.id };
}

async function verifyWorkspaceAdmin(req: Request, workspaceId: string) {
  const session = await auth.api.getSession({
    headers: betterAuthHeaders(req),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    throw new Error("No active organization found");
  }

  // Check Org Admin
  const callerOrgMember = await prisma.member.findFirst({
    where: {
      organizationId: activeOrgId,
      userId: session.user.id,
      role: { in: ["owner", "admin"] },
    },
  });

  if (callerOrgMember) {
    return { activeOrgId, userId: session.user.id };
  }

  // Check Workspace Admin
  const callerWorkspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
      role: "admin",
      workspace: { organizationId: activeOrgId },
    },
  });

  if (!callerWorkspaceMember) {
    throw new Error("Forbidden: You must be an organization or workspace admin");
  }

  return { activeOrgId, userId: session.user.id };
}

const workspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters long"),
  slug: z.string().min(2, "Slug must be at least 2 characters long").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
});

export const workspaceController = {
  getWorkspaces: asyncHandler(async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
      headers: betterAuthHeaders(req),
    });

    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
      return res.status(400).json({ message: "No active organization found" });
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        organizationId: activeOrgId,
        // Only return workspaces the user is a member of, or if they are org owner/admin
        OR: [
          {
            members: {
              some: {
                userId: session.user.id,
              },
            },
          },
          {
            organization: {
              members: {
                some: {
                  userId: session.user.id,
                  role: { in: ["owner", "admin"] },
                },
              },
            },
          },
        ],
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(res, "Workspaces fetched", workspaces);
  }),

  createWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const { activeOrgId, userId } = await verifyOrgAdmin(req);
    const validatedData = workspaceSchema.parse(req.body);

    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingWorkspace) {
      return res.status(400).json({ message: "Workspace slug already exists" });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        organizationId: activeOrgId,
        members: {
          create: {
            userId: userId,
            role: "admin",
          },
        },
      },
    });

    return ok(res, "Workspace created successfully", workspace);
  }),

  updateWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId } = await verifyWorkspaceAdmin(req, id);
    const validatedData = workspaceSchema.partial().parse(req.body);

    const workspace = await prisma.workspace.findFirst({
      where: { id, organizationId: activeOrgId },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (validatedData.slug) {
      const existingWorkspace = await prisma.workspace.findFirst({
        where: { slug: validatedData.slug, id: { not: id } },
      });
      if (existingWorkspace) {
        return res.status(400).json({ message: "Workspace slug already exists" });
      }
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id },
      data: validatedData,
    });

    return ok(res, "Workspace updated successfully", updatedWorkspace);
  }),

  deleteWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { activeOrgId } = await verifyWorkspaceAdmin(req, id);

    const workspace = await prisma.workspace.findFirst({
      where: { id, organizationId: activeOrgId },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    await prisma.workspace.delete({
      where: { id },
    });

    return ok(res, "Workspace deleted successfully");
  }),

  getWorkspaceMembers: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const { activeOrgId } = await verifyWorkspaceAdmin(req, workspaceId);

    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        workspace: { organizationId: activeOrgId },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return ok(res, "Workspace members fetched", members);
  }),

  addWorkspaceMembers: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const { activeOrgId } = await verifyWorkspaceAdmin(req, workspaceId);
    const { userIds } = req.body; // Array of user IDs to add

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "User IDs are required" });
    }

    // Verify all users are part of the organization
    const orgMembers = await prisma.member.findMany({
      where: {
        organizationId: activeOrgId,
        userId: { in: userIds },
      },
    });

    if (orgMembers.length !== userIds.length) {
      return res.status(400).json({ message: "One or more users are not members of this organization" });
    }

    // Add users to workspace
    const workspaceMembers = await Promise.all(
      userIds.map((userId) =>
        prisma.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId, userId } },
          update: {},
          create: { workspaceId, userId, role: "member" },
        })
      )
    );

    return ok(res, "Members added to workspace", workspaceMembers);
  }),

  removeWorkspaceMember: asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.params.id as string;
    const userId = req.params.userId as string;
    const { activeOrgId } = await verifyWorkspaceAdmin(req, workspaceId);

    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    return ok(res, "Member removed from workspace");
  }),
};
