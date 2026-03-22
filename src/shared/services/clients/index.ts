import { identityClient } from "./identityClient";
import { queryTreeClient } from "./queryTreeClient";
import { roleClient } from "./roleClient";
import { userClient } from "./userClient";
import { workspaceClient } from "./workspaceClient";

export {
  identityClient,
  queryTreeClient,
  roleClient,
  userClient,
  workspaceClient,
};

export const domainApiClients = {
  identity: identityClient,
  queryTree: queryTreeClient,
  roles: roleClient,
  users: userClient,
  workspace: workspaceClient,
} as const;
