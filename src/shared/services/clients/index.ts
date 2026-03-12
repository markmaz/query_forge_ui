import { identityClient } from "./identityClient";
import { productClient } from "./productClient";
import { productGroupClient } from "./productGroupClient";
import { queryTreeClient } from "./queryTreeClient";
import { roleClient } from "./roleClient";
import { userClient } from "./userClient";
import { workspaceClient } from "./workspaceClient";

export {
  identityClient,
  productClient,
  productGroupClient,
  queryTreeClient,
  roleClient,
  userClient,
  workspaceClient,
};

export const domainApiClients = {
  identity: identityClient,
  products: productClient,
  productGroups: productGroupClient,
  queryTree: queryTreeClient,
  roles: roleClient,
  users: userClient,
  workspace: workspaceClient,
} as const;
