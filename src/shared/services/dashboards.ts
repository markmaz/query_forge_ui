import api from "./api";

function logDashboardError(context: string, error: unknown) {
  console.error(`Error ${context}:`, error);
}

export const fetchDashboards = async () => {
  // Removed backend namespace: /api/v1/dashboards*
  // Keep this for UI compatibility, but do not call a removed endpoint.
  return [];
};

export const fetchEmbedUrl = async (
  dashboard_id: string,
  user_id: string,
  workspace_id: string
) => {
  try {
    const route = `/users/${user_id}/workspaces/${workspace_id}/dashboards/${dashboard_id}/embed`;
    const response = await api.get(route);
    return response.data;
  } catch (error) {
    logDashboardError("fetching embed url", error);
    return undefined;
  }
};
