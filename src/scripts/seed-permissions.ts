import "dotenv/config";
import prisma from "../lib/prisma";

interface PermissionSeed {
  module: string;
  resource: string;
  action: string;
  description: string;
}

const masterPermissions: PermissionSeed[] = [
  // Workspace Module
  {
    module: "Workspace",
    resource: "workspace",
    action: "read",
    description: "View workspace details and basic info",
  },
  {
    module: "Workspace",
    resource: "workspace",
    action: "update",
    description: "Update workspace settings and profile",
  },
  {
    module: "Workspace",
    resource: "workspace",
    action: "delete",
    description: "Permanently delete the workspace",
  },

  // Projects Module
  {
    module: "Projects",
    resource: "project",
    action: "read",
    description: "View projects and their metadata",
  },
  {
    module: "Projects",
    resource: "project",
    action: "create",
    description: "Create new projects within the organization",
  },
  {
    module: "Projects",
    resource: "project",
    action: "update",
    description: "Edit project names, descriptions and settings",
  },
  {
    module: "Projects",
    resource: "project",
    action: "delete",
    description: "Delete projects and all associated data",
  },

  // Task Module
  {
    module: "Tasks",
    resource: "task",
    action: "read",
    description: "View tasks and their details",
  },
  {
    module: "Tasks",
    resource: "task",
    action: "create",
    description: "Create new tasks",
  },
  {
    module: "Tasks",
    resource: "task",
    action: "update",
    description: "Edit task content and properties",
  },
  {
    module: "Tasks",
    resource: "task",
    action: "delete",
    description: "Remove tasks from the project",
  },
  {
    module: "Tasks",
    resource: "task",
    action: "comment",
    description: "Add and edit comments on tasks",
  },

  // Member Module
  {
    module: "Members",
    resource: "member",
    action: "read",
    description: "View list of organization members",
  },
  {
    module: "Members",
    resource: "member",
    action: "invite",
    description: "Send invitations to new members",
  },
  {
    module: "Members",
    resource: "member",
    action: "update",
    description: "Manage member roles and details",
  },
  {
    module: "Members",
    resource: "member",
    action: "ban",
    description: "Restrict member access to the organization",
  },
];

async function main() {
  console.log("Seeding master permissions...");
  
  for (const p of masterPermissions) {
    // Find if the permission already exists based on unique attributes
    const existing = await prisma.permission.findFirst({
      where: {
        module: p.module,
        resource: p.resource,
        action: p.action,
      },
    });

    if (existing) {
      // Update existing record
      await prisma.permission.update({
        where: { id: existing.id },
        data: {
          description: p.description,
        },
      });
    } else {
      // Create new record (let DB generate UUID)
      await prisma.permission.create({
        data: {
          module: p.module,
          resource: p.resource,
          action: p.action,
          description: p.description,
        },
      });
    }
  }
  
  console.log(`Successfully processed ${masterPermissions.length} permissions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
