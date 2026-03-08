import type { RecentItem, TreeNode, TreeResponse, TreeView } from "../domain-state/savedQueries";
import type { SqlQueryJson } from "../../features/query-forge/model/sqlJson";
import { queryTreeClient } from "./clients/queryTreeClient";

function toTreeNode(raw: any): TreeNode | null {
  if (!raw || typeof raw !== "object") return null;

  const nodeType = raw.nodeType ?? raw.node_type ?? raw.type;

  if (nodeType === "folder") {
    return {
      nodeType: "folder",
      id: String(raw.id ?? raw.folderId ?? raw.folder_id ?? ""),
      name: raw.name ?? raw.title ?? "Untitled",
      parentId: raw.parentId ?? raw.parent_id ?? null,
      sortIndex: raw.sortIndex ?? raw.sort_index,
      isRoot: raw.isRoot ?? raw.is_root ?? false,
      children: normalizeNodes(raw.children ?? raw.childNodes ?? raw.child_nodes ?? []),
      deletedAt: raw.deletedAt ?? raw.deleted_at ?? null,
    };
  }

  const id = raw.id ?? raw.queryId ?? raw.query_id;
  if (!id) return null;

  return {
    nodeType: "query",
    id: String(id),
    name: raw.name ?? raw.title ?? "Untitled",
    folderId: raw.folderId ?? raw.folder_id ?? null,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
    deletedAt: raw.deletedAt ?? raw.deleted_at ?? null,
    canEdit: raw.canEdit ?? raw.can_edit,
    scope: raw.scope ?? raw.view ?? undefined,
    isDeleted: raw.isDeleted ?? raw.is_deleted ?? undefined,
    queryType: raw.queryType ?? raw.query_type ?? raw.toolType ?? raw.tool_type ?? undefined,
  };
}

function normalizeNodes(nodes: any[]): TreeNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map((n) => toTreeNode(n))
    .filter((n): n is TreeNode => Boolean(n));
}

export async function fetchQueryTree(view: TreeView): Promise<TreeResponse> {
  const res = await queryTreeClient.fetchTree(view);
  const data = res.data || {};
  return {
    view,
    rootNodes: normalizeNodes(data.rootNodes || data.root_nodes || data.nodes || []),
  };
}

function isBadRequest(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
  return status === 400;
}

async function fetchQueryTreeOrEmpty(view: TreeView): Promise<TreeResponse> {
  try {
    return await fetchQueryTree(view);
  } catch (error) {
    if (isBadRequest(error)) {
      return { view, rootNodes: [] };
    }
    throw error;
  }
}

export async function fetchAllQueryTrees(): Promise<{
  library: TreeResponse;
  shared: TreeResponse;
  my: TreeResponse;
  trash: TreeResponse;
}> {
  const library = await fetchQueryTreeOrEmpty("library");
  const [shared, my, trash] = await Promise.all([
    fetchQueryTreeOrEmpty("shared"),
    fetchQueryTreeOrEmpty("my"),
    fetchQueryTreeOrEmpty("trash"),
  ]);
  return { library, shared, my, trash };
}

export async function fetchRecentQueries(): Promise<RecentItem[]> {
  let res;
  try {
    res = await queryTreeClient.fetchRecent();
  } catch (error) {
    if (isBadRequest(error)) return [];
    throw error;
  }
  const rows = res.data?.rows ?? res.data?.recent ?? res.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    id: String(r.id ?? r.queryId ?? r.query_id ?? ""),
    title: r.title ?? r.name ?? "Untitled",
    updatedAt: r.updatedAt ?? r.updated_at ?? null,
    queryType: r.queryType ?? r.query_type ?? r.toolType ?? r.tool_type ?? undefined,
  }));
}

// Folders
export async function createFolder(payload: { name: string; parentId?: string | null; sortIndex?: number }) {
  const res = await queryTreeClient.createFolder(payload);
  return res.data;
}

export async function renameFolder(folderId: string, name: string) {
  const res = await queryTreeClient.renameFolder(folderId, name);
  return res.data;
}

export async function moveFolder(folderId: string, params: { parentId?: string | null; sortIndex?: number | null }) {
  const res = await queryTreeClient.moveFolder(folderId, params);
  return res.data;
}

export async function deleteFolder(folderId: string) {
  const res = await queryTreeClient.deleteFolder(folderId);
  return res.data;
}

export async function trashFolder(folderId: string) {
  const res = await queryTreeClient.trashFolder(folderId);
  return res.data;
}

export async function restoreFolder(folderId: string) {
  const res = await queryTreeClient.restoreFolder(folderId);
  return res.data;
}

export async function purgeFolder(folderId: string) {
  const res = await queryTreeClient.purgeFolder(folderId);
  return res.data;
}

// Saved queries
export async function fetchSavedQuery(queryId: string) {
  const res = await queryTreeClient.fetchSavedQuery(queryId);
  return res.data;
}

export async function createSavedQuery(payload: {
  name: string;
  description?: string | null;
  folderId?: string | null;
  sqlJson: SqlQueryJson;
}) {
  const res = await queryTreeClient.createSavedQuery(payload);
  return res.data;
}

export async function updateSavedQuery(
  queryId: string,
  payload: {
    name: string;
    description?: string | null;
    folderId?: string | null;
    sqlJson: SqlQueryJson;
  }
) {
  const res = await queryTreeClient.updateSavedQuery(queryId, payload);
  return res.data;
}

export async function moveSavedQuery(queryId: string, folderId: string | null) {
  const res = await queryTreeClient.moveSavedQuery(queryId, folderId);
  return res.data;
}

export async function deleteSavedQuery(queryId: string) {
  const res = await queryTreeClient.deleteSavedQuery(queryId);
  return res.data;
}

export async function restoreSavedQuery(queryId: string) {
  const res = await queryTreeClient.restoreSavedQuery(queryId);
  return res.data;
}

export async function hydrateQueryTree(): Promise<{
  trees: Awaited<ReturnType<typeof fetchAllQueryTrees>>;
  recent: RecentItem[];
}> {
  const [trees, recent] = await Promise.all([fetchAllQueryTrees(), fetchRecentQueries()]);
  return { trees, recent };
}

