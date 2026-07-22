import { describe, it, expect, vi } from "vitest";
import { projectRepository } from "@/app/repositories/project.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("ProjectRepository", () => {
  it("should find template by slug and get templates", async () => {
    prismaMock.projectTemplate.findUnique.mockResolvedValueOnce({
      id: "tmpl-1",
      slug: "kanban",
    });
    prismaMock.projectTemplate.findMany.mockResolvedValueOnce([
      { id: "tmpl-1" },
    ]);

    expect(await projectRepository.findTemplateBySlug("kanban")).toEqual({
      id: "tmpl-1",
      slug: "kanban",
    });
    expect(await projectRepository.getTemplates()).toHaveLength(1);
  });

  it("should find workspace by id", async () => {
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    const result = await projectRepository.findWorkspaceById("ws-1");
    expect(prismaMock.workspace.findUnique).toHaveBeenCalled();
    expect(result?.organizationId).toBe("org-1");
  });

  it("should create project with vault, statuses, and custom fields", async () => {
    const data = {
      title: "Project 1",
      projectKey: "P1",
      template: "kanban",
      teamMode: "standard",
      workspaceId: "ws-1",
      organizationId: "org-1",
    };
    const statuses = [{ name: "Todo", category: "todo", order: 0 }];
    const customFields = [{ name: "Priority", type: "text" }];

    prismaMock.project.create.mockResolvedValueOnce({ id: "proj-1" });
    const result = await projectRepository.createProject(
      data,
      statuses,
      customFields,
    );
    expect(prismaMock.project.create).toHaveBeenCalled();
    expect(result).toEqual({ id: "proj-1" });
  });

  it("should get projects (with/without see all permissions)", async () => {
    prismaMock.project.findMany.mockResolvedValue([{ id: "proj-1" }]);

    expect(
      await projectRepository.getProjects("ws-1", true, "user-1"),
    ).toHaveLength(1);
    expect(
      await projectRepository.getProjects("ws-1", false, "user-1"),
    ).toHaveLength(1);
    expect(
      await projectRepository.getOrgProjects("org-1", true, "user-1"),
    ).toHaveLength(1);
    expect(
      await projectRepository.getOrgProjects("org-1", false, "user-1"),
    ).toHaveLength(1);
  });

  it("should get project details, update, delete project, and get project members", async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: "proj-1" });
    prismaMock.project.update.mockResolvedValueOnce({
      id: "proj-1",
      title: "Updated",
    });
    prismaMock.project.delete.mockResolvedValueOnce({ id: "proj-1" });
    prismaMock.projectMember.findMany.mockResolvedValueOnce([{ id: "pm-1" }]);

    expect(await projectRepository.getProjectDetails("proj-1")).toEqual({
      id: "proj-1",
    });
    expect(
      await projectRepository.updateProject("proj-1", { title: "Updated" }),
    ).toEqual({ id: "proj-1", title: "Updated" });
    expect(await projectRepository.deleteProject("proj-1")).toEqual({
      id: "proj-1",
    });
    expect(await projectRepository.getProjectMembers("proj-1")).toEqual([
      { id: "pm-1" },
    ]);
  });

  it("should find workspace members", async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValueOnce([{ id: "wm-1" }]);
    const result = await projectRepository.findWorkspaceMembers("ws-1", [
      "user-1",
    ]);
    expect(result).toHaveLength(1);
  });

  it("should upsert and delete project member", async () => {
    // Case 1: Project not found
    prismaMock.project.findUnique.mockResolvedValue(null);
    await expect(
      projectRepository.upsertProjectMember("proj-1", "user-1"),
    ).rejects.toThrow("Project not found");
    await expect(
      projectRepository.deleteProjectMember("proj-1", "user-1"),
    ).rejects.toThrow("Project not found");

    // Case 2: Project exists
    prismaMock.project.findUnique.mockResolvedValue({
      organizationId: "org-1",
    });
    prismaMock.projectMember.upsert.mockResolvedValueOnce({ id: "pm-1" });
    prismaMock.projectMember.delete.mockResolvedValueOnce({ id: "pm-1" });

    expect(
      await projectRepository.upsertProjectMember("proj-1", "user-1"),
    ).toEqual({ id: "pm-1" });
    expect(
      await projectRepository.deleteProjectMember("proj-1", "user-1"),
    ).toEqual({ id: "pm-1" });
  });

  it("should manage project vault (find, create, findService, createService, deleteService)", async () => {
    prismaMock.vault.findUnique.mockResolvedValueOnce({ id: "vault-1" });
    prismaMock.project.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    prismaMock.vault.create.mockResolvedValueOnce({ id: "vault-1" });
    prismaMock.vaultService.findFirst.mockResolvedValueOnce({
      id: "service-1",
    });
    prismaMock.vault.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    prismaMock.vaultService.create.mockResolvedValueOnce({ id: "service-1" });
    prismaMock.vaultService.delete.mockResolvedValueOnce({ id: "service-1" });

    expect(await projectRepository.findVault("proj-1")).toEqual({
      id: "vault-1",
    });
    expect(await projectRepository.createVault("proj-1")).toEqual({
      id: "vault-1",
    });
    expect(await projectRepository.findVaultService("vault-1", "AWS")).toEqual({
      id: "service-1",
    });
    expect(
      await projectRepository.createVaultService("vault-1", "AWS"),
    ).toEqual({ id: "service-1" });
    expect(await projectRepository.deleteVaultService("service-1")).toEqual({
      id: "service-1",
    });
  });

  it("should throw errors when vault not found for service creation", async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);
    await expect(projectRepository.createVault("proj-1")).rejects.toThrow(
      "Project not found",
    );

    prismaMock.vault.findUnique.mockResolvedValueOnce(null);
    await expect(
      projectRepository.createVaultService("vault-1", "AWS"),
    ).rejects.toThrow("Vault not found");
  });

  it("should upsert, update, and delete vault items", async () => {
    // Case service not found
    prismaMock.vaultService.findUnique.mockResolvedValueOnce(null);
    await expect(
      projectRepository.upsertVaultItem("service-1", "key", "val", "note"),
    ).rejects.toThrow("Vault service not found");

    // Case service exists
    prismaMock.vaultService.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    prismaMock.vaultItem.upsert.mockResolvedValueOnce({ id: "item-1" });
    prismaMock.vaultItem.update.mockResolvedValueOnce({ id: "item-1" });
    prismaMock.vaultItem.delete.mockResolvedValueOnce({ id: "item-1" });

    expect(
      await projectRepository.upsertVaultItem(
        "service-1",
        "key",
        "val",
        "note",
      ),
    ).toEqual({ id: "item-1" });
    expect(
      await projectRepository.updateVaultItem("item-1", { value: "new" }),
    ).toEqual({ id: "item-1" });
    expect(await projectRepository.deleteVaultItem("item-1")).toEqual({
      id: "item-1",
    });
  });

  it("should find project file", async () => {
    prismaMock.media.findFirst.mockResolvedValueOnce({ id: "media-1" });
    const result = await projectRepository.findProjectFile("proj-1", "file-1");
    expect(result?.id).toBe("media-1");
  });

  it("should manage automation rules (findMany, findUnique, create, update, delete)", async () => {
    prismaMock.automationRule.findMany.mockResolvedValueOnce([
      { id: "rule-1" },
    ]);
    prismaMock.automationRule.findUnique.mockResolvedValueOnce({
      id: "rule-1",
    });
    prismaMock.project.findUnique.mockResolvedValueOnce({
      organizationId: "org-1",
    });
    prismaMock.automationRule.create.mockResolvedValueOnce({ id: "rule-1" });
    prismaMock.automationRule.update.mockResolvedValueOnce({ id: "rule-1" });
    prismaMock.automationRule.delete.mockResolvedValueOnce({ id: "rule-1" });

    expect(await projectRepository.findAutomationRules("proj-1")).toEqual([
      { id: "rule-1" },
    ]);
    expect(await projectRepository.findAutomationRuleById("rule-1")).toEqual({
      id: "rule-1",
    });
    expect(
      await projectRepository.createAutomationRule("proj-1", {
        name: "R1",
        trigger: "T",
        action: "A",
      }),
    ).toEqual({ id: "rule-1" });
    expect(
      await projectRepository.updateAutomationRule("rule-1", {
        name: "R1Updated",
      }),
    ).toEqual({ id: "rule-1" });
    expect(await projectRepository.deleteAutomationRule("rule-1")).toEqual({
      id: "rule-1",
    });
  });

  it("should throw error if project not found during automation rule creation", async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);
    await expect(
      projectRepository.createAutomationRule("proj-1", {
        name: "R1",
        trigger: "T",
        action: "A",
      }),
    ).rejects.toThrow("Project not found");
  });

  it("should cover soft delete, restore, and forceDelete methods for project, vaultService, vaultItem, and automationRule", async () => {
    prismaMock.project.findUniqueWithTrashed.mockResolvedValue({
      id: "proj-1",
    });
    prismaMock.project.restore.mockResolvedValue({ id: "proj-1" });
    prismaMock.project.forceDelete.mockResolvedValue({ id: "proj-1" });

    prismaMock.vaultService.findUniqueWithTrashed.mockResolvedValue({
      id: "service-1",
    });
    prismaMock.vaultService.restore.mockResolvedValue({ id: "service-1" });
    prismaMock.vaultService.forceDelete.mockResolvedValue({ id: "service-1" });

    prismaMock.vaultItem.findUniqueWithTrashed.mockResolvedValue({
      id: "item-1",
    });
    prismaMock.vaultItem.restore.mockResolvedValue({ id: "item-1" });
    prismaMock.vaultItem.forceDelete.mockResolvedValue({ id: "item-1" });

    prismaMock.automationRule.findUniqueWithTrashed.mockResolvedValue({
      id: "rule-1",
    });
    prismaMock.automationRule.restore.mockResolvedValue({ id: "rule-1" });
    prismaMock.automationRule.forceDelete.mockResolvedValue({ id: "rule-1" });

    expect(
      await projectRepository.findProjectByIdWithTrashed("proj-1"),
    ).toEqual({ id: "proj-1" });
    expect(await projectRepository.restoreProject("proj-1")).toEqual({
      id: "proj-1",
    });
    expect(await projectRepository.forceDeleteProject("proj-1")).toEqual({
      id: "proj-1",
    });

    expect(
      await projectRepository.findVaultServiceByIdWithTrashed("service-1"),
    ).toEqual({ id: "service-1" });
    expect(await projectRepository.restoreVaultService("service-1")).toEqual({
      id: "service-1",
    });
    expect(
      await projectRepository.forceDeleteVaultService("service-1"),
    ).toEqual({ id: "service-1" });

    expect(
      await projectRepository.findVaultItemByIdWithTrashed("item-1"),
    ).toEqual({ id: "item-1" });
    expect(await projectRepository.restoreVaultItem("item-1")).toEqual({
      id: "item-1",
    });
    expect(await projectRepository.forceDeleteVaultItem("item-1")).toEqual({
      id: "item-1",
    });

    expect(
      await projectRepository.findAutomationRuleByIdWithTrashed("rule-1"),
    ).toEqual({ id: "rule-1" });
    expect(await projectRepository.restoreAutomationRule("rule-1")).toEqual({
      id: "rule-1",
    });
    expect(await projectRepository.forceDeleteAutomationRule("rule-1")).toEqual(
      { id: "rule-1" },
    );
  });
});
