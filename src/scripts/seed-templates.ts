import "dotenv/config";
import prisma from "../lib/prisma";

const systemTemplates = [
  {
    name: "Software Scrum",
    slug: "software-scrum",
    description:
      "Track software development cycles with sprints, story points, epics, and Scrum metrics.",
    icon: "Layers",
    category: "software",
    isSystem: true,
    config: {
      teamMode: "software",
      taskTypes: ["task", "bug", "feature", "story"],
      statuses: [
        { name: "Backlog", category: "backlog", order: 0 },
        { name: "To Do", category: "todo", order: 1 },
        { name: "In Progress", category: "in_progress", order: 2 },
        { name: "QA", category: "in_progress", order: 3 },
        { name: "Done", category: "done", order: 4 },
      ],
      customFields: [
        { name: "Story Points", type: "number" },
        { name: "Affected Version", type: "text" },
      ],
      sprintEnabled: true,
      epicEnabled: true,
      defaultViews: ["kanban", "backlog", "timeline"],
      guidance: {
        welcome: "Track your software sprints, bugs, and features.",
        firstStep: "Create your first sprint and add tasks to your backlog.",
      },
    },
  },
  {
    name: "Software Kanban",
    slug: "software-kanban",
    description:
      "Manage continuous flow of software delivery using a flexible Kanban board without strict cycles.",
    icon: "Kanban",
    category: "software",
    isSystem: true,
    config: {
      teamMode: "software",
      taskTypes: ["task", "bug", "feature"],
      statuses: [
        { name: "To Do", category: "todo", order: 0 },
        { name: "In Progress", category: "in_progress", order: 1 },
        { name: "In Review", category: "in_progress", order: 2 },
        { name: "Done", category: "done", order: 3 },
      ],
      customFields: [],
      sprintEnabled: false,
      epicEnabled: true,
      defaultViews: ["kanban", "timeline"],
      guidance: {
        welcome: "Manage continuous flow of software delivery without sprints.",
        firstStep: "Add issues to To Do and drag them along columns.",
      },
    },
  },
  {
    name: "HR Onboarding",
    slug: "hr-onboarding",
    description:
      "Perfect for onboarding new hires. Create checklists, assign managers, and schedule start dates.",
    icon: "UserPlus",
    category: "hr",
    isSystem: true,
    config: {
      teamMode: "general",
      taskTypes: ["task"],
      statuses: [
        { name: "Proposed", category: "todo", order: 0 },
        { name: "In Progress", category: "in_progress", order: 1 },
        { name: "Active / Done", category: "done", order: 2 },
      ],
      customFields: [
        { name: "Department", type: "text" },
        { name: "Start Date", type: "date" },
      ],
      sprintEnabled: false,
      epicEnabled: false,
      defaultViews: ["list", "board"],
      guidance: {
        welcome: "Organize tasks for onboarding new employees.",
        firstStep: "Create checklist tasks and assign them to managers.",
      },
    },
  },
  {
    name: "Marketing Campaign",
    slug: "marketing-campaign",
    description:
      "Plan, organize, and execute marketing launch campaigns with channel tracking and visual goal swimlanes.",
    icon: "Megaphone",
    category: "marketing",
    isSystem: true,
    config: {
      teamMode: "general",
      taskTypes: ["task"],
      statuses: [
        { name: "Ideas Pool", category: "backlog", order: 0 },
        { name: "Scheduled", category: "todo", order: 1 },
        { name: "Content Creation", category: "in_progress", order: 2 },
        { name: "Live / Finished", category: "done", order: 3 },
      ],
      customFields: [
        { name: "Target Channel", type: "text" },
        { name: "Budget (Est)", type: "number" },
      ],
      sprintEnabled: false,
      epicEnabled: true,
      defaultViews: ["kanban", "timeline"],
      guidance: {
        welcome:
          "Track launch cycles and collateral for marketing initiatives.",
        firstStep:
          "Create your first campaign goal/epic and list media activities.",
      },
    },
  },
  {
    name: "Finance Tracker",
    slug: "finance-tracker",
    description:
      "Track payments, bookkeeping checklists, auditing records, and corporate invoice approval queues.",
    icon: "DollarSign",
    category: "finance",
    isSystem: true,
    config: {
      teamMode: "general",
      taskTypes: ["task"],
      statuses: [
        { name: "To Do", category: "todo", order: 0 },
        { name: "Awaiting Approval", category: "in_progress", order: 1 },
        { name: "Completed", category: "done", order: 2 },
      ],
      customFields: [
        { name: "Invoice Amount", type: "number" },
        {
          name: "Approval Status",
          type: "select",
          options: ["Pending", "Approved", "Rejected"],
        },
      ],
      sprintEnabled: false,
      epicEnabled: false,
      defaultViews: ["list"],
      guidance: {
        welcome: "Track payments, audits, and corporate financial approvals.",
        firstStep: "Add financial compliance items to the list.",
      },
    },
  },
  {
    name: "Product Roadmap",
    slug: "product-roadmap",
    description:
      "Visualize product release tracks, high-level features roadmap, and launch initiatives cross-quarter.",
    icon: "Map",
    category: "general",
    isSystem: true,
    config: {
      teamMode: "hybrid",
      taskTypes: ["feature", "story"],
      statuses: [
        { name: "Ideas", category: "backlog", order: 0 },
        { name: "Planned", category: "todo", order: 1 },
        { name: "In Development", category: "in_progress", order: 2 },
        { name: "Shipped", category: "done", order: 3 },
      ],
      customFields: [{ name: "Impact Metric", type: "text" }],
      sprintEnabled: false,
      epicEnabled: true,
      defaultViews: ["timeline", "kanban"],
      guidance: {
        welcome: "Organize high-level goals and product milestones.",
        firstStep: "Create main product initiatives in epics tab.",
      },
    },
  },
  {
    name: "General Project",
    slug: "general-project",
    description:
      "A clean, simple task tracker for managing day-to-day operations and items without complex tech jargon.",
    icon: "ClipboardList",
    category: "general",
    isSystem: true,
    config: {
      teamMode: "general",
      taskTypes: ["task"],
      statuses: [
        { name: "Inbox", category: "backlog", order: 0 },
        { name: "To Do", category: "todo", order: 1 },
        { name: "Doing", category: "in_progress", order: 2 },
        { name: "Done", category: "done", order: 3 },
      ],
      customFields: [],
      sprintEnabled: false,
      epicEnabled: false,
      defaultViews: ["list", "kanban"],
      guidance: {
        welcome: "Simple task management for any business workflow.",
        firstStep: "Add your first to-do item.",
      },
    },
  },
];

async function main() {
  console.log("Seeding project templates...");
  for (const t of systemTemplates) {
    await prisma.projectTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        icon: t.icon,
        category: t.category,
        config: t.config,
      },
      create: {
        name: t.name,
        slug: t.slug,
        description: t.description,
        icon: t.icon,
        category: t.category,
        config: t.config,
      },
    });
  }

  console.log("Seeding HR Onboarding Checklist templates...");
  const workspaces = await prisma.workspace.findMany();
  for (const ws of workspaces) {
    const existing = await prisma.checklistTemplate.findFirst({
      where: { workspaceId: ws.id, name: "HR Onboarding Checklist" },
    });
    if (!existing) {
      await prisma.checklistTemplate.create({
        data: {
          name: "HR Onboarding Checklist",
          description: "Standard checklist items for onboarding a new hire.",
          items: [
            "Sign employment contract",
            "Submit background check forms",
            "Setup payroll and direct deposit",
            "Issue laptop and work equipment",
            "Configure company email and Slack accounts",
            "Schedule first-day meeting with team manager",
            "Complete employee handbook review",
          ],
          workspaceId: ws.id,
          organizationId: ws.organizationId,
        },
      });
    }
  }

  console.log("Seeding templates completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
