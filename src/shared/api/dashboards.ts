import api from "./api";

/**
 * Fetches all available dashboards from the backend API.
 *
 * @returns A promise that resolves with the list of dashboards.
 * @throws Logs an error to the console if the request fails.
 */
export const fetchDashboards = async () => {
  try {
    const response = await api.get("/dashboards");
    return response.data;
  } catch (error) {
    console.error("Error fetching dashboards:", error);
  }
};

/**
 * Fetches the embed URL for a specific dashboard.
 *
 * @param dashboard_id - The unique identifier of the dashboard.
 * @param user_id - The unique identifier of the user.
 * @param workspace_id - The unique identifier of the workspace.
 * @returns A promise that resolves with the embed URL of the dashboard.
 * @throws Logs an error to the console if the request fails.
 */
export const fetchEmbedUrl = async (dashboard_id: string, user_id: string, workspace_id: string) => {
  try {
    const response = await api.get(`/users/${user_id}/workspaces/${workspace_id}/dashboards/${dashboard_id}/embed`);
    return response.data;
  } catch (error) {
    console.error("Error fetching embed url:", error);
  }
};
