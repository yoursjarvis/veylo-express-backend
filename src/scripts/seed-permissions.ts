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
    description: "View workspace details and basic information",
  },
  {
    module: "Workspace",
    resource: "workspace",
    action: "create",
    description: "Create new workspaces within the organization",
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
    description: "Soft delete a workspace",
  },
  {
    module: "Workspace",
    resource: "workspace",
    action: "force-delete",
    description: "Permanently delete a workspace",
  },
  {
    module: "Workspace",
    resource: "workspace",
    action: "invite-members",
    description: "Invite members to the workspace",
  },
  {
    module: "Workspace",
    resource: "workspace",
    action: "remove-members",
    description: "Remove members from the workspace",
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
    description: "Edit project names, descriptions, and icons",
  },
  {
    module: "Projects",
    resource: "project",
    action: "delete",
    description: "Soft delete projects and their associated data",
  },
  {
    module: "Projects",
    resource: "project",
    action: "force-delete",
    description: "Permanently delete projects and their associated data",
  },
  {
    module: "Project Member",
    resource: "project-member",
    action: "read",
    description: "View project member settings",
  },
  {
    module: "Project Member",
    resource: "project-member",
    action: "invite-member",
    description: "Invite members to the project",
  },
  {
    module: "Project Member",
    resource: "project-member",
    action: "remove-member",
    description: "Remove members from the project",
  },
  {
    module: "Project Vault",
    resource: "project-vault",
    action: "read",
    description: "View the project vault",
  },
  {
    module: "Project Vault",
    resource: "project-vault",
    action: "create",
    description: "Add services to the project vault",
  },
  {
    module: "Project Vault",
    resource: "project-vault",
    action: "update",
    description: "Edit services in the project vault",
  },
  {
    module: "Project Vault",
    resource: "project-vault",
    action: "delete",
    description: "Soft delete services from the project vault",
  },
  {
    module: "Project Vault",
    resource: "project-vault",
    action: "force-delete",
    description: "Permanently delete services from the project vault",
  },
  {
    module: "Project Custom Field",
    resource: "project-custom-field",
    action: "read",
    description: "View the custom fields settings page in the project",
  },
  {
    module: "Project Custom Field",
    resource: "project-custom-field",
    action: "create",
    description: "Create new custom fields in the project",
  },
  {
    module: "Project Custom Field",
    resource: "project-custom-field",
    action: "update",
    description: "Update custom fields in the project",
  },
  {
    module: "Project Custom Field",
    resource: "project-custom-field",
    action: "delete",
    description: "Soft delete custom fields from the project",
  },
  {
    module: "Project Custom Field",
    resource: "project-custom-field",
    action: "force-delete",
    description: "Permanently delete custom fields from the project",
  },
  {
    module: "Project Status",
    resource: "project-status",
    action: "read",
    description: "View the status settings page in the project",
  },
  {
    module: "Project Status",
    resource: "project-status",
    action: "create",
    description: "Create new statuses in the project",
  },
  {
    module: "Project Status",
    resource: "project-status",
    action: "update",
    description: "Edit statuses in the project",
  },
  {
    module: "Project Status",
    resource: "project-status",
    action: "delete",
    description: "Soft delete statuses from the project",
  },
  {
    module: "Project Status",
    resource: "project-status",
    action: "force-delete",
    description: "Permanently delete statuses from the project",
  },
  {
    module: "Project Label",
    resource: "project-label",
    action: "read",
    description: "View the label settings page in the project",
  },
  {
    module: "Project Label",
    resource: "project-label",
    action: "update",
    description: "Edit labels in the project",
  },
  {
    module: "Project Label",
    resource: "project-label",
    action: "create",
    description: "Create new labels in the project",
  },
  {
    module: "Project Label",
    resource: "project-label",
    action: "delete",
    description: "Soft delete labels from the project",
  },
  {
    module: "Project Label",
    resource: "project-label",
    action: "force-delete",
    description: "Permanently delete labels from the project",
  },
  {
    module: "Project Webhook",
    resource: "project-webhook",
    action: "read",
    description: "View the webhook configuration settings page in the project",
  },
  {
    module: "Project Webhook",
    resource: "project-webhook",
    action: "create",
    description: "Create new webhook configurations in the project",
  },
  {
    module: "Project Webhook",
    resource: "project-webhook",
    action: "update",
    description: "Edit webhook configurations in the project",
  },
  {
    module: "Project Webhook",
    resource: "project-webhook",
    action: "delete",
    description: "Soft delete webhook configurations from the project",
  },
  {
    module: "Project Webhook",
    resource: "project-webhook",
    action: "force-delete",
    description: "Permanently delete webhook configurations from the project",
  },
  {
    module: "Project Automation",
    resource: "project-automation",
    action: "read",
    description: "View the automation rules page in the project",
  },
  {
    module: "Project Automation",
    resource: "project-automation",
    action: "create",
    description: "Create new automation rules in the project",
  },
  {
    module: "Project Automation",
    resource: "project-automation",
    action: "update",
    description: "Edit automation rules in the project",
  },
  {
    module: "Project Automation",
    resource: "project-automation",
    action: "delete",
    description: "Soft delete automation rules from the project",
  },
  {
    module: "Project Automation",
    resource: "project-automation",
    action: "force-delete",
    description: "Permanently delete automation rules from the project",
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
    description: "Soft delete tasks from the project",
  },
  {
    module: "Tasks",
    resource: "task",
    action: "force-delete",
    description: "Permanently delete tasks from the project",
  },
  {
    module: "Tasks",
    resource: "task",
    action: "comment",
    description: "Add and edit task comments",
  },

  // Member Module
  {
    module: "Members",
    resource: "member",
    action: "read",
    description: "View the list of organization members",
  },
  {
    module: "Members",
    resource: "member",
    action: "invite",
    description: "Invite new members to the organization",
  },
  {
    module: "Members",
    resource: "member",
    action: "update",
    description: "Manage member roles and profile details",
  },
  {
    module: "Members",
    resource: "member",
    action: "ban",
    description: "Restrict a member's access to the organization",
  },
  {
    module: "Members",
    resource: "member",
    action: "un-ban",
    description: "Un ban a member's access to the organization",
  },
  {
    module: "Members",
    resource: "member",
    action: "change-password",
    description: "Change a member's password",
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

  console.log(
    `Successfully processed ${masterPermissions.length} permissions.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
