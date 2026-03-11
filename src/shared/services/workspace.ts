import { Workspace, WorkspaceDetail, UserWorkspaceDetails } from "../../domain-model/Workspace";
import { workspaceClient } from "./clients/workspaceClient";

export type WorkspaceExternalLink = {
  key: string;
  label: string;
  url: string;
  provider: string;
  is_default: boolean;
};

export type WorkspaceExternalLinksResponse = {
  workspace_id: string;
  datasource_type: string | null;
  links: WorkspaceExternalLink[];
};

function logWorkspaceError(message: string, error: unknown) {
  console.error(message, error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toDefaultFlag(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value > 0 ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes") return 1;
  }
  return 0;
}

function toWorkspaceArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  const rows = record.rows;
  if (Array.isArray(rows)) return rows;
  const items = record.items;
  if (Array.isArray(items)) return items;
  return [];
}

function normalizeWorkspaceRow(raw: unknown): Workspace | null {
  const record = asRecord(raw);
  if (!record) return null;
  const workspace_id = toStringValue(record.workspace_id ?? record.workspaceId ?? record.id);
  if (!workspace_id) return null;
  return {
    workspace_id,
    is_default: toDefaultFlag(record.is_default ?? record.isDefault ?? record.default),
  };
}

function normalizeWorkspaceDetail(raw: unknown): WorkspaceDetail | null {
  const record = asRecord(raw);
  if (!record) return null;
  const workspace_id = toStringValue(record.workspace_id ?? record.workspaceId ?? record.id);
  if (!workspace_id) return null;
  return {
    workspace_id,
    name: toStringValue(record.name ?? record.workspace_name ?? record.workspaceName ?? workspace_id) || workspace_id,
    server: toStringValue(record.server ?? record.host ?? record.host_url ?? "-") || "-",
  };
}

async function fetchUserWorkspaceRows(user_id: string): Promise<Workspace[]> {
  const response = await workspaceClient.listUserWorkspaces(user_id);
  return toWorkspaceArray(response.data)
    .map(normalizeWorkspaceRow)
    .filter((item): item is Workspace => Boolean(item));
}

function normalizeWorkspaceId(value: unknown): string {
  return String(value ?? "").trim();
}

function toWorkspaceDetailMap(workspaces: WorkspaceDetail[]): Map<string, WorkspaceDetail> {
  const map = new Map<string, WorkspaceDetail>();
  workspaces.forEach((workspace) => {
    const id = normalizeWorkspaceId(workspace.workspace_id);
    if (id) {
      map.set(id, workspace);
    }
  });
  return map;
}

function findDefaultWorkspace(workspaces: Workspace[]): Workspace | null {
  return workspaces.find((workspace) => workspace.is_default === 1) ?? null;
}

export const fetchWorkspaceInfo = async (
  user_id: string
): Promise<WorkspaceDetail | null> => {
  try {
    const [workspaces, allWorkspaceDetails] = await Promise.all([
      fetchUserWorkspaceRows(user_id),
      fetchWorkspaces(),
    ]);
    const defaultWorkspace = findDefaultWorkspace(workspaces);
    if (!defaultWorkspace) return null;
    const byId = toWorkspaceDetailMap(allWorkspaceDetails);
    return byId.get(String(defaultWorkspace.workspace_id)) ?? null;
  } catch (error) {
    logWorkspaceError(`Failed to fetch workspace info for user ${user_id}:`, error);
    return null;
  }
};

export const fetchUserWorkspaces = async (user_id: string): Promise<Workspace[]> => {
  try {
    return await fetchUserWorkspaceRows(user_id);
  } catch (error) {
    logWorkspaceError("Error fetching user workspaces", error);
    return [];
  }
};

export const fetchWorkspaceDetails = async (
  workspace_id: string
): Promise<WorkspaceDetail | null> => {
  try {
    const details = await fetchWorkspaces();
    const byId = toWorkspaceDetailMap(details);
    return byId.get(String(workspace_id)) ?? null;
  } catch (error) {
    logWorkspaceError("Failed to retrieve workspace", error);
    return null;
  }
};

export const getUserWorkspaceDetails = async (
  user_id: string
): Promise<UserWorkspaceDetails[]> => {
  const [workspaces, allWorkspaceDetails] = await Promise.all([
    fetchUserWorkspaces(user_id),
    fetchWorkspaces(),
  ]);
  const byId = toWorkspaceDetailMap(allWorkspaceDetails);

  const details = await Promise.all(
    workspaces.map(async (workspace) => {
      try {
        const detail = byId.get(String(workspace.workspace_id)) ?? null;
        if (!detail) {
          return {
            workspace_id: workspace.workspace_id,
            name: workspace.workspace_id,
            server: "-",
            is_default: workspace.is_default,
          } as UserWorkspaceDetails;
        }

        return {
          workspace_id: detail.workspace_id,
          name: detail.name,
          server: detail.server,
          is_default: workspace.is_default,
        } as UserWorkspaceDetails;
      } catch (error) {
        logWorkspaceError("Failed mapping workspace detail", error);
        return null;
      }
    })
  );

  return details
    .filter((item): item is UserWorkspaceDetails => item !== null)
    .sort((a, b) => a.server.localeCompare(b.server));
};

export const setUserWorkspace = async (user_id: string, workspace_id: string) => {
  const payload = {
    user_id,
    workspace_id,
    is_default: true,
  };

  try {
    const response = await workspaceClient.setDefaultWorkspace(payload);
    return response.data;
  } catch (error) {
    logWorkspaceError("Could not update workspace:", error);
    throw error;
  }
};

export const fetchWorkspaces = async (): Promise<WorkspaceDetail[]> => {
  try {
    const response = await workspaceClient.listWorkspaces();
    return toWorkspaceArray(response.data)
      .map(normalizeWorkspaceDetail)
      .filter((item): item is WorkspaceDetail => Boolean(item));
  } catch (error) {
    logWorkspaceError("Could not retrieve workspaces", error);
    throw error;
  }
};

function normalizeExternalLink(raw: unknown): WorkspaceExternalLink | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const key = String(record.key ?? "").trim();
  const label = String(record.label ?? "").trim();
  const url = String(record.url ?? "").trim();
  if (!label || !url) return null;
  return {
    key,
    label,
    url,
    provider: String(record.provider ?? "").trim(),
    is_default: Boolean(record.is_default),
  };
}

export const fetchWorkspaceExternalLinks = async (
  workspaceId: string
): Promise<WorkspaceExternalLinksResponse> => {
  const normalizedWorkspaceId = String(workspaceId ?? "").trim();
  if (!normalizedWorkspaceId) {
    return {
      workspace_id: "",
      datasource_type: null,
      links: [],
    };
  }

  try {
    const response = await workspaceClient.getWorkspaceExternalLinks(normalizedWorkspaceId);
    const payload = response.data as Record<string, unknown>;
    const linksRaw = Array.isArray(payload.links) ? payload.links : [];
    return {
      workspace_id: String(payload.workspace_id ?? normalizedWorkspaceId),
      datasource_type:
        payload.datasource_type == null ? null : String(payload.datasource_type ?? "").trim() || null,
      links: linksRaw.map(normalizeExternalLink).filter((item): item is WorkspaceExternalLink => Boolean(item)),
    };
  } catch (error) {
    logWorkspaceError("Failed to fetch workspace external links", error);
    throw error;
  }
};
