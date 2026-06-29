import "dotenv/config";
import readline from "readline";

import { faker } from "@faker-js/faker";
import { hashPassword } from "better-auth/crypto";

import prisma from "../lib/prisma";

const PASSWORD = "123456789012";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  console.log("=== Veylo Test Data Seeder ===");

  // 1. Resolve Organization1
  let orgId = "";
  let orgSlug = "";
  let orgName = "";

  const userInput = (
    await askQuestion(
      "Enter Organization ID or Slug (leave blank to select first found or create a new one): ",
    )
  ).trim();

  if (userInput) {
    const foundOrg = await prisma.organization.findFirst({
      where: {
        OR: [{ id: userInput }, { slug: userInput }],
      },
    });

    if (foundOrg) {
      orgId = foundOrg.id;
      orgSlug = foundOrg.slug || "";
      orgName = foundOrg.name;
      console.log(
        `Found existing organization: ${orgName} (ID: ${orgId}, Slug: ${orgSlug})`,
      );
    } else {
      console.log(
        `Organization not found with ID/Slug: "${userInput}". Creating a new one...`,
      );
    }
  }

  if (!orgId) {
    // Look for first existing org if input was blank
    const firstOrg = await prisma.organization.findFirst();
    if (firstOrg) {
      orgId = firstOrg.id;
      orgSlug = firstOrg.slug || "";
      orgName = firstOrg.name;
      console.log(
        `Using existing organization: ${orgName} (ID: ${orgId}, Slug: ${orgSlug})`,
      );
    } else {
      // Create a brand new organization
      orgName = faker.company.name() + " Test";
      orgSlug = faker.helpers.slugify(orgName.toLowerCase());
      const newOrg = await prisma.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
        },
      });
      orgId = newOrg.id;
      console.log(
        `Created new organization: ${orgName} (ID: ${orgId}, Slug: ${orgSlug})`,
      );
    }
  }

  // 2. Hash Password
  console.log("Hashing password for users...");
  const hashedPassword = await hashPassword(PASSWORD);

  // 3. Create Org Members
  console.log("Creating organization members...");
  const users = [];
  const memberRoles = [
    "admin",
    "member",
    "member",
    "member",
    "member",
    "member",
    "member",
    "member",
    "member",
    "member",
  ];

  for (let i = 0; i < 10; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();

    // Create User
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        name,
        email,
        emailVerified: true,
        role: "user",
        accounts: {
          create: {
            providerId: "credential",
            accountId: email,
            password: hashedPassword,
          },
        },
      },
    });

    // Create Org Member
    await prisma.member.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        role: memberRoles[i],
      },
    });

    users.push(user);
  }
  console.log(
    `Created ${users.length} test users as org members with password: "${PASSWORD}"`,
  );

  // 4. Create Custom Roles and Permissions
  console.log("Seeding custom roles and permissions for organization...");
  const permissions = await prisma.permission.findMany();

  if (permissions.length === 0) {
    console.log(
      "Warning: No master permissions found in the database. Please run npm run seed:permissions first.",
    );
  }

  const roleNames = [
    "Product Owner",
    "Senior Developer",
    "QA Engineer",
    "Project Lead",
  ];
  const seededRoles = [];
  for (const roleName of roleNames) {
    // Upsert Role
    const role = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId: orgId,
          name: roleName,
        },
      },
      update: {},
      create: {
        organizationId: orgId,
        name: roleName,
        isSystemDefault: false,
      },
    });

    // Assign a subset of permissions
    const count = faker.number.int({ min: 5, max: permissions.length });
    const selectedPerms = faker.helpers.arrayElements(permissions, count);

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    if (selectedPerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: selectedPerms.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }

    // Assign the role to a couple of random users
    const randomUsers = faker.helpers.arrayElements(users, 2);
    for (const u of randomUsers) {
      await prisma.userRoleAssignment.upsert({
        where: {
          userId_roleId_scopeType_scopeId: {
            userId: u.id,
            roleId: role.id,
            scopeType: "ORGANIZATION",
            scopeId: orgId,
          },
        },
        update: {},
        create: {
          userId: u.id,
          roleId: role.id,
          scopeType: "ORGANIZATION",
          scopeId: orgId,
        },
      });
    }

    seededRoles.push(role);
  }
  console.log(
    `Seeded ${seededRoles.length} custom organization roles and assignments.`,
  );

  // 5. Setup Workspace
  let workspace = await prisma.workspace.findFirst({
    where: { organizationId: orgId },
  });

  if (!workspace) {
    const wsName = `${orgName} Workspace`;
    workspace = await prisma.workspace.create({
      data: {
        name: wsName,
        slug:
          faker.helpers.slugify(wsName.toLowerCase()) +
          "-" +
          faker.number.int({ min: 100, max: 999 }),
        organizationId: orgId,
      },
    });
    console.log(`Created new Workspace: ${workspace.name}`);
  } else {
    console.log(`Using existing Workspace: ${workspace.name}`);
  }

  // Add all users to the workspace
  for (const u of users) {
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: u.id,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        userId: u.id,
        role: "member",
      },
    });
  }

  // 6. Create Projects
  console.log("Creating projects...");
  const projectTemplates = ["scrum", "kanban", "simple"];
  const projectKeys = [
    "WEB" + faker.number.int({ min: 10, max: 99 }),
    "API" + faker.number.int({ min: 10, max: 99 }),
    "OPS" + faker.number.int({ min: 10, max: 99 }),
  ];
  const projectTitles = [
    "Web Application v2",
    "Core Services API",
    "Business Operations Dashboard",
  ];
  const projects = [];

  for (let i = 0; i < projectKeys.length; i++) {
    const projKey = projectKeys[i];
    const projTitle = projectTitles[i];

    const proj = await prisma.project.create({
      data: {
        projectKey: projKey,
        title: projTitle,
        description:
          faker.company.catchPhrase() + ". " + faker.lorem.paragraph(2),
        template: projectTemplates[i],
        workspaceId: workspace.id,
        organizationId: orgId,
      },
    });

    // Add users as Project Members
    for (const u of users) {
      await prisma.projectMember.create({
        data: {
          projectId: proj.id,
          userId: u.id,
          role: faker.helpers.arrayElement(["member", "member", "admin"]),
        },
      });
    }

    projects.push(proj);
  }
  console.log(
    `Created ${projects.length} projects: ${projects.map((p) => p.projectKey).join(", ")}`,
  );

  // 7. Seed project metadata per project (statuses, epics, sprints, milestones, labels)
  const allProjectStatuses: Record<string, { id: string }[]> = {};
  const allProjectEpics: Record<string, { id: string }[]> = {};
  const allProjectSprints: Record<string, { id: string }[]> = {};
  const allProjectMilestones: Record<string, { id: string }[]> = {};
  const allProjectLabels: Record<string, { id: string }[]> = {};

  for (const proj of projects) {
    // A. Task Statuses
    const statusesData = [
      { name: "Backlog", category: "backlog", order: 0 },
      { name: "To Do", category: "todo", order: 1 },
      { name: "In Progress", category: "in_progress", order: 2 },
      { name: "In Review", category: "in_progress", order: 3 },
      { name: "Done", category: "done", order: 4 },
    ];

    const statuses = [];
    for (const stat of statusesData) {
      const createdStatus = await prisma.taskStatus.create({
        data: {
          projectId: proj.id,
          organizationId: orgId,
          name: stat.name,
          category: stat.category,
          order: stat.order,
        },
      });
      statuses.push(createdStatus);
    }
    allProjectStatuses[proj.id] = statuses;

    // B. Epics
    const epicsData = [
      "Authentication & Security",
      "Billing & Subscriptions",
      "Analytics Dashboard",
      "Mobile Responsive UI",
    ];
    const epics = [];
    for (const epicName of epicsData) {
      const epic = await prisma.epic.create({
        data: {
          projectId: proj.id,
          organizationId: orgId,
          title: epicName,
          description: faker.lorem.sentence(),
          color: faker.helpers.arrayElement([
            "#6366f1",
            "#10b981",
            "#f59e0b",
            "#3b82f6",
            "#ef4444",
            "#8b5cf6",
          ]),
          status: faker.helpers.arrayElement(["open", "in_progress", "done"]),
        },
      });
      epics.push(epic);
    }
    allProjectEpics[proj.id] = epics;

    // C. Sprints
    const sprints = [];
    if (proj.template === "scrum") {
      const sprint1 = await prisma.sprint.create({
        data: {
          projectId: proj.id,
          organizationId: orgId,
          name: "Sprint 1 - Foundations",
          goal: "Build core architectural pillars and authentication",
          status: "completed",
          startDate: faker.date.past({ years: 0.1 }),
          endDate: faker.date.past({ years: 0.05 }),
          completedAt: faker.date.past({ years: 0.05 }),
        },
      });
      const sprint2 = await prisma.sprint.create({
        data: {
          projectId: proj.id,
          organizationId: orgId,
          name: "Sprint 2 - Features & API",
          goal: "Develop key user experience workflows and integrations",
          status: "active",
          startDate: faker.date.recent({ days: 3 }),
          endDate: faker.date.soon({ days: 11 }),
        },
      });
      const sprint3 = await prisma.sprint.create({
        data: {
          projectId: proj.id,
          organizationId: orgId,
          name: "Sprint 3 - Polish & Launch",
          goal: "Final optimization, QA audits and release deployment",
          status: "planned",
        },
      });
      sprints.push(sprint1, sprint2, sprint3);
    }
    allProjectSprints[proj.id] = sprints;

    // D. Milestones
    const milestones = [];
    const milestone1 = await prisma.milestone.create({
      data: {
        projectId: proj.id,
        organizationId: orgId,
        title: "Beta Release",
        description: "Deploy basic features to staging environment",
        dueDate: faker.date.soon({ days: 15 }),
        isCompleted: false,
      },
    });
    const milestone2 = await prisma.milestone.create({
      data: {
        projectId: proj.id,
        organizationId: orgId,
        title: "Public Launch v1.0",
        description: "Production launch and marketing press release",
        dueDate: faker.date.soon({ days: 45 }),
        isCompleted: false,
      },
    });
    milestones.push(milestone1, milestone2);
    allProjectMilestones[proj.id] = milestones;

    // E. Labels
    const labelsData = [
      { name: "bug", color: "#ef4444" },
      { name: "feature", color: "#3b82f6" },
      { name: "documentation", color: "#10b981" },
      { name: "refactor", color: "#f59e0b" },
      { name: "critical", color: "#7c3aed" },
    ];
    const labels = [];
    for (const l of labelsData) {
      const createdLabel = await prisma.label.create({
        data: {
          projectId: proj.id,
          organizationId: orgId,
          name: l.name,
          color: l.color,
        },
      });
      labels.push(createdLabel);
    }
    allProjectLabels[proj.id] = labels;
  }

  // 8. Seed 50 Main Tasks
  console.log("Generating 50 main tasks across the projects...");
  const tasks = [];

  for (let i = 1; i <= 50; i++) {
    const randomProject = faker.helpers.arrayElement(projects);
    const projId = randomProject.id;

    const statuses = allProjectStatuses[projId];
    const epics = allProjectEpics[projId];
    const sprints = allProjectSprints[projId];
    const milestones = allProjectMilestones[projId];
    const labels = allProjectLabels[projId];

    const randomStatus = faker.helpers.arrayElement(statuses);
    const randomEpic = faker.helpers.arrayElement(epics);
    const randomSprint =
      sprints.length > 0 ? faker.helpers.arrayElement(sprints) : null;
    const randomMilestone = faker.helpers.arrayElement(milestones);
    const randomCreator = faker.helpers.arrayElement(users);
    const randomAssignee = faker.helpers.arrayElement([null, ...users]);
    const randomReporter = faker.helpers.arrayElement(users);

    const title =
      faker.hacker.verb() +
      " " +
      faker.hacker.adjective() +
      " " +
      faker.hacker.noun();
    const description =
      faker.hacker.phrase() + "\n\n" + faker.lorem.paragraph(1);

    // Get next task sequence for key
    const taskSeq = i; // Let's keep it sequential per loop or project
    const taskKey = `${randomProject.projectKey}-${taskSeq}`;

    const task = await prisma.task.create({
      data: {
        taskKey: taskKey,
        title: title,
        description: description,
        projectId: projId,
        organizationId: orgId,
        statusId: randomStatus.id,
        epicId: randomEpic.id,
        milestoneId: randomMilestone.id,
        sprintId: randomSprint ? randomSprint.id : null,
        type: faker.helpers.arrayElement(["task", "bug", "feature", "story"]),
        priority: faker.helpers.arrayElement([
          "low",
          "medium",
          "high",
          "urgent",
        ]),
        estimate: faker.helpers.arrayElement([1, 2, 3, 5, 8, 13]),
        creatorId: randomCreator.id,
        assigneeId: randomAssignee ? randomAssignee.id : null,
        reporterId: randomReporter.id,
        position: i * 1000,
        dueDate: faker.helpers.arrayElement([
          null,
          faker.date.soon({ days: 30 }),
        ]),
      },
    });

    // Update Project task sequence
    await prisma.project.update({
      where: { id: projId },
      data: { taskSequence: taskSeq + 1 },
    });

    // Add random labels
    const selectedLabels = faker.helpers.arrayElements(
      labels,
      faker.number.int({ min: 0, max: 2 }),
    );
    for (const l of selectedLabels) {
      await prisma.taskLabel.create({
        data: {
          taskId: task.id,
          labelId: l.id,
        },
      });
    }

    // Add some random comments
    if (faker.datatype.boolean(0.5)) {
      const commentCount = faker.number.int({ min: 1, max: 3 });
      for (let c = 0; c < commentCount; c++) {
        const commentUser = faker.helpers.arrayElement(users);
        await prisma.comment.create({
          data: {
            taskId: task.id,
            userId: commentUser.id,
            organizationId: orgId,
            content: faker.helpers.arrayElement([
              "I'm working on this today.",
              "Blocking issue: we need to review requirements.",
              "Looking great! PR is submitted.",
              "Can we double check the credentials?",
              "This should be finished by tomorrow afternoon.",
            ]),
          },
        });
      }
    }

    // Add some WorkLogs
    if (randomAssignee && faker.datatype.boolean(0.4)) {
      await prisma.workLog.create({
        data: {
          taskId: task.id,
          userId: randomAssignee.id,
          hoursLogged: faker.number.float({
            min: 0.5,
            max: 8,
            multipleOf: 0.5,
          }),
          description: faker.helpers.arrayElement([
            "Initial setup & scaffolding",
            "Refactoring controllers",
            "Debugging database connection leak",
            "Writing unit tests",
            "QA validation",
          ]),
        },
      });
    }

    // Add Activity logs
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId: randomCreator.id,
        organizationId: orgId,
        action: "created",
      },
    });

    tasks.push(task);
  }
  console.log(`Seeded 50 main tasks successfully.`);

  // 9. Seed Sub-tasks
  console.log("Generating 15 sub-tasks...");
  for (let s = 1; s <= 15; s++) {
    const parentTask = faker.helpers.arrayElement(tasks);
    const parentKey = parentTask.taskKey.split("-")[0];
    const randomProject =
      projects.find((p) => p.projectKey === parentKey) || projects[0];

    const randomStatus = allProjectStatuses[randomProject.id][1]; // To Do or similar
    const randomCreator = faker.helpers.arrayElement(users);
    const randomAssignee = faker.helpers.arrayElement(users);

    const subTaskSeq = 50 + s;
    const subTaskKey = `${randomProject.projectKey}-${subTaskSeq}`;

    await prisma.task.create({
      data: {
        taskKey: subTaskKey,
        title: "[Subtask] " + faker.hacker.phrase(),
        description: faker.lorem.paragraph(1),
        projectId: randomProject.id,
        organizationId: orgId,
        statusId: randomStatus.id,
        creatorId: randomCreator.id,
        assigneeId: randomAssignee.id,
        parentTaskId: parentTask.id,
        type: "task",
        priority: faker.helpers.arrayElement(["low", "medium", "high"]),
        estimate: faker.helpers.arrayElement([1, 2, 3]),
        position: s * 500,
      },
    });

    // Update Project task sequence
    await prisma.project.update({
      where: { id: randomProject.id },
      data: { taskSequence: subTaskSeq + 1 },
    });
  }
  console.log("Seeded sub-tasks successfully.");

  console.log("\n===========================================");
  console.log("Database seeded successfully with test data!");
  console.log("Created Organization: " + orgName + " (Slug: " + orgSlug + ")");
  console.log("Created Users: " + users.map((u) => u.email).join(", "));
  console.log("All user accounts have password: " + PASSWORD);
  console.log(
    "Created Projects: " +
      projects.map((p) => `${p.title} (${p.projectKey})`).join(", "),
  );
  console.log("Created Tasks: 50 main tasks and 15 sub-tasks");
  console.log("===========================================");

  rl.close();
}

main()
  .catch((e) => {
    console.error("Seeder failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
