import { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { getRequestContext } from "../request-context.js";

const modelMapping: Record<string, { entityType: string; label: string }> = {
  Task: { entityType: "TASK", label: "task" },
  Sprint: { entityType: "SPRINT", label: "sprint" },
  Epic: { entityType: "EPIC", label: "epic" },
  Label: { entityType: "LABEL", label: "label" },
  Comment: { entityType: "COMMENT", label: "comment" },
  CustomFieldDefinition: { entityType: "CUSTOM_FIELD", label: "custom field" },
  TaskStatus: { entityType: "TASK_STATUS", label: "status" },
  AutomationRule: { entityType: "AUTOMATION", label: "automation" },
  Vault: { entityType: "VAULT", label: "vault" },
  VaultService: { entityType: "VAULT_SERVICE", label: "vault service" },
  VaultItem: { entityType: "VAULT_ITEM", label: "vault item" },
  Invitation: { entityType: "INVITATION", label: "invitation" },
  Workspace: { entityType: "WORKSPACE", label: "workspace" },
  Session: { entityType: "SESSION", label: "session" },
};

const mutationOperations = [
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
];

export const auditLogExtension = Prisma.defineExtension((client) => {
  const prismaClient = client as unknown as PrismaClient;

  return client.$extends({
    name: "auditLog",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // 1. Skip if model is not tracked, or is AuditLog itself (avoid recursion), or is a read operation
          if (
            model === "AuditLog" ||
            !modelMapping[model] ||
            !mutationOperations.includes(operation)
          ) {
            return query(args);
          }

          // 2. Execute the primary query first
          const result = await query(args);

          // 3. Log in background (asynchronously and non-blocking)
          setImmediate(async () => {
            try {
              const context = getRequestContext();
              const userId = context?.userId;
              if (!userId) return; // Skip if no user is performing the action (e.g. system seeds)

              // Resolve workspaceId & organizationId
              const resolvedContext = await resolveContext(prismaClient, model, result, args, context.activeOrganizationId);
              if (!resolvedContext) return;

              const { workspaceId, organizationId } = resolvedContext;

              // Fetch User details for user name
              const userRecord = await prismaClient.user.findUnique({
                where: { id: userId },
                select: { name: true },
              });
              const userName = userRecord?.name || context.userEmail || "System";

              const resObj = result as Record<string, unknown> | null;
              const argsObj = args as Record<string, unknown> | null;

              // Get action name and description
              const actionDetails = getActionDetails(model, operation, resObj, argsObj, userName);

              await prismaClient.auditLog.create({
                data: {
                  workspaceId: workspaceId || null,
                  organizationId,
                  userId,
                  action: actionDetails.action,
                  entityType: actionDetails.entityType,
                  entityId: (resObj?.id as string) || ((argsObj?.where as Record<string, unknown> | undefined)?.id as string) || null,
                  entityName: (resObj?.name as string) || (resObj?.title as string) || (resObj?.taskKey as string) || null,
                  description: actionDetails.description,
                  metadata: {
                    operation,
                    args: sanitizeArgs(args) as Prisma.InputJsonValue,
                  },
                  ipAddress: context.ipAddress || null,
                  userAgent: context.userAgent || null,
                },
              });
            } catch (error) {
              console.error("[AUTO AUDIT LOG ERROR] Failed to write audit log in background:", error);
            }
          });

          return result;
        },
      },
    },
  });
});

/**
 * Traverses relations to find workspaceId and organizationId.
 */
async function resolveContext(
  prismaClient: PrismaClient,
  model: string,
  result: unknown,
  args: unknown,
  fallbackOrgId?: string,
): Promise<{ workspaceId?: string; organizationId: string } | null> {
  const resObj = result as Record<string, unknown> | null;
  const argsObj = args as Record<string, unknown> | null;
  const argsData = argsObj?.data as Record<string, unknown> | undefined;

  let organizationId = (resObj?.organizationId as string) || (argsData?.organizationId as string) || fallbackOrgId;
  let workspaceId = (resObj?.workspaceId as string) || (argsData?.workspaceId as string);

  // Traverse Project relation
  const projectId = (resObj?.projectId as string) || (argsData?.projectId as string) || ((argsObj?.where as Record<string, unknown> | undefined)?.projectId as string);
  if (projectId && (!workspaceId || !organizationId)) {
    const project = await prismaClient.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true, organizationId: true },
    });
    if (project) {
      if (!workspaceId) workspaceId = project.workspaceId;
      if (!organizationId) organizationId = project.organizationId;
    }
  }

  // Traverse Task relation
  const taskId = (resObj?.taskId as string) || (argsData?.taskId as string) || ((argsObj?.where as Record<string, unknown> | undefined)?.taskId as string);
  if (taskId && (!workspaceId || !organizationId)) {
    const task = await prismaClient.task.findUnique({
      where: { id: taskId },
      select: { projectId: true, organizationId: true },
    });
    if (task) {
      if (!organizationId) organizationId = task.organizationId;
      const project = await prismaClient.project.findUnique({
        where: { id: task.projectId },
        select: { workspaceId: true },
      });
      if (project && !workspaceId) workspaceId = project.workspaceId;
    }
  }

  // Traverse Vault relation
  const vaultId = (resObj?.vaultId as string) || (argsData?.vaultId as string) || ((argsObj?.where as Record<string, unknown> | undefined)?.vaultId as string);
  if (vaultId && (!workspaceId || !organizationId)) {
    const vault = await prismaClient.vault.findUnique({
      where: { id: vaultId },
      select: { projectId: true },
    });
    if (vault) {
      const project = await prismaClient.project.findUnique({
        where: { id: vault.projectId },
        select: { workspaceId: true, organizationId: true },
      });
      if (project) {
        if (!workspaceId) workspaceId = project.workspaceId;
        if (!organizationId) organizationId = project.organizationId;
      }
    }
  }

  // Traverse VaultService relation
  const serviceId = (resObj?.serviceId as string) || (argsData?.serviceId as string) || ((argsObj?.where as Record<string, unknown> | undefined)?.serviceId as string);
  if (serviceId && (!workspaceId || !organizationId)) {
    const service = await prismaClient.vaultService.findUnique({
      where: { id: serviceId },
      select: { vaultId: true },
    });
    if (service) {
      const vault = await prismaClient.vault.findUnique({
        where: { id: service.vaultId },
        select: { projectId: true },
      });
      if (vault) {
        const project = await prismaClient.project.findUnique({
          where: { id: vault.projectId },
          select: { workspaceId: true, organizationId: true },
        });
        if (project) {
          if (!workspaceId) workspaceId = project.workspaceId;
          if (!organizationId) organizationId = project.organizationId;
        }
      }
    }
  }

  if (model === "Workspace") {
    workspaceId = (resObj?.id as string) || ((argsObj?.where as Record<string, unknown> | undefined)?.id as string);
  }

  if (model === "Session") {
    organizationId = (resObj?.activeOrganizationId as string) || (argsData?.activeOrganizationId as string) || fallbackOrgId;
    const sUserId = (resObj?.userId as string) || (argsData?.userId as string);
    if (!organizationId && sUserId) {
      const member = await prismaClient.member.findFirst({
        where: { userId: sUserId },
        select: { organizationId: true },
      });
      if (member) {
        organizationId = member.organizationId;
      }
    }
  }

  if (!organizationId) {
    return null;
  }

  return { workspaceId, organizationId };
}

/**
 * Returns human-friendly action type and description.
 */
function getActionDetails(
  model: string,
  operation: string,
  resObj: Record<string, unknown> | null,
  argsObj: Record<string, unknown> | null,
  userName: string,
): { action: string; entityType: string; description: string } {
  if (model === "Session" && operation.startsWith("create")) {
    return {
      action: "USER_SIGN_IN",
      entityType: "USER",
      description: `User "${userName}" signed in.`,
    };
  }

  const modelInfo = modelMapping[model];
  const entityType = modelInfo.entityType;
  let actionPrefix = "UPDATE";

  const argsData = argsObj?.data as Record<string, unknown> | undefined;

  if (operation.startsWith("create")) {
    actionPrefix = "CREATE";
  } else if (operation.startsWith("delete")) {
    actionPrefix = "FORCE_DELETE";
  } else if (operation.startsWith("update")) {
    const isSoftDelete = argsData?.deletedAt !== undefined && argsData?.deletedAt !== null;
    const isRestore = argsData?.deletedAt === null;
    if (isSoftDelete) {
      actionPrefix = "DELETE";
    } else if (isRestore) {
      actionPrefix = "RESTORE";
    } else {
      actionPrefix = "UPDATE";
    }
  }

  const action = `${actionPrefix}_${entityType}`;
  const name = (resObj?.name as string) || (resObj?.title as string) || (resObj?.taskKey as string) || "";
  let description = `User "${userName}" ${actionPrefix.toLowerCase().replace("_", " ")}d ${modelInfo.label}`;
  if (name) {
    description += ` "${name}"`;
  }
  description += ".";

  return {
    action,
    entityType,
    description,
  };
}

/**
 * Remove sensitive or overly large data before storing.
 */
function sanitizeArgs(args: unknown): unknown {
  if (!args) return null;
  const sanitized = JSON.parse(JSON.stringify(args)) as Record<string, unknown>;
  const data = sanitized.data as Record<string, unknown> | undefined;
  if (data) {
    if (data.password) data.password = "[REDACTED]";
    if (data.value && typeof data.value === "string" && data.value.length > 500) {
      data.value = data.value.substring(0, 500) + "...";
    }
  }
  return sanitized;
}
