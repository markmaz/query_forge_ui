import type {
  AddUserRoleRequest,
  PatchUserRoleRequest,
  ReplaceUserRolesRequest,
  SelfUserProfileUpdate,
  UserProfileUpdate,
  UserStatus,
} from "../../../domain-model/Users";
import api from "../api";

export const userClient = {
  fetchUser(userId: string) {
    return api.get(`/users/${userId}`);
  },
  fetchUsers(queryString: string) {
    return api.get(`/users?${queryString}`);
  },
  fetchUserCounts() {
    return api.get("/users/counts");
  },
  inviteUser(payload: UserProfileUpdate) {
    return api.post("/users", payload);
  },
  validateInviteToken(token: string) {
    return api.get(`/auth/invite/validate/${token}`);
  },
  acceptInvite(token: string, payload: unknown) {
    return api.post("/auth/invite/accept", payload, {
      params: { token },
    });
  },
  updateUser(userId: string, payload: UserProfileUpdate | UserStatus) {
    return api.put(`/users/${userId}`, payload);
  },
  updateOwnProfile(payload: SelfUserProfileUpdate) {
    return api.put("/auth/profile", payload);
  },
  deleteUser(userId: string) {
    return api.delete(`/users/${userId}`);
  },
  resendInvite(payload: UserProfileUpdate) {
    return api.post("/users/resend-invite", payload);
  },
  inviteUsersBulk(payload: {
    emails: string[];
    workspaces: { workspace_id: string | number; is_default?: boolean }[];
  }) {
    return api.post("/users/bulk-invite", payload);
  },
  fetchUserRoles(userId: string) {
    return api.get(`/users/${userId}/roles`);
  },
  addUserRole(userId: string, payload: AddUserRoleRequest) {
    return api.post(`/users/${userId}/roles`, payload);
  },
  replaceUserRoles(userId: string, payload: ReplaceUserRolesRequest) {
    return api.put(`/users/${userId}/roles`, payload);
  },
  patchUserRole(userId: string, roleName: string, payload: PatchUserRoleRequest) {
    return api.patch(`/users/${userId}/roles/${encodeURIComponent(roleName)}`, payload);
  },
  removeUserRole(userId: string, roleName: string) {
    return api.delete(`/users/${userId}/roles/${encodeURIComponent(roleName)}`);
  },
};
