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

function resolvePrincipalType(raw: ShareRowInput): ShareKind {
  return (
    raw.principalType ??
    raw.principal_type ??
    raw.shareKind ??
    raw.share_kind ??
    "WORKSPACE"
  );
}

function resolveCanEdit(raw: ShareRowInput): boolean {
  if (typeof raw.canEdit === "boolean") return raw.canEdit;
  if (typeof raw.can_edit === "boolean") return raw.can_edit;
  return raw.permission === "WRITE";
}

function resolvePermission(raw: ShareRowInput, canEdit: boolean): SharePermission {
  return (raw.permission ?? (canEdit ? "WRITE" : "READ")) as SharePermission;
}

function toShareRow(raw: ShareRowInput): SavedQueryShareRow {
  const principalType = resolvePrincipalType(raw);
  const canEdit = resolveCanEdit(raw);
  const permission = resolvePermission(raw, canEdit);

  return {
    aclId: raw.aclId ?? raw.acl_id ?? "",
    principalType,
    principalId: raw.principalId ?? raw.principal_id ?? "",
    permission,
    canEdit,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
  };
}

export async function fetchSavedQueryShares(
  queryId: string
): Promise<{ queryId: string; shares: SavedQueryShareRow[] }> {
  const response = await api.get(`/saved-queries/${queryId}/shares`);
  const payload = response.data ?? {};
  const rawShares = Array.isArray(payload.shares) ? payload.shares : [];

  return {
    queryId: payload.queryId ?? queryId,
    shares: rawShares.map((row: ShareRowInput) => toShareRow(row)),
  };
}

export async function shareSavedQueryToWorkspace(queryId: string, canEdit: boolean) {
  const response = await api.post(`/saved-queries/${queryId}/shares`, {
    shareKind: "WORKSPACE",
    canEdit,
  });
  return response.data;
}

export async function unshareSavedQueryFromWorkspace(queryId: string) {
  const response = await api.delete(`/saved-queries/${queryId}/shares`, {
    data: { shareKind: "WORKSPACE" },
  });
  return response.data;
}
