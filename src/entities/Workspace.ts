export type Workspace = {
  workspace_id: string;
  is_default: number;
};

export type WorkspaceDetail = {
  workspace_id: string;
  name: string;
  server: string;
};

export type UserWorkspaceDetails = {
    workspace_id: string;
    name: string;
    server: string;
    is_default: number;
}