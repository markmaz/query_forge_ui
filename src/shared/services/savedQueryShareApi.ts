import api from "./api";

export type ShareKind = "WORKSPACE" | "USER";
export type SharePermission = "READ" | "WRITE";

export type SavedQueryShareRow = {
  aclId: string;
  principalType: ShareKind;
  principalId: string;
  permission: SharePermission;
  canEdit: boolean;
  createdAt: string | null;
};

type ShareRowInput = Partial<SavedQueryShareRow> & {
  acl_id?: string;
  principal_type?: ShareKind;
  principal_id?: string;
  shareKind?: ShareKind;
  share_kind?: ShareKind;
  permission?: SharePermission;
  canEdit?: boolean;
  can_edit?: boolean;
  createdAt?: string | null;
  created_at?: string | null;
};

const toShareRow = (raw: ShareRowInput): SavedQueryShareRow => {
  const principalType = (raw.principalType ??
    raw.principal_type ??
    raw.shareKind ??
    raw.share_kind ??
    "WORKSPACE") as ShareKind;
  const canEdit = raw.canEdit ?? raw.can_edit ?? raw.permission === "WRITE";
  const permission = (raw.permission ?? (canEdit ? "WRITE" : "READ")) as SharePermission;
  return {
    aclId: raw.aclId ?? raw.acl_id ?? "",
    principalType,
    principalId: raw.principalId ?? raw.principal_id ?? "",
    permission,
    canEdit: Boolean(canEdit),
    createdAt: raw.createdAt ?? raw.created_at ?? null,
  };
};

export async function fetchSavedQueryShares(
  queryId: string
): Promise<{ queryId: string; shares: SavedQueryShareRow[] }> {
  const res = await api.get(`/saved-queries/${queryId}/shares`);
  const data = res.data ?? {};
  const shares = Array.isArray(data.shares) ? data.shares.map((r: ShareRowInput) => toShareRow(r)) : [];
  return { queryId: data.queryId ?? queryId, shares };
}

export async function shareSavedQueryToWorkspace(queryId: string, canEdit: boolean) {
  const res = await api.post(`/saved-queries/${queryId}/shares`, {
    shareKind: "WORKSPACE",
    canEdit,
  });
  return res.data;
}

export async function shareSavedQueryToUser(queryId: string, sharedWithUserId: string, canEdit: boolean) {
  const res = await api.post(`/saved-queries/${queryId}/shares`, {
    shareKind: "USER",
    sharedWithUserId,
    canEdit,
  });
  return res.data;
}

export async function unshareSavedQueryFromWorkspace(queryId: string) {
  const res = await api.delete(`/saved-queries/${queryId}/shares`, {
    data: { shareKind: "WORKSPACE" },
  });
  return res.data;
}

export async function unshareSavedQueryFromUser(queryId: string, sharedWithUserId: string) {
  const res = await api.delete(`/saved-queries/${queryId}/shares`, {
    data: { shareKind: "USER", sharedWithUserId },
  });
  return res.data;
}
