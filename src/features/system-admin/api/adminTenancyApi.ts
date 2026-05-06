import { getAccessToken } from "@/shared/runtime/accessTokenStore";
import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  DatasourceCreateRequest,
  DatasourceCreateResponse,
  DatasourceInput,
  DatasourceListParams,
  DatasourceNamespaces,
  DatasourcePatchInput,
  DatasourceTestResult,
  MembershipInput,
  MembershipPatchInput,
  OrganizationCreateRequest,
  OrganizationCreateResponse,
  OrganizationInput,
  OrganizationListParams,
  OrganizationMembershipListParams,
  TenancyBootstrapRequest,
  TenancyBootstrapResult,
  TenancyDatasource,
  TenancyId,
  TenancyMembership,
  TenancyOrganization,
  TenancyPagedResponse,
  WorkspaceBindingUpdateRequest,
  WorkspaceBindingUpdateResponse,
  WorkspaceCreateRequest,
  WorkspaceCreateResponse,
  WorkspaceBindingDetail,
  WorkspaceBindingListParams,
  WorkspaceBindingPatchInput,
  WorkspaceBindingRow,
  WorkspaceMembershipListParams,
} from "../types";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
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

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asId(value: unknown): TenancyId {
  return asString(value) ?? "";
}

function getAdminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  const workspaceId = getApiWorkspaceId();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (workspaceId) {
    headers["X-Workspace-Id"] = workspaceId;
  }

  return headers;
}

function withPagination<T extends { include_inactive?: boolean; limit?: number; offset?: number }>(
  params: T = {} as T
): Record<string, string | number> {
  const query: Record<string, string | number> = {};

  if (typeof params.include_inactive === "boolean") {
    query.include_inactive = params.include_inactive ? "true" : "false";
  }
  if (typeof params.limit === "number") {
    query.limit = params.limit;
  }
  if (typeof params.offset === "number") {
    query.offset = params.offset;
  }

  return query;
}

function getRows(record: Record<string, unknown>): unknown[] {
  if (Array.isArray(record.rows)) return record.rows;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;
  return [];
}

function buildPagedResponse<T>(
  record: Record<string, unknown>,
  rows: T[],
  fallbackLimit = 100,
  fallbackOffset = 0
): TenancyPagedResponse<T> {
  const limit = asNumber(record.limit) ?? fallbackLimit;
  const offset = asNumber(record.offset) ?? fallbackOffset;
  const total = asNumber(record.total) ?? asNumber(record.count) ?? rows.length;
  return {
    rows,
    total,
    limit,
    offset,
  };
}

function normalizeOrganization(raw: unknown): TenancyOrganization {
  const record = asRecord(raw);
  return {
    organization_id: asId(record.organization_id ?? record.id),
    name: asString(record.name) ?? "",
    slug: asString(record.slug) ?? "",
    description: asString(record.description),
    is_active: asBoolean(record.is_active, true),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizeMembership(raw: unknown): TenancyMembership {
  const record = asRecord(raw);
  return {
    membership_id: asId(record.membership_id ?? record.id),
    user_id: asString(record.user_id) ?? "",
    username: asString(record.username),
    email: asString(record.email),
    first_name: asString(record.first_name),
    last_name: asString(record.last_name),
    display_name: asString(record.display_name),
    role: asString(record.role),
    is_active: asBoolean(record.is_active, true),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizeDatasource(raw: unknown): TenancyDatasource {
  const record = asRecord(raw);
  const configRaw = record.config_json;
  return {
    datasource_id: asId(record.datasource_id ?? record.id),
    organization_id: asId(record.organization_id),
    name: asString(record.name) ?? "",
    slug: asString(record.slug) ?? "",
    type: asString(record.type) ?? "",
    description: asString(record.description),
    is_active: asBoolean(record.is_active, true),
    secret_ref: asString(record.secret_ref),
    config_json: asRecord(configRaw),
    last_test_status: asString(record.last_test_status),
    last_test_time: asString(record.last_test_time ?? record.last_tested_at),
    last_test_latency_ms: asNumber(record.last_test_latency_ms),
    last_test_message: asString(record.last_test_message),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizeDatasourceNamespaces(raw: unknown): DatasourceNamespaces {
  const record = asRecord(raw);
  return {
    datasource_id: asId(record.datasource_id ?? record.id),
    datasource_type: asString(record.datasource_type ?? record.type) ?? "",
    catalogs: asArray(record.catalogs).map((value) => asString(value) ?? "").filter(Boolean),
    schemas: asArray(record.schemas).map((value) => asString(value) ?? "").filter(Boolean),
    current_catalog: asString(record.current_catalog),
    current_schema: asString(record.current_schema),
  };
}

function normalizeWorkspaceBindingRow(raw: unknown): WorkspaceBindingRow {
  const record = asRecord(raw);
  return {
    workspace_id: asId(record.workspace_id ?? record.id),
    workspace_name: asString(record.workspace_name ?? record.name) ?? "",
    organization_id: asString(record.organization_id),
    organization_name: asString(record.organization_name),
    datasource_id: asString(record.datasource_id),
    datasource_name: asString(record.datasource_name),
    datasource_type: asString(record.datasource_type),
    workspace_is_active: asBoolean(record.workspace_is_active ?? record.is_active, true),
  };
}

function normalizeWorkspaceBindingDetail(raw: unknown): WorkspaceBindingDetail {
  const row = normalizeWorkspaceBindingRow(raw);
  const record = asRecord(raw);
  return {
    ...row,
    description: asString(record.description),
    default_catalog: asString(record.default_catalog),
    default_schema: asString(record.default_schema),
  };
}

function cleanObject<T extends Record<string, unknown>>(input: T): T {
  const next = Object.entries(input).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
  return next as T;
}

export async function listOrganizations(
  params: OrganizationListParams = {}
): Promise<TenancyPagedResponse<TenancyOrganization>> {
  const query = withPagination(params);
  if (params.q?.trim()) {
    query.q = params.q.trim();
  }

  const { data } = await api.get("/admin/organizations", {
    params: query,
    headers: getAdminHeaders(),
  });

  const record = asRecord(data);
  const rows = getRows(record).map(normalizeOrganization);
  return buildPagedResponse(record, rows, params.limit ?? 100, params.offset ?? 0);
}

export async function createOrganization(payload: OrganizationCreateRequest): Promise<OrganizationCreateResponse> {
  const { data } = await api.post(
    "/admin/organizations",
    cleanObject({
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      is_active: payload.is_active,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeOrganization(data);
}

export async function updateOrganization(
  organizationId: TenancyId,
  payload: Partial<OrganizationInput>
): Promise<TenancyOrganization> {
  const { data } = await api.patch(
    `/admin/organizations/${organizationId}`,
    cleanObject({
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      is_active: payload.is_active,
    }),
    {
      headers: getAdminHeaders(),
    }
  );
  return normalizeOrganization(data);
}

export async function deleteOrganization(organizationId: TenancyId, hard = false): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/admin/organizations/${organizationId}`, {
    params: { hard: hard ? "true" : "false" },
    headers: getAdminHeaders(),
  });
  const record = asRecord(data);
  return { deleted: asBoolean(record.deleted, true) };
}

export async function listOrganizationMemberships(
  organizationId: TenancyId,
  params: OrganizationMembershipListParams = {}
): Promise<TenancyPagedResponse<TenancyMembership>> {
  const query = withPagination(params);
  const { data } = await api.get(`/admin/organizations/${organizationId}/memberships`, {
    params: query,
    headers: getAdminHeaders(),
  });

  const record = asRecord(data);
  const rows = getRows(record).map(normalizeMembership);
  return buildPagedResponse(record, rows, params.limit ?? 100, params.offset ?? 0);
}

export async function createOrganizationMembership(
  organizationId: TenancyId,
  payload: MembershipInput
): Promise<TenancyMembership> {
  const { data } = await api.post(
    `/admin/organizations/${organizationId}/memberships`,
    cleanObject({
      user_id: payload.user_id,
      role: payload.role,
      is_active: payload.is_active,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeMembership(data);
}

export async function updateOrganizationMembership(
  organizationId: TenancyId,
  membershipId: TenancyId,
  payload: MembershipPatchInput
): Promise<TenancyMembership> {
  const { data } = await api.patch(
    `/admin/organizations/${organizationId}/memberships/${membershipId}`,
    cleanObject({
      role: payload.role,
      is_active: payload.is_active,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeMembership(data);
}

export async function deleteOrganizationMembership(
  organizationId: TenancyId,
  membershipId: TenancyId
): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/admin/organizations/${organizationId}/memberships/${membershipId}`, {
    headers: getAdminHeaders(),
  });

  const record = asRecord(data);
  return { deleted: asBoolean(record.deleted, true) };
}

export async function listOrganizationDatasources(
  organizationId: TenancyId,
  params: DatasourceListParams = {}
): Promise<TenancyPagedResponse<TenancyDatasource>> {
  const query = withPagination(params);
  const { data } = await api.get(`/admin/organizations/${organizationId}/datasources`, {
    params: query,
    headers: getAdminHeaders(),
  });

  const record = asRecord(data);
  const rows = getRows(record).map(normalizeDatasource);
  return buildPagedResponse(record, rows, params.limit ?? 100, params.offset ?? 0);
}

export async function createOrganizationDatasource(
  organizationId: TenancyId,
  payload: DatasourceCreateRequest
): Promise<DatasourceCreateResponse> {
  const { data } = await api.post(
    `/admin/organizations/${organizationId}/datasources`,
    cleanObject({
      name: payload.name,
      slug: payload.slug,
      type: payload.type,
      description: payload.description,
      is_active: payload.is_active,
      secret_ref: payload.secret_ref,
      config_json: payload.config_json,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeDatasource(data);
}

export async function createWorkspace(payload: WorkspaceCreateRequest): Promise<WorkspaceCreateResponse> {
  const { data } = await api.post(
    "/admin/workspaces",
    cleanObject({
      workspace_id: payload.workspace_id,
      organization_id: payload.organization_id,
      datasource_id: payload.datasource_id,
      name: payload.name,
      description: payload.description,
      is_active: payload.is_active,
      default_catalog: payload.default_catalog,
      default_schema: payload.default_schema,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeWorkspaceBindingDetail(data);
}

export async function deleteWorkspace(workspaceId: TenancyId, hard = false): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/admin/workspaces/${workspaceId}`, {
    params: hard ? { hard: true } : undefined,
    headers: getAdminHeaders(),
  });

  return {
    deleted: Boolean(asRecord(data).deleted),
  };
}

export async function getDatasourceNamespaces(
  datasourceId: TenancyId,
  catalog?: string | null
): Promise<DatasourceNamespaces> {
  const { data } = await api.get(`/admin/datasources/${datasourceId}/namespaces`, {
    params: catalog?.trim() ? { catalog: catalog.trim() } : undefined,
    headers: getAdminHeaders(),
  });

  return normalizeDatasourceNamespaces(data);
}

export async function updateDatasource(
  datasourceId: TenancyId,
  payload: DatasourcePatchInput
): Promise<TenancyDatasource> {
  const { data } = await api.patch(
    `/admin/datasources/${datasourceId}`,
    cleanObject({
      name: payload.name,
      slug: payload.slug,
      type: payload.type,
      description: payload.description,
      is_active: payload.is_active,
      secret_ref: payload.secret_ref,
      config_json: payload.config_json,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeDatasource(data);
}

export async function deleteDatasource(datasourceId: TenancyId, hard = false): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/admin/datasources/${datasourceId}`, {
    params: { hard: hard ? "true" : "false" },
    headers: getAdminHeaders(),
  });

  const record = asRecord(data);
  return { deleted: asBoolean(record.deleted, true) };
}

export async function testDatasource(datasourceId: TenancyId): Promise<DatasourceTestResult> {
  const { data } = await api.post(
    `/admin/datasources/${datasourceId}/test`,
    {},
    {
      headers: getAdminHeaders(),
    }
  );

  const envelope = asRecord(data);
  const nestedResult = asRecord(envelope.result);
  const record = Object.keys(nestedResult).length > 0 ? nestedResult : envelope;

  const status = asString(record.status) ?? (asBoolean(record.success) ? "ok" : "error");
  const normalizedStatus = status.trim().toLowerCase();
  const inferredSuccess = ["ok", "success", "passed", "pass"].some((token) => normalizedStatus.includes(token));
  const hasExplicitSuccess = record.success !== undefined && record.success !== null;

  return {
    status,
    success: hasExplicitSuccess ? asBoolean(record.success, inferredSuccess) : inferredSuccess,
    latency_ms: asNumber(record.latency_ms),
    message: asString(record.message),
    tested_at: asString(record.tested_at),
  };
}

export async function listWorkspaceBindings(
  params: WorkspaceBindingListParams = {}
): Promise<TenancyPagedResponse<WorkspaceBindingRow>> {
  const query = withPagination(params);
  if (params.organization_id?.trim()) {
    query.organization_id = params.organization_id.trim();
  }

  const { data } = await api.get("/admin/workspaces", {
    params: query,
    headers: getAdminHeaders(),
  });

  const record = asRecord(data);
  const rows = getRows(record).map(normalizeWorkspaceBindingRow);
  return buildPagedResponse(record, rows, params.limit ?? 100, params.offset ?? 0);
}

export async function getWorkspaceBinding(workspaceId: TenancyId): Promise<WorkspaceBindingDetail> {
  const { data } = await api.get(`/admin/workspaces/${workspaceId}/binding`, {
    headers: getAdminHeaders(),
  });

  return normalizeWorkspaceBindingDetail(data);
}

export async function updateWorkspaceBinding(
  workspaceId: TenancyId,
  payload: WorkspaceBindingPatchInput
): Promise<WorkspaceBindingDetail> {
  const { data } = await api.patch(
    `/admin/workspaces/${workspaceId}/binding`,
    cleanObject({
      organization_id: payload.organization_id,
      datasource_id: payload.datasource_id,
      name: payload.name,
      description: payload.description,
      is_active: payload.is_active,
      default_catalog: payload.default_catalog,
      default_schema: payload.default_schema,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeWorkspaceBindingDetail(data);
}

export async function bindWorkspace(
  workspaceId: TenancyId,
  payload: WorkspaceBindingUpdateRequest
): Promise<WorkspaceBindingUpdateResponse> {
  const { data } = await api.patch(
    `/admin/workspaces/${workspaceId}/binding`,
    cleanObject({
      datasource_id: payload.datasource_id,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeWorkspaceBindingDetail(data);
}

export async function listWorkspaceMemberships(
  workspaceId: TenancyId,
  params: WorkspaceMembershipListParams = {}
): Promise<TenancyPagedResponse<TenancyMembership>> {
  const query = withPagination(params);
  const { data } = await api.get(`/admin/workspaces/${workspaceId}/memberships`, {
    params: query,
    headers: getAdminHeaders(),
  });

  const record = asRecord(data);
  const rows = getRows(record).map(normalizeMembership);
  return buildPagedResponse(record, rows, params.limit ?? 100, params.offset ?? 0);
}

export async function createWorkspaceMembership(
  workspaceId: TenancyId,
  payload: MembershipInput
): Promise<TenancyMembership> {
  const { data } = await api.post(
    `/admin/workspaces/${workspaceId}/memberships`,
    cleanObject({
      user_id: payload.user_id,
      role: payload.role,
      is_active: payload.is_active,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeMembership(data);
}

export async function updateWorkspaceMembership(
  workspaceId: TenancyId,
  membershipId: TenancyId,
  payload: MembershipPatchInput
): Promise<TenancyMembership> {
  const { data } = await api.patch(
    `/admin/workspaces/${workspaceId}/memberships/${membershipId}`,
    cleanObject({
      role: payload.role,
      is_active: payload.is_active,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  return normalizeMembership(data);
}

export async function deleteWorkspaceMembership(
  workspaceId: TenancyId,
  membershipId: TenancyId
): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/admin/workspaces/${workspaceId}/memberships/${membershipId}`, {
    headers: getAdminHeaders(),
  });

  const record = asRecord(data);
  return { deleted: asBoolean(record.deleted, true) };
}

export async function bootstrapTenancy(payload: TenancyBootstrapRequest): Promise<TenancyBootstrapResult> {
  const { data } = await api.post(
    "/admin/tenancy/bootstrap",
    cleanObject({
      workspace_id: payload.workspace_id,
      organization_name: payload.organization_name,
      organization_id: payload.organization_id,
      organization_slug: payload.organization_slug,
      organization_description: payload.organization_description,
      datasource_name: payload.datasource_name,
      datasource_type: payload.datasource_type,
      datasource_slug: payload.datasource_slug,
      datasource_description: payload.datasource_description,
      datasource_secret_ref: payload.datasource_secret_ref,
      datasource_config_json: payload.datasource_config_json,
      default_catalog: payload.default_catalog,
      default_schema: payload.default_schema,
      admin_user_id: payload.admin_user_id,
    }),
    {
      headers: getAdminHeaders(),
    }
  );

  const root = asRecord(data);
  const result = asRecord(root.result);
  return {
    workspace_id: asString(result.workspace_id) ?? "",
    organization: asRecord(result.organization),
    datasource: asRecord(result.datasource),
    workspace_binding: asRecord(result.workspace_binding),
    memberships: asRecord(result.memberships),
  };
}

export function parseConfigJsonInput(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return {};
  const parsed = JSON.parse(trimmed);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error("config_json must be a JSON object.");
}

export function formatConfigJson(value: Record<string, unknown> | null | undefined): string {
  return JSON.stringify(value ?? {}, null, 2);
}

export function flattenWorkspaceBindingsRows(
  input: TenancyPagedResponse<WorkspaceBindingRow> | WorkspaceBindingRow[]
): WorkspaceBindingRow[] {
  if (Array.isArray(input)) return input;
  return asArray(input.rows).map(normalizeWorkspaceBindingRow);
}
