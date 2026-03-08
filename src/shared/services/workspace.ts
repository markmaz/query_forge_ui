import { Workspace, WorkspaceDetail, UserWorkspaceDetails } from "../../domain-model/Workspace";
import { workspaceClient } from "./clients/workspaceClient";

function logWorkspaceError(message: string, error: unknown) {
  console.error(message, error);
}

async function fetchUserWorkspaceRows(user_id: string): Promise<Workspace[]> {
  const response = await workspaceClient.listUserWorkspaces(user_id);
  return response.data;
}

function normalizeWorkspaceId(value: unknown): string {
  return String(value ?? "").trim();
}

function toWorkspaceDetailMap(workspaces: WorkspaceDetail[]): Map<string, WorkspaceDetail> {
  const map = new Map<string, WorkspaceDetail>();
  workspaces.forEach((workspace) => {
    const id = normalizeWorkspaceId((workspace as WorkspaceDetail & { workspaceId?: unknown }).workspace_id);
    if (id) {
      map.set(id, workspace);
    }
  });
  return map;
}

function findDefaultWorkspace(workspaces: Workspace[]): Workspace | null {
  return workspaces.find((workspace) => workspace.is_default === 1) ?? null;
}

export const fetchWorkspaceInfo = async (
  user_id: string
): Promise<WorkspaceDetail | null> => {
  try {
    const [workspaces, allWorkspaceDetails] = await Promise.all([
      fetchUserWorkspaceRows(user_id),
      fetchWorkspaces(),
    ]);
    const defaultWorkspace = findDefaultWorkspace(workspaces);
    if (!defaultWorkspace) return null;
    const byId = toWorkspaceDetailMap(allWorkspaceDetails);
    return byId.get(String(defaultWorkspace.workspace_id)) ?? null;
  } catch (error) {
    logWorkspaceError(`Failed to fetch workspace info for user ${user_id}:`, error);
    return null;
  }
};

export const fetchUserWorkspaces = async (user_id: string): Promise<Workspace[]> => {
  try {
    return await fetchUserWorkspaceRows(user_id);
  } catch (error) {
    logWorkspaceError("Error fetching user workspaces", error);
    return [];
  }
};

export const fetchWorkspaceDetails = async (
  workspace_id: string
): Promise<WorkspaceDetail | null> => {
  try {
    const details = await fetchWorkspaces();
    const byId = toWorkspaceDetailMap(details);
    return byId.get(String(workspace_id)) ?? null;
  } catch (error) {
    logWorkspaceError("Failed to retrieve workspace", error);
    return null;
  }
};

export const getUserWorkspaceDetails = async (
  user_id: string
): Promise<UserWorkspaceDetails[]> => {
  const [workspaces, allWorkspaceDetails] = await Promise.all([
    fetchUserWorkspaces(user_id),
    fetchWorkspaces(),
  ]);
  const byId = toWorkspaceDetailMap(allWorkspaceDetails);

  const details = await Promise.all(
    workspaces.map(async (workspace) => {
      try {
        const detail = byId.get(String(workspace.workspace_id)) ?? null;
        if (!detail) return null;

        return {
          workspace_id: detail.workspace_id,
          name: detail.name,
          server: detail.server,
          is_default: workspace.is_default,
        } as UserWorkspaceDetails;
      } catch (error) {
        logWorkspaceError("Failed mapping workspace detail", error);
        return null;
      }
    })
  );

  return details
    .filter((item): item is UserWorkspaceDetails => item !== null)
    .sort((a, b) => a.server.localeCompare(b.server));
};

export const setUserWorkspace = async (user_id: string, workspace_id: string) => {
  const payload = {
    user_id,
    workspace_id,
    is_default: true,
  };

  try {
    const response = await workspaceClient.setDefaultWorkspace(payload);
    return response.data;
  } catch (error) {
    logWorkspaceError("Could not update workspace:", error);
    throw error;
  }
};

export const fetchWorkspaces = async (): Promise<WorkspaceDetail[]> => {
  try {
    const response = await workspaceClient.listWorkspaces();
    return response.data;
  } catch (error) {
    logWorkspaceError("Could not retrieve workspaces", error);
    throw error;
  }
};
