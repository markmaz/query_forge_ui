import axios from "axios";
import api from "@/shared/services/api";
import { fetchRoles } from "@/shared/services/roles";
import { fetchUserInfo, fetchUsers } from "@/shared/services/users";
import type { UserProfile } from "@/domain-model/Users";
import {
  FEATURE_BY_KEY,
  FEATURE_DEFINITIONS,
  inferRoleAccessLevel,
  inferRoleCategory,
  inferRoleFeatureKey,
  normalizeRoleDisplayName,
} from "./constants";
import type {
  AccessFeatureKey,
  AccessRoleDefinition,
  AccessUserOption,
  EffectiveAccessEntry,
  WorkspaceFeatureEntitlement,
  WorkspaceOnboardingPayload,
  WorkspaceReadiness,
  WorkspaceRoleAssignment,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function getRows(payload: unknown): unknown[] {
  const record = asRecord(payload);
  return asArray(record.rows ?? record.data ?? record.items ?? record.roles ?? record.features ?? record.assignments);
}

function toError(error: unknown, fallback: string): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error(fallback);
  }
  const payload = error.response?.data as { error?: string; message?: string } | undefined;
  const message = payload?.error ?? payload?.message ?? error.message ?? fallback;
  const next = new Error(message) as Error & { status?: number };
  next.status = error.response?.status;
  return next;
}

function normalizeRole(raw: unknown): AccessRoleDefinition {
  const record = asRecord(raw);
  const roleId = asString(record.role_id ?? record.id) ?? asString(record.role_key) ?? "";
  const roleKey = asString(record.role_key ?? record.role_name ?? record.name) ?? roleId;
  const featureKeyRaw = asString(record.feature_key);
  const featureKey = (featureKeyRaw && FEATURE_BY_KEY.has(featureKeyRaw as AccessFeatureKey)
    ? (featureKeyRaw as AccessFeatureKey)
    : inferRoleFeatureKey(roleKey)) ?? null;

  return {
    role_id: roleId,
    role_key: roleKey,
    role_name: asString(record.role_name ?? record.name) ?? roleKey,
    display_name: normalizeRoleDisplayName(
      roleKey,
      asString(record.display_name ?? record.label ?? record.role_name ?? record.name),
    ),
    description: asString(record.description),
    category:
      (asString(record.category) as AccessRoleDefinition["category"] | null) ??
      inferRoleCategory(roleKey),
    feature_key: featureKey,
    access_level:
      (asString(record.access_level) as AccessRoleDefinition["access_level"] | null) ??
      inferRoleAccessLevel(roleKey),
  };
}

function normalizeAssignment(raw: unknown, userId: string, workspaceId: string): WorkspaceRoleAssignment {
  const record = asRecord(raw);
  const role = normalizeRole(record.role ?? record);
  return {
    assignment_id:
      asString(record.assignment_id ?? record.id) ?? `${userId}:${workspaceId}:${role.role_key}`,
    user_id: asString(record.user_id) ?? userId,
    workspace_id: asString(record.workspace_id),
    role_id: asString(record.role_id) ?? role.role_id ?? null,
    role_key: role.role_key,
    role_name: role.role_name,
    display_name: role.display_name,
    category: role.category,
    feature_key: role.feature_key,
    access_level: role.access_level,
    source: asString(record.source),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizeFeature(raw: unknown, workspaceId: string): WorkspaceFeatureEntitlement {
  const record = asRecord(raw);
  const featureKeyRaw = asString(record.feature_key ?? record.key ?? record.name) ?? "system";
  const featureKey = FEATURE_BY_KEY.has(featureKeyRaw as AccessFeatureKey)
    ? (featureKeyRaw as AccessFeatureKey)
    : ("system" as AccessFeatureKey);

  return {
    workspace_id: asString(record.workspace_id) ?? workspaceId,
    feature_key: featureKey,
    enabled: asBoolean(record.enabled ?? record.is_enabled, false),
    updated_at: asString(record.updated_at),
    updated_by: asString(record.updated_by),
    note: asString(record.note ?? record.description),
  };
}

function normalizeEffectiveAccess(raw: unknown): EffectiveAccessEntry[] {
  return getRows(raw).map((entry) => {
    const record = asRecord(entry);
    const featureKeyRaw = asString(record.feature_key ?? record.key) ?? "system";
    const featureKey = FEATURE_BY_KEY.has(featureKeyRaw as AccessFeatureKey)
      ? (featureKeyRaw as AccessFeatureKey)
      : ("system" as AccessFeatureKey);
    const feature = FEATURE_BY_KEY.get(featureKey);
    const accessLevel = (asString(record.access_level) as EffectiveAccessEntry["access_level"] | null) ?? "none";
    const status = (asString(record.status) as EffectiveAccessEntry["status"] | null) ?? "no_role";
    return {
      feature_key: featureKey,
      feature_name: feature?.label ?? featureKey,
      feature_enabled: asBoolean(record.feature_enabled ?? record.enabled, false),
      access_level: accessLevel,
      status,
      assigned_role_key: asString(record.assigned_role_key ?? record.role_key),
      assigned_role_name: asString(record.assigned_role_name ?? record.role_name),
      message: asString(record.message) ?? "",
    };
  });
}

function normalizeReadiness(raw: unknown, workspaceId: string): WorkspaceReadiness {
  const record = asRecord(raw);
  return {
    workspace_id: asString(record.workspace_id) ?? workspaceId,
    workspace_name: asString(record.workspace_name),
    has_workspace_admin: asBoolean(record.has_workspace_admin, false),
    enabled_feature_count: Number(record.enabled_feature_count ?? 0),
    super_user_present: asBoolean(record.super_user_present, false),
    setup_complete: asBoolean(record.setup_complete, false),
    completed_steps: asArray(record.completed_steps).map((entry) => String(entry)),
    missing_steps: asArray(record.missing_steps).map((entry) => String(entry)),
  };
}

export function buildEffectiveAccessSummary(
  assignments: WorkspaceRoleAssignment[],
  features: WorkspaceFeatureEntitlement[],
): EffectiveAccessEntry[] {
  const hasWorkspaceAdmin = assignments.some((assignment) => assignment.role_key === "workspace_admin");

  return FEATURE_DEFINITIONS.map((feature) => {
    const featureEnabled = features.find((entry) => entry.feature_key === feature.key)?.enabled ?? false;
    const scopedRoles = assignments
      .filter((assignment) => assignment.feature_key === feature.key)
      .sort((left, right) => {
        const score = { admin: 3, user: 2, viewer: 1, none: 0 } as const;
        return score[right.access_level] - score[left.access_level];
      });

    if (!featureEnabled) {
      return {
        feature_key: feature.key,
        feature_name: feature.label,
        feature_enabled: false,
        access_level: "none",
        status: "blocked_feature",
        assigned_role_key: scopedRoles[0]?.role_key ?? null,
        assigned_role_name: scopedRoles[0]?.display_name ?? null,
        message: `${feature.label} is disabled for this workspace.`,
      } satisfies EffectiveAccessEntry;
    }

    if (hasWorkspaceAdmin) {
      return {
        feature_key: feature.key,
        feature_name: feature.label,
        feature_enabled: true,
        access_level: "admin",
        status: "granted",
        assigned_role_key: "workspace_admin",
        assigned_role_name: "Workspace Admin",
        message: "Granted through workspace_admin.",
      } satisfies EffectiveAccessEntry;
    }

    if (scopedRoles.length > 0) {
      return {
        feature_key: feature.key,
        feature_name: feature.label,
        feature_enabled: true,
        access_level: scopedRoles[0].access_level,
        status: "granted",
        assigned_role_key: scopedRoles[0].role_key,
        assigned_role_name: scopedRoles[0].display_name,
        message: `${scopedRoles[0].display_name} assigned for this workspace.`,
      } satisfies EffectiveAccessEntry;
    }

    return {
      feature_key: feature.key,
      feature_name: feature.label,
      feature_enabled: true,
      access_level: "none",
      status: "no_role",
      assigned_role_key: null,
      assigned_role_name: null,
      message: `No ${feature.label} role assigned in this workspace.`,
    } satisfies EffectiveAccessEntry;
  });
}

export async function listAccessRoles(): Promise<AccessRoleDefinition[]> {
  try {
    const { data } = await api.get("/rbac/roles");
    return getRows(data).map(normalizeRole);
  } catch (error) {
    const serviceError = toError(error, "Unable to load access roles.");
    if ((serviceError as Error & { status?: number }).status !== 404) throw serviceError;

    const roles = await fetchRoles();
    return roles.map((role) =>
      normalizeRole({
        role_id: role.role_id,
        role_key: role.role_name,
        role_name: role.role_name,
      }),
    );
  }
}

export async function listWorkspaceRoleAssignments(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRoleAssignment[]> {
  try {
    const { data } = await api.get(`/rbac/users/${userId}/roles`, {
      headers: { "X-Workspace-Id": workspaceId },
    });
    return getRows(data).map((entry) => normalizeAssignment(entry, userId, workspaceId));
  } catch (error) {
    throw toError(error, "Unable to load workspace role assignments.");
  }
}

export async function assignWorkspaceRole(
  userId: string,
  workspaceId: string,
  payload: { role_id?: string; role_key?: string },
): Promise<WorkspaceRoleAssignment> {
  const roleName = asString(payload.role_key ?? payload.role_id);
  if (!roleName) {
    throw new Error("Role name is required.");
  }
  try {
    const { data } = await api.post(
      `/rbac/users/${userId}/roles`,
      { role_name: roleName },
      { headers: { "X-Workspace-Id": workspaceId } },
    );
    return normalizeAssignment(asRecord(data).user_role ?? data, userId, workspaceId);
  } catch (error) {
    throw toError(error, "Unable to assign workspace role.");
  }
}

export async function revokeWorkspaceRole(
  userId: string,
  workspaceId: string,
  assignmentId: string,
): Promise<void> {
  try {
    await api.delete(`/rbac/users/${userId}/roles/${encodeURIComponent(assignmentId)}`, {
      headers: { "X-Workspace-Id": workspaceId },
    });
  } catch (error) {
    throw toError(error, "Unable to remove workspace role.");
  }
}

export async function listWorkspaceFeatures(workspaceId: string): Promise<WorkspaceFeatureEntitlement[]> {
  try {
    const { data } = await api.get(`/workspaces/${workspaceId}/features`, {
      headers: { "X-Workspace-Id": workspaceId },
    });
    const rows = getRows(data).map((entry) => normalizeFeature(entry, workspaceId));
    const byKey = new Map(rows.map((row) => [row.feature_key, row]));
    return FEATURE_DEFINITIONS.map(
      (feature) =>
        byKey.get(feature.key) ?? {
          workspace_id: workspaceId,
          feature_key: feature.key,
          enabled: false,
          updated_at: null,
          updated_by: null,
          note: null,
        },
    );
  } catch (error) {
    throw toError(error, "Unable to load workspace features.");
  }
}

export async function updateWorkspaceFeature(
  workspaceId: string,
  featureKey: AccessFeatureKey,
  enabled: boolean,
): Promise<WorkspaceFeatureEntitlement> {
  try {
    const { data } = enabled
      ? await api.post(
          `/workspaces/${workspaceId}/features`,
          { feature_key: featureKey },
          { headers: { "X-Workspace-Id": workspaceId } },
        )
      : await api.delete(`/workspaces/${workspaceId}/features/${featureKey}`, {
          headers: { "X-Workspace-Id": workspaceId },
        });
    return normalizeFeature(data, workspaceId);
  } catch (error) {
    throw toError(error, "Unable to update workspace feature.");
  }
}

export async function getEffectiveAccessSummary(
  userId: string,
  workspaceId: string,
): Promise<EffectiveAccessEntry[]> {
  const [assignments, features] = await Promise.all([
    listWorkspaceRoleAssignments(userId, workspaceId),
    listWorkspaceFeatures(workspaceId),
  ]);
  return buildEffectiveAccessSummary(assignments, features);
}

export async function getWorkspaceReadiness(workspaceId: string): Promise<WorkspaceReadiness> {
  try {
    const { data } = await api.get(`/workspaces/${workspaceId}/readiness`, {
      headers: { "X-Workspace-Id": workspaceId },
    });
    return normalizeReadiness(data, workspaceId);
  } catch (error) {
    throw toError(error, "Unable to load workspace readiness.");
  }
}

export async function completeWorkspaceOnboarding(
  workspaceId: string,
  payload: WorkspaceOnboardingPayload,
): Promise<WorkspaceReadiness> {
  const desired = new Set(payload.feature_keys);
  const current = await listWorkspaceFeatures(workspaceId);

  for (const feature of FEATURE_DEFINITIONS) {
    const isEnabled = current.find((entry) => entry.feature_key === feature.key)?.enabled ?? false;
    const shouldEnable = desired.has(feature.key);
    if (isEnabled === shouldEnable) continue;
    await updateWorkspaceFeature(workspaceId, feature.key, shouldEnable);
  }

  await assignWorkspaceRole(payload.workspace_admin_user_id, workspaceId, { role_key: "workspace_admin" });

  if (payload.super_user_id) {
    await assignWorkspaceRole(payload.super_user_id, workspaceId, { role_key: "super_admin" });
  }

  return getWorkspaceReadiness(workspaceId);
}

export async function searchAccessUsers(query: string): Promise<AccessUserOption[]> {
  const response = await fetchUsers("All", 50, "", "", query.trim());
  return (response.users ?? []).map((user) => ({
    user_id: user.user_id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    status: user.status,
  }));
}

export async function getAccessUser(userId: string): Promise<UserProfile | undefined> {
  return fetchUserInfo(userId);
}
