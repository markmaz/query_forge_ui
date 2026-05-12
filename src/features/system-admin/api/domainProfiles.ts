import axios from "axios";
import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  DomainProfile,
  DomainProfileCreateRequest,
  DomainProfileUpdateRequest,
  DomainProfileListResponse,
  DomainProfileDeleteResponse,
  DomainProfileGenerateRequest,
  DomainProfileGenerateBatchRequest,
  DomainProfileGenerateAllRequest,
  DomainProfileMetricsResponse,
  DomainProfileMetricConfigRow,
  DomainProfileMetricColumnOption,
  DomainProfileMetricAgg,
  DomainProfileMetricKind,
  DomainTimePolicyResponse,
  DomainTimePolicy,
  DomainCalendarMode,
  DomainWeekStart,
  DomainDefaultGrain,
  DomainSemesterBucket,
} from "../types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function workspaceRequestConfig() {
  const workspaceId = getApiWorkspaceId();
  if (!workspaceId) return {};
  return {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  };
}

export function parseDomainProfileApiError(
  error: unknown,
  fallbackMessage: string,
): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as
      | { error?: string; message?: string; detail?: string }
      | undefined;
    if (status === 403) {
      return new Error("Admin access required");
    }
    const apiMessage = data?.error ?? data?.message ?? data?.detail;
    if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
      return new Error(apiMessage.trim());
    }
    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return new Error(error.message.trim());
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new Error(error.message.trim());
  }

  return new Error(fallbackMessage);
}

function toTagLabel(value: unknown): string | null {
  const primitive = asString(value);
  if (primitive) return primitive;

  const record = asRecord(value);
  if (!record) return null;

  const label =
    asString(record.label) ??
    asString(record.metric_key) ??
    asString(record.column_key) ??
    asString(record.sql_metric) ??
    asString(record.name) ??
    asString(record.term) ??
    asString(record.key) ??
    asString(record.value);
  if (label) return label;

  const agg = asString(record.agg);
  const columnKey = asString(record.column_key);
  if (agg && columnKey) return `${agg}(${columnKey})`;

  return null;
}

function toTagArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const tags = value.map(toTagLabel).filter((entry): entry is string => Boolean(entry));
  return tags.length > 0 ? tags : [];
}

function normalizeDomainProfile(raw: unknown): DomainProfile {
  const row = asRecord(raw) ?? {};

  const synonymsRaw = Array.isArray(row.synonyms) ? row.synonyms : [];
  const acronymsRaw = Array.isArray(row.acronyms) ? row.acronyms : [];

  return {
    id: Number(row.id ?? 0),
    workspace_id: asString(row.workspace_id) ?? "",
    domain_id: Number(row.domain_id ?? 0),
    summary: asString(row.summary),
    keywords: toTagArray(row.keywords),
    entities: toTagArray(row.entities),
    metrics: toTagArray(row.metrics),
    attributes: toTagArray(row.attributes),
    synonyms: synonymsRaw
      .map((item) => {
        const s = asRecord(item);
        if (!s) return null;
        const term = asString(s.term) ?? "";
        const means = Array.isArray(s.means)
          ? s.means.map((m) => asString(m)).filter((m): m is string => Boolean(m))
          : [];
        return term ? { term, means } : null;
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    acronyms: acronymsRaw
      .map((item) => {
        const a = asRecord(item);
        if (!a) return null;
        const abbr = asString(a.abbr) ?? "";
        const expansion = asString(a.expansion) ?? "";
        return abbr && expansion ? { abbr, expansion } : null;
      })
      .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    notes: asString(row.notes),
    embedding_text: asString(row.embedding_text),
    content_hash: asString(row.content_hash),
    embedding_model: asString(row.embedding_model),
    embedded_at: asString(row.embedded_at),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    domain_name: asString(row.domain_name),
    domain_kind: asString(row.domain_kind ?? row.domainKind),
  };
}

const METRIC_KIND_VALUES = new Set<DomainProfileMetricKind>([
  "count",
  "numeric",
  "ratio",
  "custom",
]);
const METRIC_AGG_VALUES = new Set<DomainProfileMetricAgg>([
  "count",
  "count_distinct",
  "sum",
  "avg",
  "min",
  "max",
]);

function normalizeDomainProfileMetricRow(raw: unknown): DomainProfileMetricConfigRow | null {
  const record = asRecord(raw);
  if (!record) return null;

  const metricKey = asString(record.metric_key);
  const label = asString(record.label);
  const kindRaw = asString(record.kind)?.toLowerCase() as DomainProfileMetricKind | undefined;
  const aggRaw = asString(record.agg)?.toLowerCase() as DomainProfileMetricAgg | undefined;

  if (!metricKey || !label || !kindRaw || !aggRaw) return null;
  if (!METRIC_KIND_VALUES.has(kindRaw) || !METRIC_AGG_VALUES.has(aggRaw)) return null;

  const columnKey = asString(record.column_key);
  const sqlMetricRecord = asRecord(record.sql_metric);

  return {
    metric_key: metricKey,
    label,
    kind: kindRaw,
    agg: aggRaw,
    column_key: columnKey,
    sql_metric: sqlMetricRecord ?? null,
  };
}

function normalizeDomainProfileMetricsResponse(raw: unknown): DomainProfileMetricsResponse {
  const record = asRecord(raw) ?? {};
  const rows = Array.isArray(record.metrics) ? record.metrics : [];
  return {
    domain_id: Number(record.domain_id ?? 0),
    domain_name: asString(record.domain_name),
    metrics: rows
      .map(normalizeDomainProfileMetricRow)
      .filter((row): row is DomainProfileMetricConfigRow => Boolean(row)),
    has_profile: Boolean(record.has_profile),
    can_edit: Boolean(record.can_edit),
  };
}

function normalizeDomainProfileMetricColumnOption(
  raw: unknown,
): DomainProfileMetricColumnOption | null {
  const record = asRecord(raw);
  if (!record) return null;

  const workspaceTableId = Number(record.workspaceTableId ?? record.workspace_table_id);
  const columnName = asString(record.columnName ?? record.column_name);
  if (!Number.isInteger(workspaceTableId) || workspaceTableId <= 0 || !columnName) {
    return null;
  }

  const modelColumnIdRaw = Number(
    record.modelColumnId ??
      record.model_column_id ??
      record.workspaceColumnId ??
      record.workspace_column_id,
  );
  const tableName =
    asString(
      record.modelTableName ??
        record.model_table_name ??
        record.baseTableName ??
        record.base_table_name ??
        record.tableName ??
        record.table_name,
    ) ?? `wt${workspaceTableId}`;

  return {
    column_key: `wt${workspaceTableId}.${columnName}`,
    workspace_table_id: workspaceTableId,
    model_column_id:
      Number.isInteger(modelColumnIdRaw) && modelColumnIdRaw > 0 ? modelColumnIdRaw : null,
    column_name: columnName,
    table_name: tableName,
    display_name: `${tableName}.${columnName}`,
  };
}

const CALENDAR_MODE_VALUES = new Set<DomainCalendarMode>(["calendar", "fiscal", "school_year"]);
const WEEK_START_VALUES = new Set<DomainWeekStart>(["monday", "sunday"]);
const DEFAULT_GRAIN_VALUES = new Set<Exclude<DomainDefaultGrain, null>>([
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);
const SEMESTER_BUCKETS: DomainSemesterBucket[] = ["spring", "fall", "year_round"];

function normalizeSemesterMonthRange(raw: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(raw) || raw.length !== 2) {
    return fallback;
  }
  const start = Number(raw[0]);
  const end = Number(raw[1]);
  if (
    Number.isInteger(start) &&
    start >= 1 &&
    start <= 12 &&
    Number.isInteger(end) &&
    end >= 1 &&
    end <= 12
  ) {
    return [start, end];
  }
  return fallback;
}

function normalizeDomainTimePolicy(raw: unknown): DomainTimePolicy {
  const record = asRecord(raw) ?? {};
  const calendarModeRaw = asString(record.calendar_mode)?.toLowerCase() as
    | DomainCalendarMode
    | undefined;
  const weekStartRaw = asString(record.week_start)?.toLowerCase() as
    | DomainWeekStart
    | undefined;
  const defaultGrainRaw = asString(record.default_grain)?.toLowerCase() as
    | Exclude<DomainDefaultGrain, null>
    | undefined;
  const fiscalMonthRaw = Number(record.fiscal_year_start_month);
  const schoolYearStartMonthRaw = Number(record.school_year_start_month);
  const schoolYearEndMonthRaw = Number(record.school_year_end_month);
  const relativeMapRecord = asRecord(record.relative_map) ?? {};
  const semesterRecord = asRecord(record.semester) ?? {};
  const semesterLabelsRecord = asRecord(semesterRecord.labels) ?? {};
  const semesterMonthRangesRecord = asRecord(semesterRecord.month_ranges) ?? {};
  const semesterIndicatorColumnsRecord = asRecord(semesterRecord.indicator_columns) ?? {};

  const relative_map: Record<string, string> = {};
  Object.entries(relativeMapRecord).forEach(([key, value]) => {
    const normalizedKey = key.trim();
    const normalizedValue = asString(value);
    if (normalizedKey && normalizedValue) {
      relative_map[normalizedKey] = normalizedValue;
    }
  });

  const semester: DomainTimePolicy["semester"] = {
    labels: {
      spring: "Spring",
      fall: "Fall",
      year_round: "Year Round",
    },
    month_ranges: {
      spring: [1, 5],
      fall: [8, 12],
      year_round: [6, 7],
    },
    indicator_columns: {},
  };
  SEMESTER_BUCKETS.forEach((bucket) => {
    const label = asString(semesterLabelsRecord[bucket]);
    if (label) {
      semester.labels[bucket] = label;
    }
    semester.month_ranges[bucket] = normalizeSemesterMonthRange(
      semesterMonthRangesRecord[bucket],
      semester.month_ranges[bucket],
    );
    const indicatorColumn = asString(semesterIndicatorColumnsRecord[bucket]);
    if (indicatorColumn) {
      semester.indicator_columns[bucket] = indicatorColumn;
    }
  });

  return {
    calendar_mode: CALENDAR_MODE_VALUES.has(calendarModeRaw ?? "calendar")
      ? (calendarModeRaw as DomainCalendarMode)
      : "calendar",
    fiscal_year_start_month:
      Number.isInteger(fiscalMonthRaw) && fiscalMonthRaw >= 1 && fiscalMonthRaw <= 12
        ? fiscalMonthRaw
        : null,
    school_year_start_month:
      Number.isInteger(schoolYearStartMonthRaw) &&
      schoolYearStartMonthRaw >= 1 &&
      schoolYearStartMonthRaw <= 12
        ? schoolYearStartMonthRaw
        : null,
    school_year_end_month:
      Number.isInteger(schoolYearEndMonthRaw) &&
      schoolYearEndMonthRaw >= 1 &&
      schoolYearEndMonthRaw <= 12
        ? schoolYearEndMonthRaw
        : null,
    timezone: asString(record.timezone),
    week_start: WEEK_START_VALUES.has(weekStartRaw ?? "monday")
      ? (weekStartRaw as DomainWeekStart)
      : "monday",
    default_time_concept_key: asString(record.default_time_concept_key),
    allow_relative_ranges: Boolean(record.allow_relative_ranges),
    default_grain:
      defaultGrainRaw && DEFAULT_GRAIN_VALUES.has(defaultGrainRaw)
        ? defaultGrainRaw
        : null,
    prefer_time_object_over_filter: Boolean(record.prefer_time_object_over_filter),
    strict_mode: Boolean(record.strict_mode),
    relative_map,
    semester,
    notes: asString(record.notes),
  };
}

function defaultDomainTimePolicy(): DomainTimePolicy {
  return {
    calendar_mode: "calendar",
    fiscal_year_start_month: null,
    school_year_start_month: null,
    school_year_end_month: null,
    timezone: null,
    week_start: "monday",
    default_time_concept_key: null,
    allow_relative_ranges: true,
    default_grain: null,
    prefer_time_object_over_filter: true,
    strict_mode: false,
    relative_map: {},
    semester: {
      labels: {
        spring: "Spring",
        fall: "Fall",
        year_round: "Year Round",
      },
      month_ranges: {
        spring: [1, 5],
        fall: [8, 12],
        year_round: [6, 7],
      },
      indicator_columns: {},
    },
    notes: null,
  };
}

function normalizeDomainTimePolicyResponse(raw: unknown): DomainTimePolicyResponse {
  const record = asRecord(raw) ?? {};
  const normalizedPolicy = normalizeDomainTimePolicy(record.policy);
  const fallbackPolicy = defaultDomainTimePolicy();
  return {
    domain_id: Number(record.domain_id ?? 0),
    domain_name: asString(record.domain_name),
    has_policy: Boolean(record.has_policy),
    can_edit: Boolean(record.can_edit),
    policy: {
      ...fallbackPolicy,
      ...normalizedPolicy,
    },
  };
}

export async function listDomainProfiles(): Promise<DomainProfileListResponse> {
  const { data } = await api.get<DomainProfileListResponse>("/admin/domain-profiles");
  const rows = Array.isArray((data as any)?.profiles)
    ? (data as any).profiles
    : Array.isArray((data as any)?.rows)
      ? (data as any).rows
      : [];
  return {
    profiles: rows.map(normalizeDomainProfile),
    count: Number((data as any)?.count ?? rows.length),
  };
}

export async function getDomainProfile(
  domainId: number
): Promise<DomainProfile> {
  const { data } = await api.get<DomainProfile>(
    `/admin/domain-profiles/${domainId}`
  );
  return normalizeDomainProfile(data);
}

export async function createDomainProfile(
  body: DomainProfileCreateRequest
): Promise<DomainProfile> {
  const { data } = await api.post<DomainProfile>(
    "/admin/domain-profiles",
    body
  );
  return normalizeDomainProfile(data);
}

export async function updateDomainProfile(
  domainId: number,
  body: DomainProfileUpdateRequest
): Promise<DomainProfile> {
  const { data } = await api.put<DomainProfile>(
    `/admin/domain-profiles/${domainId}`,
    body
  );
  return normalizeDomainProfile(data);
}

export async function deleteDomainProfile(
  domainId: number
): Promise<DomainProfileDeleteResponse> {
  const { data } = await api.delete<DomainProfileDeleteResponse>(
    `/admin/domain-profiles/${domainId}`
  );
  return data;
}

export async function generateDomainProfile(
  domainId: number,
  payload: DomainProfileGenerateRequest = {},
): Promise<unknown> {
  try {
    const { data } = await api.post(
      `/domain-profiles/${domainId}/generate`,
      { force: Boolean(payload.force) },
      workspaceRequestConfig(),
    );
    return data;
  } catch (error) {
    throw parseDomainProfileApiError(error, "Unable to generate domain profile.");
  }
}

export async function generateDomainProfilesBatch(
  payload: DomainProfileGenerateBatchRequest,
): Promise<unknown> {
  try {
    const { data } = await api.post(
      "/domain-profiles/generate",
      {
        domain_ids: payload.domain_ids,
        force: Boolean(payload.force),
      },
      workspaceRequestConfig(),
    );
    return data;
  } catch (error) {
    throw parseDomainProfileApiError(error, "Unable to generate selected domain profiles.");
  }
}

export async function generateAllDomainProfiles(
  payload: DomainProfileGenerateAllRequest = {},
): Promise<unknown> {
  try {
    const { data } = await api.post(
      "/domain-profiles/generate-all",
      {
        force: Boolean(payload.force),
        include_inactive: Boolean(payload.include_inactive),
      },
      workspaceRequestConfig(),
    );
    return data;
  } catch (error) {
    throw parseDomainProfileApiError(error, "Unable to generate all domain profiles.");
  }
}

export async function getDomainProfileMetrics(
  domainId: number,
): Promise<DomainProfileMetricsResponse> {
  try {
    const { data } = await api.get(
      `/domains/${domainId}/profile-metrics`,
      workspaceRequestConfig(),
    );
    return normalizeDomainProfileMetricsResponse(data);
  } catch (error) {
    throw parseDomainProfileApiError(error, "Unable to load domain profile metrics.");
  }
}

export async function updateDomainProfileMetrics(
  domainId: number,
  metrics: DomainProfileMetricConfigRow[],
): Promise<DomainProfileMetricsResponse> {
  try {
    const { data } = await api.put(
      `/domains/${domainId}/profile-metrics`,
      { metrics },
      workspaceRequestConfig(),
    );
    return normalizeDomainProfileMetricsResponse(data);
  } catch (error) {
    throw parseDomainProfileApiError(error, "Unable to update domain profile metrics.");
  }
}

export async function getDomainProfileMetricColumns(
  domainId: number,
): Promise<DomainProfileMetricColumnOption[]> {
  try {
    const limit = 500;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    const byKey = new Map<string, DomainProfileMetricColumnOption>();

    while (offset < total) {
      const { data } = await api.get(
        "/domains/columns",
        {
          ...workspaceRequestConfig(),
          params: {
            domain_id: domainId,
            limit,
            offset,
          },
        },
      );

      const record = asRecord(data) ?? {};
      const rows = Array.isArray(record.rows) ? record.rows : [];
      rows
        .map(normalizeDomainProfileMetricColumnOption)
        .filter((row): row is DomainProfileMetricColumnOption => Boolean(row))
        .forEach((row) => {
          if (!byKey.has(row.column_key)) byKey.set(row.column_key, row);
        });

      const responseTotal = Number(record.total ?? rows.length);
      total = Number.isFinite(responseTotal) && responseTotal >= 0 ? responseTotal : rows.length;
      if (rows.length < limit) break;
      offset += rows.length;
    }

    return Array.from(byKey.values()).sort((a, b) =>
      a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
    );
  } catch (error) {
    throw parseDomainProfileApiError(error, "Unable to load domain columns.");
  }
}

export async function getDomainTimePolicy(
  domainId: number,
): Promise<DomainTimePolicyResponse> {
  try {
    const { data } = await api.get(
      `/domains/${domainId}/time-policy`,
      workspaceRequestConfig(),
    );
    return normalizeDomainTimePolicyResponse(data);
  } catch (error) {
    throw parseDomainProfileApiError(error, "Unable to load domain time policy.");
  }
}

export async function updateDomainTimePolicy(
  domainId: number,
  policy: DomainTimePolicy,
): Promise<DomainTimePolicyResponse> {
  try {
    const { data } = await api.put(
      `/domains/${domainId}/time-policy`,
      { policy },
      workspaceRequestConfig(),
    );
    return normalizeDomainTimePolicyResponse(data);
  } catch (error) {
    throw parseDomainProfileApiError(error, "Unable to update domain time policy.");
  }
}
