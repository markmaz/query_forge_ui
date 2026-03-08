export type TreeView = "library" | "shared" | "my" | "trash";

type FolderNode = {
  nodeType: "folder";
  id: string;
  name: string;
  parentId: string | null;
  sortIndex?: number;
  isRoot?: boolean;
  children: TreeNode[];
  deletedAt?: string | null;
};

type QueryNode = {
  nodeType: "query";
  id: string;
  name: string;
  folderId?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  canEdit?: boolean;
  scope?: string;
  isDeleted?: boolean;
  queryType?: string;
};

export type TreeNode = FolderNode | QueryNode;

export type TreeResponse = {
  view: TreeView;
  rootNodes: TreeNode[];
};

export type RecentItem = {
  id: string;
  title: string;
  updatedAt?: string;
  queryType?: string;
};

export type SavedQueryGroupKey = "shared" | "mine" | "recent";

export type SavedQueryItem = {
  id: string;
  title: string;
  updatedAt?: string;
  shared?: boolean;
};

export type SavedQueriesData = {
  shared: SavedQueryItem[];
  mine: SavedQueryItem[];
  recent: SavedQueryItem[];
};

const SYNTHETIC_PREFIXES = ["user:", "trash:"];

export const isSyntheticId = (id: string) =>
  SYNTHETIC_PREFIXES.some((prefix) => id.startsWith(prefix));

export type SavedQueriesAction =
  | { type: "CREATE_FOLDER"; parentId: string | null; sortIndex?: number }
  | { type: "OPEN_QUERY"; queryId: string }
  | { type: "RENAME_FOLDER"; folderId: string }
  | { type: "MOVE_FOLDER"; folderId: string }
  | { type: "DELETE_FOLDER"; folderId: string }
  | { type: "TRASH_FOLDER"; folderId: string }
  | { type: "RESTORE_FOLDER"; folderId: string }
  | { type: "PURGE_FOLDER"; folderId: string }
  | { type: "RENAME_QUERY"; queryId: string }
  | { type: "MOVE_QUERY"; queryId: string }
  | { type: "COPY_QUERY"; queryId: string }
  | { type: "SHARE_QUERY"; queryId: string }
  | { type: "DELETE_QUERY"; queryId: string }
  | { type: "RESTORE_QUERY"; queryId: string }
  | { type: "PURGE_QUERY"; queryId: string }
  | { type: "EMPTY_TRASH" };
