import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  organization: ["update", "delete"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "cancel"],
  workspace: ["create", "read", "update", "delete"],
  project: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  owner: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "read", "update", "delete"],
    invitation: ["create", "cancel"],
    workspace: ["create", "read", "update", "delete"],
    project: ["create", "read", "update", "delete"],
  }),
  admin: ac.newRole({
    organization: ["update"],
    member: ["create", "read", "update", "delete"],
    invitation: ["create", "cancel"],
    workspace: ["create", "read", "update"],
    project: ["create", "read", "update", "delete"],
  }),
  workspace_admin: ac.newRole({
    member: ["read"],
    workspace: ["update"],
    project: ["create", "read", "update", "delete"],
  }),
  project_admin: ac.newRole({
    member: ["read"],
    project: ["update", "delete"],
  }),
  member: ac.newRole({
    member: ["read"],
    workspace: ["read"],
    project: ["read"],
  }),
  guest: ac.newRole({
    member: ["read"],
  }),
};
