import api from "../api";

export const workspaceClient = {
  listUserWorkspaces(userId: string) {
    return api.get(`/users/${userId}/workspaces`);
  },
  listWorkspaceUsers(
    workspaceId: string,
    params?: { q?: string; include_inactive?: boolean; limit?: number; offset?: number }
  ) {
    return api.get(`/workspaces/${workspaceId}/users`, { params });
  },
  setDefaultWorkspace(payload: { user_id: string; workspace_id: string; is_default: boolean }) {
    return api.put("/user-workspaces", payload);
  },
  listWorkspaces() {
    return api.get("/workspaces");
  },
};
