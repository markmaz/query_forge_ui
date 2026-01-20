export type TreeView = "library" | "shared" | "my" | "trash";

export type TreeNode =
  | {
      nodeType: "folder";
      id: string; // may be synthetic like "user:..." or "trash:..."
      name: string;
      parentId: string | null;
      sortIndex?: number;
      isRoot?: boolean;
      children: TreeNode[];
      deletedAt?: string | null;
    }
  | {
      nodeType: "query";
      id: string; // query UUID
      name: string;
      folderId?: string | null;
      updatedAt?: string | null;
      deletedAt?: string | null;
      canEdit?: boolean;
      scope?: string;
      isDeleted?: boolean;
      queryType?: string;
    };

export type TreeResponse = { view: TreeView; rootNodes: TreeNode[] };

export type RecentItem = { id: string; title: string; updatedAt?: string; queryType?: string };

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

export const isSyntheticId = (id: string) => id.startsWith("user:") || id.startsWith("trash:");

export type SavedQueriesAction =
  | { type: "CREATE_FOLDER"; parentId: string | null; sortIndex?: number }
  | { type: "OPEN_QUERY"; queryId: string }
  | { type: "RENAME_FOLDER"; folderId: string }
  | { type: "MOVE_FOLDER"; folderId: string }
  | { type: "DELETE_FOLDER"; folderId: string } // empty-only delete
  | { type: "TRASH_FOLDER"; folderId: string }
  | { type: "RESTORE_FOLDER"; folderId: string }
  | { type: "PURGE_FOLDER"; folderId: string }
  | { type: "RENAME_QUERY"; queryId: string }
  | { type: "MOVE_QUERY"; queryId: string }
  | { type: "COPY_QUERY"; queryId: string }
  | { type: "SHARE_QUERY"; queryId: string }
  | { type: "DELETE_QUERY"; queryId: string } // soft delete
  | { type: "RESTORE_QUERY"; queryId: string }
  | { type: "PURGE_QUERY"; queryId: string }
  | { type: "EMPTY_TRASH" };
