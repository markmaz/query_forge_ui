export type Workspace = {
  workspace_id: string;
  is_default: number;
};

export type WorkspaceDetailBase = {
  workspace_id: string;
  name: string;
  server: string;
};

export type WorkspaceDetail = WorkspaceDetailBase;

export type UserWorkspaceDetails = WorkspaceDetailBase & {
  is_default: number;
};
