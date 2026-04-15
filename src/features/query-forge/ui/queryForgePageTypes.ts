import type { SqlQueryJson } from "../model/sqlJson";

export type OpenQueryState = {
  id: string | null;
  name: string;
  description?: string | null;
  scope?: string;
  isDirty: boolean;
  folderId?: string | null;
};

export type MoveTarget = {
  type: "folder" | "query";
  id: string;
  name: string;
  currentFolderId: string | null;
  view: "library" | "my";
};

export type PersistedQueryPayload = {
  id: string;
  name: string;
  description?: string | null;
  folderId: string | null;
  sqlJson: SqlQueryJson;
};
