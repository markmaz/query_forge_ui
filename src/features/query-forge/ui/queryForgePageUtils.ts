import type { DomainColumnRef } from "../model/domainCatalog";
import {
  CANONICAL_FILTER_OPERATORS,
  normalizeFilterOperator,
  normalizeFilterValueForOperator,
} from "../model/filterOperators";
import type {
  AggFn,
  AggSpec,
  CohortAttachment,
  DerivedMetric,
  SqlAggregationsJson,
  SqlColumnKey,
  SqlColumnRef,
  SqlFilterNode,
  SqlMetricRef,
  SqlQueryJson,
  ValueOverrideAttachment,
} from "../model/sqlJson";
import { colKey } from "../model/sqlJson";
import { normalizeColumns } from "../model/columnsUtil";

export type SectionKey =
  | "prompt"
  | "suggested"
  | "domain"
  | "columns"
  | "dataprep"
  | "filters"
  | "aggs"
  | "sorting"
  | "preview";

export const SECTION_ORDER: SectionKey[] = [
  "prompt",
  "suggested",
  "domain",
  "columns",
  "dataprep",
  "filters",
  "aggs",
  "sorting",
  "preview",
];

export type QueryPathStep = {
  key: SectionKey;
  label: string;
  status: "todo" | "active" | "done";
};

export const PAGE_SIZE = 15;
export const DOMAIN_SUMMARY_SAMPLE_SIZE = 500;

export const ANIM_MS_HIDE = 320;
export const ANIM_MS_SHOW = 380;
export const PULSE_MS = 900;
export const UNLOCK_STAGGER_MS = 70;

export const INITIAL_VISIBLE_SECTIONS: Record<SectionKey, boolean> = {
  domain: true,
  prompt: false,
  suggested: false,
  columns: false,
  dataprep: false,
  filters: false,
  aggs: false,
  sorting: false,
  preview: false,
};

export const AI_COPILOT_DRAWER_INSTANCE_VERSION = 2;

export const INITIAL_SECTIONS_COLLAPSED: Record<SectionKey, boolean> = {
  domain: false,
  prompt: true,
  suggested: true,
  columns: true,
  dataprep: true,
  filters: true,
  aggs: true,
  sorting: true,
  preview: true,
};

export const nowIso = () => new Date().toISOString();

export function normalizeRoleName(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function extractRoleNamesFromProfile(user: any): string[] {
  const values = new Set<string>();

  const directRoleNames = Array.isArray(user?.rbac_role_names)
    ? user.rbac_role_names
    : [];
  directRoleNames.forEach((roleName: unknown) => {
    const normalized = normalizeRoleName(roleName);
    if (normalized) values.add(normalized);
  });

  const roleObjects = Array.isArray(user?.rbac_roles) ? user.rbac_roles : [];
  roleObjects.forEach((role: any) => {
    const normalized = normalizeRoleName(role?.role_name);
    if (normalized) values.add(normalized);
  });

  const effectiveRoleObjects = Array.isArray(user?.effective_roles)
    ? user.effective_roles
    : [];
  effectiveRoleObjects.forEach((role: any) => {
    const normalized =
      typeof role === "string"
        ? normalizeRoleName(role)
        : normalizeRoleName(role?.role_name);
    if (normalized) values.add(normalized);
  });

  return [...values];
}

export function colsSig(cols: SqlColumnRef[]) {
  return cols
    .map((c) =>
      [
        colKey(c),
        c.modelTableId ?? "",
        c.modelTableName ?? "",
        c.fullName ?? "",
        c.dataType ?? "",
        c.nullable ?? "",
        c.alias ?? "",
      ].join("|"),
    )
    .join("~~");
}

export function buildAttachmentColumnRows(sqlJson: SqlQueryJson): DomainColumnRef[] {
  const rows: DomainColumnRef[] = [];

  const addRow = (
    exprId: string,
    columnName: string,
    description: string,
    modelTableName: string,
  ) => {
    rows.push({
      modelColumnId: null,
      identityKey: `expr:${exprId}`,
      columnName,
      modelTableName,
      fullName: columnName,
      tableAlias: null,
      columnLabel: null,
      dataType: "STRING",
      nullable: true,
      description,
      workspaceTableId: 0,
      modelTableId: 0,
      baseTableName: "",
      schemaName: "",
      catalogName: "",
      domainId: sqlJson.domainId ?? 0,
      domainName: "Attachments",
      variantCode: null,
      isQe: false,
      existsInDbx: undefined,
      lastSeenAt: null,
    });
  };

  const valueOverrideAttachments = (sqlJson.value_overrideAttachments ??
    []) as ValueOverrideAttachment[];
  valueOverrideAttachments.forEach((cw) => {
    if (cw.mode !== "join") return;
    (cw.projectFields ?? []).forEach((field) => {
      const fieldKey = field.toLowerCase();
      const columnName =
        fieldKey === "region"
          ? "cw_region"
          : fieldKey === "subregion"
            ? "cw_subregion"
            : `cw_${field}`;
      const exprId = `cw:${cw.id}:cw:${field}`;
      addRow(
        exprId,
        columnName,
        `Crosswalk projected field (${field})`,
        "crosswalk",
      );
    });
  });

  const cohort = sqlJson.cohortAttachment as
    | CohortAttachment
    | null
    | undefined;
  if (cohort && cohort.mode === "join") {
    (cohort.projectFields ?? []).forEach((field) => {
      const columnName = `cohort_${field}`;
      const exprId = `cohort:${cohort.id}:cohort:${field}`;
      addRow(exprId, columnName, `Cohort projected field (${field})`, "cohort");
    });
  }

  return rows;
}

export const emptySqlJson = (): SqlQueryJson => ({
  version: 1,
  domainId: null,
  columns: [],
  prompt: "",
  dataPrep: null,
  filters: null,
  aggs: { enabled: false, metrics: [], groupBy: [], derivedMetrics: [] },
  sorting: [],
  distinct: true,
  value_overrides: { a: null, b: null, c: null },
  value_overrideAttachments: [],
  cohortAttachment: null,
  meta: {
    createdAt: nowIso(),
    updatedAt: nowIso(),
    prompt: "",
    tool: "query_builder",
  },
});

export const hasNonEmptySqlJson = (value: SqlQueryJson): boolean => {
  if (value.domainId != null) return true;
  if ((value.columns ?? []).length > 0) return true;
  if (value.filters != null) return true;
  if (value.dataPrep?.rules?.length) return true;
  if ((value.sorting ?? []).length > 0) return true;
  if (
    value.aggs?.enabled &&
    ((value.aggs.metrics ?? []).length > 0 ||
      (value.aggs.groupBy ?? []).length > 0)
  ) {
    return true;
  }
  if ((value.aggs?.derivedMetrics ?? []).length > 0) return true;
  if ((value.value_overrideAttachments ?? []).length > 0) return true;
  if (value.cohortAttachment != null) return true;
  if ((value.prompt ?? "").trim().length > 0) return true;
  if ((value.meta?.prompt ?? "").trim().length > 0) return true;
  return false;
};

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const AGG_FN_VALUES: AggFn[] = [
  "count",
  "count_distinct",
  "sum",
  "avg",
  "min",
  "max",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const META_APPLY_TDOE_SEVERITY_FILTER = "apply_tdoe_severity_filter";
const META_INCLUDE_ERROR_ROWS = "include_error_rows";

const toBooleanOrDefault = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return fallback;
};

export const getExcludeErrorRowsFromMeta = (metaRaw: unknown): boolean => {
  if (!isRecord(metaRaw)) return true;

  if (metaRaw[META_APPLY_TDOE_SEVERITY_FILTER] != null) {
    return toBooleanOrDefault(metaRaw[META_APPLY_TDOE_SEVERITY_FILTER], true);
  }

  if (metaRaw[META_INCLUDE_ERROR_ROWS] != null) {
    return !toBooleanOrDefault(metaRaw[META_INCLUDE_ERROR_ROWS], false);
  }

  return true;
};

export const applyExcludeErrorRowsMetaPreference = (
  metaRaw: Record<string, unknown> | null | undefined,
  excludeErrorRows: boolean,
): SqlQueryJson["meta"] => {
  const nextMeta = isRecord(metaRaw) ? { ...metaRaw } : {};
  delete nextMeta[META_INCLUDE_ERROR_ROWS];

  if (excludeErrorRows) {
    delete nextMeta[META_APPLY_TDOE_SEVERITY_FILTER];
  } else {
    nextMeta[META_APPLY_TDOE_SEVERITY_FILTER] = false;
  }

  return nextMeta as SqlQueryJson["meta"];
};

export const normalizeSqlMetaPayload = (
  metaRaw: unknown,
): SqlQueryJson["meta"] => {
  const excludeErrorRows = getExcludeErrorRowsFromMeta(metaRaw);
  return applyExcludeErrorRowsMetaPreference(
    isRecord(metaRaw) ? (metaRaw as Record<string, unknown>) : null,
    excludeErrorRows,
  );
};

const normalizeAggFn = (value: unknown, fallback: AggFn): AggFn =>
  typeof value === "string" && AGG_FN_VALUES.includes(value as AggFn)
    ? (value as AggFn)
    : fallback;

const normalizeSqlColumnRef = (raw: unknown): SqlColumnRef | null => {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;

  const modelColumnId = toFiniteNumberOrNull(
    source.modelColumnId ?? source.model_column_id,
  );
  const workspaceTableId = toFiniteNumberOrNull(
    source.workspaceTableId ?? source.workspace_table_id,
  );
  const exprId = toNullableString(source.exprId ?? source.expr_id);
  const alias = toNullableString(source.alias);

  const rawColumnName = toNullableString(
    source.columnName ?? source.column_name ?? source.name,
  );
  const columnName =
    rawColumnName ??
    exprId ??
    (typeof modelColumnId === "number" ? `column_${modelColumnId}` : null);
  if (!columnName) return null;

  return {
    modelColumnId,
    workspaceTableId,
    columnName,
    exprId,
    alias,
    modelTableId: toFiniteNumberOrNull(
      source.modelTableId ?? source.model_table_id,
    ),
    modelTableName: toNullableString(
      source.modelTableName ?? source.model_table_name,
    ),
    fullName: toNullableString(source.fullName ?? source.full_name),
    tableAlias: toNullableString(source.tableAlias ?? source.table_alias),
    dataType: toNullableString(source.dataType ?? source.data_type),
    nullable:
      typeof source.nullable === "boolean"
        ? source.nullable
        : source.nullable == null
          ? null
          : Boolean(source.nullable),
  };
};

const normalizeSqlColumnsPayload = (raw: unknown): SqlColumnRef[] => {
  if (!Array.isArray(raw)) return [];
  const normalized: SqlColumnRef[] = [];
  for (const candidate of raw) {
    if (isRecord(candidate)) {
      const fieldWrapped = candidate.field ?? candidate.col ?? candidate.column;
      if (fieldWrapped != null) {
        const wrapped = normalizeSqlColumnRef(fieldWrapped);
        if (wrapped) {
          const alias = toNullableString(candidate.alias);
          normalized.push(alias ? { ...wrapped, alias } : wrapped);
          continue;
        }
      }
    }
    const column = normalizeSqlColumnRef(candidate);
    if (!column) continue;
    normalized.push(column);
  }
  return normalizeColumns(normalized);
};

const normalizeSqlColumnKeyPayload = (raw: unknown): SqlColumnKey | null => {
  if (typeof raw === "string" && raw.trim()) {
    const trimmed = raw.trim();
    const workspaceMatch = trimmed.match(/^wt(\d+)\.(.+)$/i);
    if (workspaceMatch) {
      return {
        modelColumnId: null,
        workspaceTableId: Number(workspaceMatch[1]),
        columnName: workspaceMatch[2],
        exprId: null,
        alias: null,
      };
    }
    return {
      modelColumnId: null,
      workspaceTableId: null,
      columnName: trimmed,
      exprId: null,
      alias: null,
    };
  }
  const column = normalizeSqlColumnRef(raw);
  if (!column) return null;
  return {
    modelColumnId: column.modelColumnId ?? null,
    columnName: column.columnName,
    workspaceTableId: column.workspaceTableId ?? null,
    exprId: column.exprId ?? null,
    alias: column.alias ?? null,
  };
};

const normalizeSqlFilterNodePayload = (raw: unknown): SqlFilterNode | null => {
  if (!isRecord(raw)) return null;
  const type = raw.type;
  const id =
    toNullableString(raw.id) ?? `filter-${new Date().getTime().toString(36)}`;

  if (type === "group") {
    const matchRaw = toNullableString(raw.match);
    const match = matchRaw === "or" ? "or" : "and";
    const childRaw = Array.isArray(raw.children) ? raw.children : [];
    const children = childRaw
      .map((child) => normalizeSqlFilterNodePayload(child))
      .filter((child): child is SqlFilterNode => Boolean(child));
    return { type: "group", id, match, children };
  }

  if (type === "condition") {
    const field = normalizeSqlColumnKeyPayload(raw.field);
    const op = normalizeFilterOperator(toNullableString(raw.op));
    if (!field) return null;
    return {
      type: "condition",
      id,
      field,
      op,
      value: normalizeFilterValueForOperator(op, raw.value),
    };
  }

  const shorthandField = normalizeSqlColumnKeyPayload(
    raw.field ?? raw.column ?? raw.col ?? raw.columnKey ?? raw.column_key,
  );
  const shorthandOp = normalizeFilterOperator(
    toNullableString(raw.op ?? raw.operator),
  );
  if (shorthandField) {
    return {
      type: "condition",
      id,
      field: shorthandField,
      op: shorthandOp,
      value: normalizeFilterValueForOperator(
        shorthandOp,
        raw.value ?? raw.values ?? null,
      ),
    };
  }

  return null;
};

const normalizeSqlFiltersPayload = (raw: unknown): SqlFilterNode | null => {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    const children = raw
      .map((entry) => normalizeSqlFilterNodePayload(entry))
      .filter((entry): entry is SqlFilterNode => Boolean(entry));
    if (!children.length) return null;
    return {
      type: "group",
      id: `filter-group-${new Date().getTime().toString(36)}`,
      match: "and",
      children,
    };
  }

  return normalizeSqlFilterNodePayload(raw);
};

const normalizeAggSpecPayload = (raw: unknown): AggSpec => {
  const source = isRecord(raw) ? raw : {};
  const filtersRaw = source.filters;
  const filterNodes = Array.isArray(filtersRaw)
    ? filtersRaw
        .map((entry) => normalizeSqlFilterNodePayload(entry))
        .filter((entry): entry is SqlFilterNode => Boolean(entry))
    : isRecord(filtersRaw)
      ? [normalizeSqlFilterNodePayload(filtersRaw)].filter(
          (entry): entry is SqlFilterNode => Boolean(entry),
        )
      : [];

  return {
    columnKey:
      normalizeSqlColumnKeyPayload(source.columnKey ?? source.column_key) ??
      null,
    agg: normalizeAggFn(source.agg, "count_distinct"),
    filters: filterNodes,
  };
};

const normalizeDerivedMetricPayload = (raw: unknown): DerivedMetric | null => {
  if (!isRecord(raw)) return null;
  const kind = toNullableString(raw.kind) ?? "ratio";
  if (kind !== "ratio") return null;
  const name = toNullableString(raw.name);
  if (!name) return null;

  return {
    kind: "ratio",
    name,
    label: toNullableString(raw.label),
    numerator: normalizeAggSpecPayload(raw.numerator),
    denominator: normalizeAggSpecPayload(raw.denominator),
    safeDivide: toBooleanOrDefault(raw.safeDivide ?? raw.safe_divide, true),
    multiplyBy: toFiniteNumberOrNull(raw.multiplyBy ?? raw.multiply_by),
  };
};

const normalizeMetricRefPayload = (raw: unknown): SqlMetricRef | null => {
  if (!isRecord(raw)) return null;
  const type = toNullableString(raw.type);
  if (type === "derived") {
    const name = toNullableString(raw.name);
    if (!name) return null;
    return {
      type: "derived",
      name,
      label: toNullableString(raw.label),
    };
  }

  if (type === "column") {
    return {
      type: "column",
      columnKey:
        normalizeSqlColumnKeyPayload(
          raw.columnKey ?? raw.column_key ?? raw.field ?? raw.col,
        ) ?? null,
      agg: normalizeAggFn(raw.agg ?? raw.fn ?? raw.func, "count_distinct"),
      label: toNullableString(raw.label),
    };
  }

  return null;
};

const normalizeAggMetricPayload = (
  raw: unknown,
): SqlAggregationsJson["metrics"][number] | null => {
  if (!isRecord(raw)) return null;
  const metricRef =
    normalizeMetricRefPayload(raw.metricRef ?? raw.metric_ref) ??
    ((): SqlMetricRef | null => {
      const legacyFn = normalizeAggFn(raw.fn ?? raw.func, "count_distinct");
      const legacyField = normalizeSqlColumnKeyPayload(raw.field ?? raw.col);
      return {
        type: "column",
        agg: legacyFn,
        columnKey: legacyField,
        label: toNullableString(raw.label),
      };
    })();

  if (!metricRef) return null;

  return {
    id:
      toNullableString(raw.id) ??
      `metric-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    metricRef,
  };
};

const normalizeSqlAggsPayload = (raw: unknown): SqlAggregationsJson | null => {
  if (raw == null) return null;
  if (!isRecord(raw)) {
    return { enabled: false, metrics: [], groupBy: [], derivedMetrics: [] };
  }
  const source = raw as Record<string, unknown>;
  const groupByRaw = source.groupBy ?? source.group_by;
  const derivedRaw = source.derivedMetrics ?? source.derived_metrics;
  const metrics = (Array.isArray(source.metrics) ? source.metrics : [])
    .map((entry) => normalizeAggMetricPayload(entry))
    .filter((entry): entry is SqlAggregationsJson["metrics"][number] =>
      Boolean(entry),
    );
  const groupBy = (Array.isArray(groupByRaw) ? groupByRaw : [])
    .map((entry: unknown) => normalizeSqlColumnKeyPayload(entry))
    .filter((entry: SqlColumnKey | null): entry is SqlColumnKey =>
      Boolean(entry),
    );
  const derivedMetrics = (Array.isArray(derivedRaw) ? derivedRaw : [])
    .map((entry: unknown) => normalizeDerivedMetricPayload(entry))
    .filter((entry: DerivedMetric | null): entry is DerivedMetric =>
      Boolean(entry),
    );

  return {
    enabled: metrics.length > 0 || groupBy.length > 0,
    metrics,
    groupBy,
    derivedMetrics,
  };
};

export const normalizeSqlJsonPayload = (
  raw: Partial<SqlQueryJson> | null | undefined,
): SqlQueryJson => {
  const source = (raw ?? {}) as Record<string, any>;
  const normalizedValueOverrides =
    source.value_overrides ??
    source.crosswalks ??
    emptySqlJson().value_overrides;
  const normalizedValueOverrideAttachments =
    source.value_overrideAttachments ?? source.crosswalkAttachments ?? [];
  const normalizedColumns = normalizeSqlColumnsPayload(source.columns);
  const normalizedDomainId = toFiniteNumberOrNull(
    source.domainId ?? source.domain_id,
  );
  const normalizedAggs = normalizeSqlAggsPayload(
    source.aggs ?? source.aggregations,
  );
  const normalizedFilters = normalizeSqlFiltersPayload(source.filters);
  const normalizedMeta = normalizeSqlMetaPayload(source.meta);

  return {
    ...emptySqlJson(),
    ...(source as SqlQueryJson),
    domainId: normalizedDomainId,
    columns: normalizedColumns,
    filters: normalizedFilters,
    aggs: normalizedAggs ?? emptySqlJson().aggs,
    value_overrides: normalizedValueOverrides,
    value_overrideAttachments: normalizedValueOverrideAttachments,
    meta: normalizedMeta,
  };
};

export { CANONICAL_FILTER_OPERATORS };
