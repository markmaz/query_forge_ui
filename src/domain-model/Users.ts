import { WorkspaceSelection } from "../features/tenant-admin/ui/WorkspaceTable";
import { Role } from "./Role";
import { Workspace } from "./Workspace";

export interface UserRow {
  user_id: string;
  email: string | null;
  status: string;
  last_log_in: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface UserInvite {
  user_id: string | null | undefined;
  email: string | null | undefined;
  first_name: string | null | undefined;
  last_name: string | null | undefined;
  status: string | null | undefined;
}

export interface UserResponse {
  users: UserRow[];
  next_cursor: string | null;
  prev_cursor: string | null;
}

export interface InviteUserPayload {
  email: string;
  workspaces: string[];
}

export type UserProfileUpdate = {
  user_id: string | null | undefined;
  email: string | null | undefined;
  workspaces: WorkspaceSelection[] | [];
  rbac_role_names?: string[];
}

export type SelfUserProfileUpdate = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export type UserProfile = {
    display_name: string | null | undefined;
    email: string | null | undefined;
    eula_accepted: boolean | undefined;
    first_name: string | null | undefined,
    last_log_in: string | null | undefined,
    last_name: string | null | undefined;
    status: string | null | undefined;
    tos_accepted: boolean | undefined;
    two_factor_preference: string | null | undefined;
    user_id: string | null | undefined;
    user_name: string | null | undefined;
    workspaces: Workspace[] | [];

}

export type Status = "Active" | "Inactive" | "Invited";

export type UserStatus = {
  user_id: string;
  status: Status;
}

export type UserRolesResponse = {
  user_id: string;
  direct_roles: Role[];
  effective_roles: Role[];
};

export type AddUserRoleRequest = {
  role_name: string;
};

export type ReplaceUserRolesRequest = {
  role_names: string[];
};

export type PatchUserRoleRequest = {
  role_name: string;
};
