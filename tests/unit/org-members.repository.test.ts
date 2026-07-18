import { describe, it, expect, vi } from "vitest";
import { orgMembersRepository } from "@/app/repositories/org-members.repository";
import { prismaMock } from "../../tests/helpers/db";

describe("OrgMembersRepository", () => {
  it("should find caller member and target member", async () => {
    prismaMock.member.findFirst.mockResolvedValueOnce({ id: "m-caller" });
    prismaMock.member.findFirst.mockResolvedValueOnce({ id: "m-target" });

    expect(await orgMembersRepository.findCallerMember("org-1", "user-1")).toEqual({ id: "m-caller" });
    expect(await orgMembersRepository.findTargetMember("org-1", "user-2")).toEqual({ id: "m-target" });
  });

  it("should ban and unban user", async () => {
    prismaMock.user.update.mockResolvedValueOnce({ id: "user-1", banned: true });
    prismaMock.user.update.mockResolvedValueOnce({ id: "user-1", banned: false });

    expect(await orgMembersRepository.banUser("user-1", "spamming")).toEqual({ id: "user-1", banned: true });
    expect(await orgMembersRepository.unbanUser("user-1")).toEqual({ id: "user-1", banned: false });
  });

  it("should delete sessions and find user by id", async () => {
    prismaMock.session.deleteMany.mockResolvedValueOnce({ count: 2 });
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-1" });

    expect(await orgMembersRepository.deleteSessionsByUserId("user-1")).toEqual({ count: 2 });
    expect(await orgMembersRepository.findUserById("user-1")).toEqual({ id: "user-1" });
  });

  it("should create session", async () => {
    const data = { userId: "user-1", token: "t-1", expiresAt: new Date(), impersonatedBy: "user-admin" };
    prismaMock.session.create.mockResolvedValueOnce({ id: "sess-1", ...data });
    expect(await orgMembersRepository.createSession(data)).toEqual({ id: "sess-1", ...data });
  });

  it("should find members with search, status, limit, and cursor", async () => {
    prismaMock.member.findMany.mockResolvedValue([{ id: "m-1" }]);

    const res1 = await orgMembersRepository.findMembers({
      activeOrgId: "org-1",
      limit: 10,
      search: "John",
      status: "banned",
    });
    expect(res1).toHaveLength(1);

    const res2 = await orgMembersRepository.findMembers({
      activeOrgId: "org-1",
      limit: 10,
      cursor: "cursor-id",
      status: "active",
    });
    expect(res2).toHaveLength(1);
  });

  it("should find invitation by id, pending invitations, and invitation in org", async () => {
    prismaMock.invitation.findUnique.mockResolvedValueOnce({ id: "invite-1" });
    prismaMock.invitation.findMany.mockResolvedValueOnce([{ id: "invite-1" }]);
    prismaMock.invitation.findFirst.mockResolvedValueOnce({ id: "invite-1" });

    expect(await orgMembersRepository.findInvitationById("invite-1")).toEqual({ id: "invite-1" });
    expect(await orgMembersRepository.findPendingInvitations("org-1")).toHaveLength(1);
    expect(await orgMembersRepository.findInvitationInOrg("invite-1", "org-1")).toEqual({ id: "invite-1" });
  });
});
