import "dotenv/config";
import prisma from "../lib/prisma";
import { DEFAULT_ROLES } from "../app/repositories/rbac.repository";

const WELCOME_CONTENT = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Welcome to Veylo Docs! 👋" }]
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "This is your project's collaborative document workspace. Here, you can create, edit, organize, and discuss documents in real time with your team."
        }
      ]
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Features at a Glance" }]
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "⚡ " },
                { type: "text", attrs: { bold: true }, text: "Real-time Editing:" },
                { type: "text", text: " See cursors, selections, and typing in real time." }
              ]
            }
          ]
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "📁 " },
                { type: "text", attrs: { bold: true }, text: "Nested Documents:" },
                { type: "text", text: " Organize documents in a tree-like hierarchy by dragging and dropping." }
              ]
            }
          ]
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "💬 " },
                { type: "text", attrs: { bold: true }, text: "Inline Comments:" },
                { type: "text", text: " Highlight text to add comments, reply, and resolve discussions." }
              ]
            }
          ]
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "🕒 " },
                { type: "text", attrs: { bold: true }, text: "Version History:" },
                { type: "text", text: " Automatically save history, compare versions, and restore previous states." }
              ]
            }
          ]
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Feel free to delete or edit this page as you begin setting up your team's workspace!"
        }
      ]
    }
  ]
};

async function main() {
  console.log("Starting docs database seed...");

  // 1. Seed Permission Mappings for existing organization roles
  console.log("Seeding permission mappings to organization roles...");
  const orgs = await prisma.organization.findMany();
  for (const org of orgs) {
    for (const roleDef of DEFAULT_ROLES) {
      // Find or create role for this organization
      const role = await prisma.role.upsert({
        where: {
          organizationId_name: {
            organizationId: org.id,
            name: roleDef.name,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          name: roleDef.name,
          isSystemDefault: true,
        },
      });

      const perms = await prisma.permission.findMany({
        where: {
          OR: roleDef.permissions.map((p: string) => {
            const [resource, action] = p.split(":");
            return { resource, action };
          }),
        },
      });

      for (const p of perms) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: p.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: p.id,
          },
        });
      }
    }
  }
  console.log(`Mapped permissions for ${orgs.length} organizations.`);

  // 2. Seed Welcome docs and Root Folders for all projects
  console.log("Seeding root Docs folders and welcome documents for all projects...");
  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      members: true,
    },
  });

  const defaultUser = await prisma.user.findFirst();
  if (!defaultUser) {
    console.warn("No user found in the database. Skipping welcome doc seeding. Please seed users first.");
    return;
  }

  let createdCount = 0;
  for (const project of projects) {
    const creatorId = project.ownerId || project.members[0]?.userId || defaultUser.id;

    // Check if root doc already exists
    const existingRoot = await prisma.projectDoc.findFirst({
      where: {
        projectId: project.id,
        parentId: null,
        slug: "documents",
      },
    });

    let rootId = existingRoot?.id;

    if (!existingRoot) {
      const rootDoc = await prisma.projectDoc.create({
        data: {
          projectId: project.id,
          organizationId: project.organizationId,
          title: "Documents",
          slug: "documents",
          emoji: "📁",
          order: 0,
          createdBy: creatorId,
          updatedBy: creatorId,
        },
      });
      rootId = rootDoc.id;
      createdCount++;
    }

    // Check if welcome doc exists under this root
    const existingWelcome = await prisma.projectDoc.findFirst({
      where: {
        projectId: project.id,
        parentId: rootId,
        slug: "welcome-to-docs",
      },
    });

    if (!existingWelcome && rootId) {
      await prisma.projectDoc.create({
        data: {
          projectId: project.id,
          organizationId: project.organizationId,
          parentId: rootId,
          title: "Welcome to Docs",
          slug: "welcome-to-docs",
          emoji: "👋",
          content: WELCOME_CONTENT as unknown as Record<string, unknown>,
          plainText: "Welcome to Veylo Docs! This is your project's collaborative document workspace.",
          order: 0,
          createdBy: creatorId,
          updatedBy: creatorId,
        },
      });
    }
  }

  console.log(`Successfully initialized docs for ${projects.length} projects (created ${createdCount} root folders).`);
  console.log("Docs database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Docs seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
