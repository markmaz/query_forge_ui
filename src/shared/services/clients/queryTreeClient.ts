import type { SqlQueryJson } from "../../../features/query-forge/model/sqlJson";
import type { TreeView } from "../../domain-state/savedQueries";
import api from "../api";

const TREE_BASE = "/query-tree";
const SAVED_BASE = "/saved-queries";

export const queryTreeClient = {
  fetchTree(view: TreeView) {
    return api.get(TREE_BASE, { params: { view } });
  },
  fetchRecent() {
    return api.get(`${TREE_BASE}/recent`);
  },
  createFolder(payload: {
    name: string;
    parentId?: string | null;
    sortIndex?: number;
    scope?: "my" | "library";
  }) {
    return api.post(`${TREE_BASE}/folders`, payload);
  },
  renameFolder(folderId: string, name: string) {
    return api.patch(`${TREE_BASE}/folders/${folderId}/rename`, { name });
  },
  moveFolder(folderId: string, payload: { parentId?: string | null; sortIndex?: number | null }) {
    return api.patch(`${TREE_BASE}/folders/${folderId}/move`, payload);
  },
  deleteFolder(folderId: string) {
    return api.delete(`${TREE_BASE}/folders/${folderId}`);
  },
  trashFolder(folderId: string) {
    return api.post(`${TREE_BASE}/folders/${folderId}/trash`);
  },
  restoreFolder(folderId: string) {
    return api.post(`${TREE_BASE}/folders/${folderId}/restore`);
  },
  purgeFolder(folderId: string) {
    return api.delete(`${TREE_BASE}/folders/${folderId}/purge`);
  },
  fetchSavedQuery(queryId: string) {
    return api.get(`${SAVED_BASE}/${queryId}`);
  },
  createSavedQuery(payload: {
    name: string;
    description?: string | null;
    folderId?: string | null;
    sqlJson: SqlQueryJson;
  }) {
    return api.post(SAVED_BASE, payload);
  },
  updateSavedQuery(
    queryId: string,
    payload: {
      name: string;
      description?: string | null;
      folderId?: string | null;
      sqlJson: SqlQueryJson;
    }
  ) {
    return api.patch(`${SAVED_BASE}/${queryId}`, payload);
  },
  moveSavedQuery(queryId: string, folderId: string | null) {
    return api.patch(`${SAVED_BASE}/${queryId}/move`, { folderId });
  },
  deleteSavedQuery(queryId: string) {
    return api.post(`${SAVED_BASE}/${queryId}/delete`);
  },
  saveQueryToLibrary(queryId: string) {
    return api.post(`${SAVED_BASE}/${queryId}/save-to-library`);
  },
  restoreSavedQuery(queryId: string) {
    return api.post(`${SAVED_BASE}/${queryId}/restore`);
  },
};
