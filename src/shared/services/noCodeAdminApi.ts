import api from "./api";
import { SqlQueryJson } from "../../features/query-forge/model/sqlJson";

/** -----------------------------
 * Helpers
 * ----------------------------- */

function unwrapRows<T>(data: any): T[] {
  const rows = data?.rows;
  return Array.isArray(rows) ? rows : [];
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return false;
}

function pickNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toEnumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (value === undefined || value === null) return null;
  const upper = String(value).toUpperCase();
  return (allowed as readonly string[]).includes(upper) ? (upper as T) : null;
}

/** -----------------------------
 * MODEL (GLOBAL)  /models/*
 * ----------------------------- */

/**
 * What your Flask services tend to return (snake_case)
 * (If your service returns slightly different keys, adjust these 1-2 lines and you're done.)
 */
// ✅ correct
export type ModelColumnRow = {
  id: number;
  modelTableId: number;
  tableName: string;
  columnName: string;
  dataType: string | null;
  description: string | null;
  isActive: boolean;
};

// UI-friendly camelCase (optional, but keeps your existing UI code happy)
export type UiModelColumnRow = {
  id: number;
  modelTableId: number | null;
  tableName: string;
  columnName: string;
  dataType: string | null;
  description: string | null;
  isActive: boolean;
};

export type ValueOverrideVisibilityRow = {
  id?: string | number;
  listId?: string;
  listName?: string;
  listType?: "regions" | "npiCategories" | "serviceLines";
  rowCount?: number;
  updatedAt?: string | null;
  owner?: string;
  isShared?: boolean;
  [key: string]: any;
};

export type ValueOverrideVisibilityIndex = {
  regions: ValueOverrideVisibilityRow[];
  npiCategories: ValueOverrideVisibilityRow[];
  serviceLines: ValueOverrideVisibilityRow[];
};

export type ValueOverrideVisibilityResponse = {
  index: ValueOverrideVisibilityIndex;
  hasShared: boolean;
};

export type CohortVisibilityRow = {
  queryId: string;
  title: string;
  prompt?: string | null;
  updatedAt?: string | null;
  accessVia?: string | null;
  cohortName?: string | null;
  cohortNameSnake?: string | null;
  cohortOwnerUserId?: string | null;
  [key: string]: any;
};

export type CohortVisibilityResponse = {
  cohorts: CohortVisibilityRow[];
  hasShared: boolean;
};

export async function getVisibleValueOverrides(
  includeExpired: boolean
): Promise<ValueOverrideVisibilityResponse> {
  const res = await api.get(`/value_overrides/visibility?include_expired=${includeExpired ? 1 : 0}`);
  return res.data as ValueOverrideVisibilityResponse;
}

export async function getVisibleCohorts(): Promise<CohortVisibilityResponse> {
  const res = await api.get("/saved-queries/cohorts/visible");
  return res.data as CohortVisibilityResponse;
}

export type CreateModelColumnPayload = {
  // route supports tableName OR model_table_id
  tableName?: string;
  model_table_id?: number;

  columnName: string;
  dataType?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export async function uploadModel(file: File, fullReplace: boolean) {
  const fd = new FormData();
  fd.append("file", file);
  // ✅ your route expects fullReplace as query param, not form field
  const res = await api.post("/models/upload", fd, {
    params: { fullReplace: fullReplace ? "true" : "false" },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export type ModelTableRow = {
  id: number;
  name: string;
  sourceTableName: string | null;
  description: string | null;
};

export async function fetchModelTables(params: { q?: string; limit?: number; offset?: number }) {
  const res = await api.get("/models/tables", { params });
  return res.data as { rows: ModelTableRow[]; limit: number; offset: number };
}

export async function fetchModelTableNames(params: { q?: string } = {}) {
  const res = await api.get("/models/tables/names", { params });
  return res.data as { rows: string[] };
}

export async function fetchModelColumns(params: {
  q?: string;
  table?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get("/models/columns", { params });

  const data = res.data as {
    rows: ModelColumnRow[];
    tableNames?: string[];
  };

  return {
    rows: Array.isArray(data.rows) ? data.rows : [],
    tableNames: data.tableNames ?? [],
  };
}

function normalizeModelColumnRow(raw: any): ModelColumnRow | null {
  if (!raw || typeof raw !== "object") return null;

  const tableName = String(raw.tableName ?? raw.table_name ?? "").trim();
  const columnName = String(raw.columnName ?? raw.column_name ?? "").trim();
  if (!tableName || !columnName) return null;

  return {
    id: pickNumber(raw.id ?? raw.model_column_id ?? raw.column_id, -1),
    modelTableId: pickNumber(raw.modelTableId ?? raw.model_table_id ?? raw.table_id, 0),
    tableName,
    columnName,
    dataType: raw.dataType ?? raw.data_type ?? null,
    description: raw.description ?? null,
    isActive: asBool(raw.isActive ?? raw.is_active ?? raw.active ?? true),
  };
}

export async function searchModelColumns(params: { q: string; limit?: number; active?: boolean }) {
  const res = await api.get("/models/columns/search", { params });
  const rows = res.data?.rows ?? res.data;
  const normalized = Array.isArray(rows)
    ? rows
        .map((row: any) => normalizeModelColumnRow(row))
        .filter((row: ModelColumnRow | null): row is ModelColumnRow => Boolean(row))
    : [];

  return { rows: normalized };
}

export async function createModelColumn(payload: CreateModelColumnPayload) {
  const res = await api.post("/models/columns", payload);
  // route returns { row }
  const row = (res.data as any)?.row as ModelColumnRow;
  return { row: (row) };
}

export async function patchModelColumn(
  id: number,
  patch: Partial<Pick<CreateModelColumnPayload, "dataType" | "description" | "isActive">>
) {
  const res = await api.patch(`/models/columns/${id}`, patch);
  const row = (res.data as any)?.row as ModelColumnRow;
  return { row: (row) };
}

/** Samples stored on model_table (Option 2) */
export async function refreshModelSamples(params: {
  schema?: string;
  max_tables?: number;
  per_table_limit?: number;
}) {
  const res = await api.post("/models/samples/refresh", null, { params });
  return res.data;
}

export async function fetchModelTableSample(params: { model_table_id: number }) {
  const res = await api.get("/models/table-sample", { params });
  return res.data as { row: any };
}

/** -----------------------------
 * WORKSPACE INVENTORY (Admin)  /workspace-inventory/*
 * ----------------------------- */

export type ReconRow = {
  logical_table_name: string;
  column_name: string;
  status: "MATCHED" | "MISSING_IN_DICT" | "MISSING_IN_DBX" | "TYPE_MISMATCH" | "NEEDS_REVIEW";
  dict_column_id: number | null;
  dbx_column_id: number | null;
  dict_description: string | null;
  dbx_data_type: string | null;
  dict_data_type: string | null;
};

export type ReconCounts = Record<string, number>;

/**
 * ✅ renamed from syncCatalog -> syncWorkspaceInventory
 * If your route is still /catalog/sync, change the URL here.
 */
export async function syncWorkspaceInventory(schema = "asset", catalog?: string, force?: boolean) {
  const params: any = { schema };
  if (catalog) params.catalog = catalog;
  if (force) params.force = true;

  const res = await api.post("/workspace-inventory/sync", null, { params });
  return res.data;
}

export async function fetchRecon(params: {
  status?: string;
  logical_table_name?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get("/workspace-inventory/recon", { params });
  return res.data as { rows: ReconRow[] };
}

export async function fetchReconCounts() {
  const res = await api.get("/workspace-inventory/recon/counts");
  return res.data as { counts: ReconCounts };
}

export type UnmappedTableRow = {
  id: number;
  catalog_name: string;
  schema_name: string;
  table_name: string;
  full_name: string;
  variant_code: string | null;
  is_qe: boolean;
  exists_in_dbx: boolean;
  last_seen_at: string;
};

export async function fetchUnmappedTables(params: {
  schema?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get("/workspace-inventory/unmapped-tables", { params });
  return res.data as { rows: UnmappedTableRow[]; total: number; limit: number; offset: number };
}

/** -----------------------------
 * Domains (CRUD) - Admin  /domains/*
 * ----------------------------- */

export type Domain = {
  id: number;
  name: string;
  kind?: string | null;
  description?: string | null;
  column_name_policy?: "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED" | null;

  // ✅ NEW: domain is tied to a model type
  modelTableId: number | null;
  modelTableName?: string | null;

  // permissions / flags
  can_edit?: boolean;
  is_active?: boolean;
};

export type CreateDomainPayload = {
  name: string;
  kind?: string | null;
  description?: string | null;
  model_table_id?: number | null; // ✅ allow setting at create
  column_name_policy?: "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED" | null;
};

export type UpdateDomainPayload = Partial<{
  name: string;
  kind: string | null;
  description: string | null;
  is_active: boolean;
  model_table_id: number | null; // ✅ allow changing
  column_name_policy: "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED" | null;
}>;

export async function fetchDomains() {
  const res = await api.get("/domains");
  return { rows: unwrapRows<Domain>(res.data) };
}

export async function createDomain(payload: CreateDomainPayload) {
  const res = await api.post("/domains", payload);
  return res.data as { row: Domain };
}

export async function updateDomain(id: number, payload: UpdateDomainPayload) {
  const res = await api.patch(`/domains/${id}`, payload);
  return res.data as { row: Domain };
}

export async function deleteDomain(id: number) {
  const res = await api.delete(`/domains/${id}`);
  return res.data as { ok: boolean; deleted_id: number };
}

/** -----------------------------
 * Domain ↔ Workspace Tables Mapping (Admin)  /domains/*
 * ----------------------------- */

export type WorkspaceTableRow = {
  id: number; // normalized to workspace_table_id
  workspace_table_id: number;

  model_table_id: number;
  model_table_name: string;

  full_name: string;
  table_name: string;
  schema_name: string;
  catalog_name: string;

  variant_code: string | null;

  is_qe: boolean;
  exists_in_dbx?: boolean;
  last_seen_at?: string | null;

  relation_kind?: string | null;
  is_primary?: boolean;
  role?: string | null;
  table_alias?: string | null;
  sort_order?: number | null;
  filter_mode?: "AUTO" | "WHERE" | "EXISTS" | null;
  cardinality?: "ONE" | "MANY" | null;
};

type RawWorkspaceTableRow = Omit<WorkspaceTableRow, "id" | "is_qe" | "exists_in_dbx"> & {
  workspace_table_id: number;
  is_qe: boolean | number | string;
  exists_in_dbx?: boolean | number | string;
  is_primary?: boolean | number | string | null;
};

function normalizeWorkspaceTableRow(r: RawWorkspaceTableRow): WorkspaceTableRow {
  const anyRow = r as any;
  const isPrimaryRaw = r.is_primary !== undefined ? r.is_primary : anyRow.isPrimary;
  const filterModeRaw = (r as any).filter_mode ?? anyRow.filterMode ?? null;
  const cardinalityRaw = (r as any).cardinality ?? anyRow.cardinality ?? null;
  const relationKindRaw = (r as any).relation_kind ?? anyRow.relationKind ?? null;
  const roleRaw = (r as any).role ?? anyRow.role ?? null;
  const tableAliasRaw = (r as any).table_alias ?? anyRow.tableAlias ?? null;
  const sortOrderRaw = (r as any).sort_order ?? anyRow.sortOrder ?? null;
  return {
    ...r,
    id: Number(r.workspace_table_id),
    workspace_table_id: Number(r.workspace_table_id),
    is_qe: asBool(r.is_qe),
    exists_in_dbx: r.exists_in_dbx === undefined ? undefined : asBool(r.exists_in_dbx),
    is_primary: isPrimaryRaw === undefined || isPrimaryRaw === null ? undefined : asBool(isPrimaryRaw),
    last_seen_at: r.last_seen_at ?? null,
    variant_code: r.variant_code ?? null,
    relation_kind: relationKindRaw ? String(relationKindRaw).toUpperCase() : null,
    role: roleRaw === undefined ? null : roleRaw,
    table_alias: tableAliasRaw === undefined ? null : tableAliasRaw,
    sort_order:
      sortOrderRaw === undefined || sortOrderRaw === null ? null : pickNumber(sortOrderRaw, 0),
    filter_mode: toEnumValue(filterModeRaw, ["AUTO", "WHERE", "EXISTS"] as const),
    cardinality: toEnumValue(cardinalityRaw, ["ONE", "MANY"] as const),
  };
}

function normalizeWorkspaceTableRows(data: any): { rows: WorkspaceTableRow[] } {
  const rows = unwrapRows<RawWorkspaceTableRow>(data);
  return { rows: rows.map(normalizeWorkspaceTableRow) };
}

export async function fetchWorkspaceTables(params: {
  workspaceId?: string;
  q?: string;
  schema_name?: string;
  catalog_name?: string;
  only_exists_in_dbx?: boolean;
  limit?: number;
  offset?: number;
  mapped?: boolean;
}) {
  const { workspaceId: _workspaceId, ...query } = params;
  const res = await api.get("/domains/workspace-tables", { params: query });
  return normalizeWorkspaceTableRows(res.data);
}

export async function fetchWorkspaceNamespaces(workspaceId: string, catalogName?: string | null) {
  const res = await api.get(`/workspaces/${workspaceId}/namespaces`, {
    params: catalogName ? { catalog_name: catalogName } : undefined,
  });
  const data = res.data ?? {};
  return {
    schemas: Array.isArray(data.schemas) ? data.schemas : [],
    catalogs: Array.isArray(data.catalogs) ? data.catalogs : [],
  };
}

export async function fetchDomainTables(domainId: number) {
  const res = await api.get(`/domains/${domainId}/tables`);
  return normalizeWorkspaceTableRows(res.data);
}

export async function updateDomainTables(domainId: number, payload: { add: number[]; remove: number[] }) {
  const res = await api.post(`/domains/${domainId}/tables`, payload);
  return res.data as { ok: boolean };
}

export async function addDomainTable(
  domainId: number,
  payload: {
    workspaceTableId: number;
    relationKind?: "JOIN" | "UNION";
    role?: string | null;
    sortOrder?: number;
    tableAlias?: string | null;
    filterMode?: "AUTO" | "WHERE" | "EXISTS";
    cardinality?: "ONE" | "MANY";
  }
) {
  const res = await api.post(`/domains/${domainId}/tables`, payload);
  return normalizeWorkspaceTableRows(res.data);
}

export async function setDomainPrimaryTable(domainId: number, workspaceTableId: number) {
  const res = await api.patch(`/domains/${domainId}/tables/${workspaceTableId}/primary`, {
    isPrimary: true,
  });
  return normalizeWorkspaceTableRows(res.data);
}

export type DomainJoinSpecSide = {
  workspaceTableId?: number;
  columnName?: string;
  col?: string;
  expr?: string;
};

export type DomainJoinSpec = {
  on: Array<{
    left: DomainJoinSpecSide;
    op: "=";
    right: DomainJoinSpecSide;
  }>;
  extra?: string[];
};

export type DomainJoinRow = {
  id: string;
  domain_id: number;
  from_workspace_table_id: number;
  to_workspace_table_id: number;
  join_type: "LEFT" | "INNER" | "RIGHT";
  join_spec_json: DomainJoinSpec;
  sort_order: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type RawDomainJoinRow = Omit<DomainJoinRow, "join_spec_json" | "is_active"> & {
  join_spec_json: DomainJoinSpec | string | null;
  is_active: boolean | number | string;
};

function normalizeDomainJoinRow(r: RawDomainJoinRow): DomainJoinRow {
  let spec: DomainJoinSpec = { on: [] };
  if (r.join_spec_json) {
    if (typeof r.join_spec_json === "string") {
      try {
        spec = JSON.parse(r.join_spec_json) as DomainJoinSpec;
      } catch {
        spec = { on: [] };
      }
    } else {
      spec = r.join_spec_json as DomainJoinSpec;
    }
  }
  return {
    ...r,
    join_spec_json: spec,
    is_active: asBool(r.is_active),
  };
}

export async function fetchDomainJoins(domainId: number) {
  const res = await api.get(`/domains/${domainId}/joins`);
  const rows = unwrapRows<RawDomainJoinRow>(res.data).map(normalizeDomainJoinRow);
  return { rows };
}

export async function createDomainJoin(
  domainId: number,
  payload: {
    fromWorkspaceTableId: number;
    toWorkspaceTableId: number;
    joinType: "LEFT" | "INNER" | "RIGHT";
    joinSpec: DomainJoinSpec;
    sortOrder?: number;
  }
) {
  const res = await api.post(`/domains/${domainId}/joins`, payload);
  return res.data as { ok: boolean; id?: string };
}

export async function updateDomainJoin(
  domainId: number,
  joinId: string,
  payload: {
    fromWorkspaceTableId: number;
    toWorkspaceTableId: number;
    joinType: "LEFT" | "INNER" | "RIGHT";
    joinSpec: DomainJoinSpec;
    sortOrder?: number;
  }
) {
  const res = await api.patch(`/domains/${domainId}/joins/${joinId}`, payload);
  return res.data as { ok: boolean };
}

export async function deleteDomainJoin(domainId: number, joinId: string) {
  const res = await api.delete(`/domains/${domainId}/joins/${joinId}`);
  return res.data as { ok: boolean };
}

export type WorkspaceColumnRow = {
  id: number;
  workspace_table_id: number;
  column_name: string;
  data_type: string;
  ordinal_position: number;
};

type RawWorkspaceColumnRow = WorkspaceColumnRow;

export async function fetchWorkspaceTableColumns(workspaceTableId: number) {
  const res = await api.get(`/workspace-tables/${workspaceTableId}/columns`);
  const rows = unwrapRows<RawWorkspaceColumnRow>(res.data);
  return { rows };
}

/** -----------------------------
 * Builder feed (runtime)  /domains/tables + /domains/columns
 * ----------------------------- */

export type BuilderDomain = {
  id: number;
  name: string;
  kind?: string | null;
  description?: string | null;
};

export type BuilderTableRow = {
  workspace_table_id: number;
  model_table_id: number;
  model_table_name: string;
  catalog_name: string;
  schema_name: string;
  table_name: string;
  full_name: string;
  variant_code: string | null;
  is_qe: boolean;
};

// ✅ matches your backend camelCase output EXACTLY
export type BuilderColumnRow = {
  workspaceTableId: number;
  tableAlias?: string | null;
  fullName: string;
  baseTableName: string;
  schemaName: string;
  catalogName: string;
  variantCode: string | null;
  isQe: boolean;
  existsInDbx: boolean;
  lastSeenAt: string | null;

  domainId: number;
  domainName: string;

  modelTableId: number;
  modelTableName: string;

  modelColumnId: number;
  columnName: string;
  columnLabel?: string | null;
  dataType: string;
  nullable: boolean;          // backend should return true/false; if it returns 0/1 we can coerce in mapping
  ordinalPosition: number;
  description: string | null;

  sampleValuesJson: string | null;
  sampleStatsJson: string | null;
  sampleRanAt: string | null;
  sampleError: string | null;

  tableColumnCount: number;
};

export type BuilderColumnsResponse = {
  rows: BuilderColumnRow[];
  total: number;
  limit: number;
  offset: number;
  columnNamePolicy?: "DEDUP_PRIMARY_FIRST" | "SHOW_ALL_QUALIFIED";
};

// If your endpoint is /domains/columns, name it that way:
export async function fetchDomainColumns(params: {
  domain_id: number;
  table_q?: string;
  column_q?: string;
  variant_code?: string;
  only_qe?: number | boolean;
  limit?: number;
  offset?: number;
}): Promise<BuilderColumnsResponse> {
  const res = await api.get("/domains/columns", { params });
  return res.data as BuilderColumnsResponse;
}

export type BuilderTablesResponse = { rows: BuilderTableRow[] };

export async function fetchBuilderDomains() {
  const res = await api.get("/domains");
  return res.data as { rows: BuilderDomain[] };
}

export async function fetchBuilderTables(params: { domain_id?: number }) {
  const res = await api.get("/domains/tables", { params });
  return res.data as BuilderTablesResponse;
}


export type DomainTablePreview = {
  id: number;
  table_count: number;
  table_sample: string[];
};

export async function fetchDomainSummaries(params: { sample_size?: number } = {}) {
  const res = await api.get("/domains/summary", { params });
  return res.data as { rows: DomainTablePreview[] };
}


export async function fetchColumnSample(params: {
  domain_id: number;                
  workspace_table_id: number;
  column_name: string;
  limit?: number;
}) {
  const res = await api.get("/models/column-sample", { params });
  return res.data as {
    domainId: number;
    workspaceTableId: number;
    modelTableId: number;
    modelTableName: string | null;
    columnName: string;
    limit: number;
    values: Array<string | number | boolean | null>;
    sampleStatsJson: string | null;
    sampleRanAt: string | null;
    error: string | null;
  };
}

/** -----------------------------
 * Domain ↔ Users Mapping (Admin)
 * ----------------------------- */

export type DomainUserRow = {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  can_read: boolean;
  can_edit: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DomainUsersResponse = { rows: DomainUserRow[] };

export async function fetchDomainUsers(domainId: number) {
  const res = await api.get(`/domains/${domainId}/users`);
  return res.data as DomainUsersResponse;
}

export type DomainUserAdd = {
  user_id: string;
  can_edit?: boolean;
};

export type UpdateDomainUsersPayload = {
  add: DomainUserAdd[];
  remove: string[];
};

export type UpdateDomainUsersResponse = {
  ok: boolean;
  added?: number;
  removed?: number;
};

export async function updateDomainUsers(domainId: number, payload: UpdateDomainUsersPayload) {
  const res = await api.post(`/domains/${domainId}/users`, payload);
  return res.data as UpdateDomainUsersResponse;
}

/** -----------------------------
 * Workspace Users (Admin)
 * ----------------------------- */

export type WorkspaceUserRow = {
  user_id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  status: "Invited" | "Active" | "Inactive" | string;
  is_default: boolean;
};

export async function fetchWorkspaceUsers(params: {
  q?: string;
  include_inactive?: boolean;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get("/workspaces/users", { params });
  return res.data as { rows: WorkspaceUserRow[] };
}


export type NoCodeRunMode = "preview" | "export";

export type NoCodeRunResponse = {
  sql: string;
  sqlRendered?: string;
  params: Record<string, any>;
  rows?: any;
  columns: any;
  total?: number | null;
  totalRowCount?: number | null;
  export?: {
    excel?: {
      allowed?: boolean;
      maxRows?: number;
    };
  };
  limit?: number | null;
  offset: number | null;
};

export async function runNoCodeQuery(
  query: SqlQueryJson,
  mode: NoCodeRunMode = "preview",
  paging?: { limit?: number; offset?: number }
): Promise<NoCodeRunResponse> {
  const res = await api.post<NoCodeRunResponse>("/query", query, {
    params: {
      mode,
      ...(paging?.limit != null ? { limit: paging.limit } : {}),
      ...(paging?.offset != null ? { offset: paging.offset } : {}),
    },
  });
  return res.data;
}
