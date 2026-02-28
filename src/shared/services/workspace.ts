import api from "./api";
/**
 * Fetches the default workspace details for a given user.
 *
 * @param user_id - The user's unique identifier.
 * @returns A promise resolving to the default WorkspaceDetail, or null if not found.
 */

import { Workspace, WorkspaceDetail, UserWorkspaceDetails } from "../../entities/Workspace";

export const fetchWorkspaceInfo = async (
  user_id: string
): Promise<WorkspaceDetail | null> => {
  try {
    // Step 1: Get all user workspaces
    const { data: workspaces } = await api.get<Workspace[]>(
      `/users/${user_id}/workspaces`
    );

    // Step 2: Find default workspace
    const defaultWorkspace = workspaces.find(w => w.is_default === 1);
    if (!defaultWorkspace) return null;

    // Step 3: Fetch and return workspace details
    const { data: workspaceDetail } = await api.get<WorkspaceDetail>(
      `/workspaces/${defaultWorkspace.workspace_id}`
    );
    return workspaceDetail;
  } catch (error) {
    console.error(`Failed to fetch workspace info for user ${user_id}:`, error);
    return null;
  }
};

export const fetchUserWorkspaces = async (user_id: string): Promise<Workspace[]> => {
    try{
        const { data: workspaces } = await api.get<Workspace[]>(
            `/users/${user_id}/workspaces`
          );
    
          return workspaces;
    } catch (error){
        console.error("Error fetching user workspaces");
        return []
    }
};

export const fetchWorkspaceDetails = async(workspace_id: string): Promise<WorkspaceDetail | null> => {
    try{
        const {data: workspaceDetail} = await api.get<WorkspaceDetail>(`/workspaces/${workspace_id}`);
        return workspaceDetail;
    }catch(error){
        console.error("Failed to retrieve workspace");
        return null;
    }
}

export const getUserWorkspaceDetails = async (
    user_id: string
  ): Promise<UserWorkspaceDetails[]> => {
    const workspaces: Workspace[] = await fetchUserWorkspaces(user_id);
  
    const merged: (UserWorkspaceDetails | null)[] = await Promise.all(
      workspaces.map(async (workspace) => {
        try {
          const detail = await fetchWorkspaceDetails(workspace.workspace_id);
  
          if (detail) {
            return {
              workspace_id: detail.workspace_id,
              name: detail.name,
              server: detail.server,
              is_default: workspace.is_default,
            };
          } else {
            return null;
          }
        } catch (error) {
          console.error(error);
          return null;
        }
      })
    );
  
    return merged
    .filter((item): item is UserWorkspaceDetails => item !== null)
    .sort((a, b) => a.server.localeCompare(b.server));
  };

  export const setUserWorkspace = async (user_id: string, workspace_id: string) => {
    const data = {
      user_id,
      workspace_id,
      is_default: true,
    };
  
    try {
      const response = await api.put(`/user-workspaces`, data);
      return response.data;
    } catch (error) {
      console.error("Could not update workspace:", error);
      throw error;
    }
  };

  export const fetchWorkspaces = async(): Promise<WorkspaceDetail[]> =>{
    try{    
      const response = await api.get('/workspaces');
      return response.data
    } catch(error){
      console.error("Could not retrieve workspaces", error);
      throw error;
    }

  }
  