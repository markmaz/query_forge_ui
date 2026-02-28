// src/features/cohort-builder/model/sqlJson.ts

export type SqlJsonVersion = 1;

export type SqlColumnKey = {
  modelColumnId: number | null;
  columnName: string; 
  workspaceTableId?: number | null;
  exprId?: string | null;
  alias?: string | null;
}

/** Stable column reference used across the builder */
export type SqlColumnRef = SqlColumnKey & {

  // Optional context (helps debug and reduces ambiguity)
  modelTableId?: number | null;
  modelTableName?: string | null;
  fullName?: string | null; // full path of selected domain table
  tableAlias?: string | null;
  dataType?: string | null;
  nullable?: boolean | null;

  // User-facing
  alias?: string | null;
};

/** ORDER BY */
export type SqlSort = {
  col: SqlColumnKey;
  dir: "asc" | "desc";
};

/** Filters */
export type SqlFilterLogic = "and" | "or";
export type SqlFilterOp =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "in"
  | "not_in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "is_null"
  | "is_not_null";

export type InListValue =
  | { mode: "manual"; values: string[] }
  | { mode: "cohort"; cohortId: string }
  | { mode: "value_override"; listType: "regions" | "npiCategories" | "serviceLines"; listId: string };

export type JoinMode = "filter" | "join";
export type ValueOverrideType = "regions" | "npiCategories" | "serviceLines";

export type ValueOverrideAttachment = {
  id: string;
  type: ValueOverrideType;
  workspaceId: string;
  listId: string;
  mode: JoinMode;
  domainJoinColumns: SqlColumnKey[];
  value_overrideJoinColumns: string[];
  joinAliasByColumnKey?: Record<string, string>;
  projectFields: string[];
};

export type CohortAttachment = {
  id: string;
  workspaceId: string;
  cohortQueryId: string;
  cohortName: string;
  cohortNameSnake: string;
  cohortOwnerUserId: string;
  cohortTableFullName: string;
  cohortTableAlias: string;
  mode: JoinMode;
  cohortJoinKey: "patient_id" | "cohort_key";
  domainJoinColumn: SqlColumnKey | null;
  cohortKeyFilter?: string;
  projectFields: string[];
};

export type SqlFilterNode =
  | { type: "group"; id: string; match: "and" | "or"; children: SqlFilterNode[] }
  | { type: "condition"; id: string; field: SqlColumnKey; op: SqlFilterOp; value: any }; 

/** Aggregations (your existing shape, but tightened) */
export type AggFn = "count" | "count_distinct" | "sum" | "avg" | "min" | "max";

export type AggSpec = {
  columnKey: SqlColumnKey | null;
  agg: AggFn;
  filters?: SqlFilterNode[];
};

export type DerivedMetric =
  | {
      kind: "ratio";
      name: string;
      numerator: AggSpec;
      denominator: AggSpec;
      safeDivide: boolean;
      multiplyBy?: number | null;
      label?: string | null;
    };

export type SqlMetricRef =
  | {
      type: "column";
      columnKey: SqlColumnKey | null;
      agg: AggFn;
      label?: string | null;
    }
  | {
      type: "derived";
      name: string;
      label?: string | null;
    };

export type SqlAggMetric = {
  id: string;
  metricRef: SqlMetricRef;
};

export type SqlAggregationsJson = {
  enabled: boolean;
  metrics: SqlAggMetric[];
  groupBy: SqlColumnKey[];      // ✅ was string[]
  derivedMetrics?: DerivedMetric[];
};

/** -----------------------------
 * Data Prep (query-wide transforms)
 * ------------------------------
 * These apply across SELECT + GROUP BY + WHERE + ORDER BY
 */

export type SqlValueRef =
  | { type: "column"; col: SqlColumnKey }
  | { type: "literal"; value: string | number | boolean | null };

export type SqlDataPrepOp = "fill_empty" | "cast" | "normalize_text" | "parse_date" | "date_part" | "round" | "concat";

export type SqlDataPrepRuleBase = {
  id: string;
  enabled: boolean;

  // Applies to a column by ID when possible, fallback by name
  target: SqlColumnKey;
  output: SqlColumnKey;
  // Whether the user wants to apply this everywhere (you said: yes)
  applyScope: "query_wide";
};

export type SqlFillEmptyRule = SqlDataPrepRuleBase & {
  op: "fill_empty";                 // user-facing name (no "coalesce")
  // optionally treat blank strings as empty too
  treatBlankAsEmpty?: boolean; 
  // the fallback value to use if null/empty
  value: string | number | boolean | null;
  fallbackCol?: SqlColumnKey | null;
};

export type SqlCastRule = SqlDataPrepRuleBase & {
  op: "cast";
  toType: string;                   // e.g., "INT", "DECIMAL(10,2)", "DATE"
  // optional: safe/try cast semantics if you add it later
  safe?: boolean;
};

export type SqlNormalizeTextRule = SqlDataPrepRuleBase & {
  op: "normalize_text";
  mode: "lower" | "upper" | "trim" | "trim_lower";
};

export type SqlParseDateRule = SqlDataPrepRuleBase & {
  op: "parse_date";
  format?: string | null;           // optional format string if your engine supports it
};

export type SqlDatePartRule = SqlDataPrepRuleBase & {
  op: "date_part";
  part: "year";
};

export type SqlRoundRule = SqlDataPrepRuleBase & {
  op: "round";
  decimals: number;                 // 0..n
};

export type SqlConcatRule = SqlDataPrepRuleBase & {
  op: "concat";
  inputs: SqlValueRef[];
  separator?: string | null;
  nulls?: "skip" | "propagate";
};


export type SqlDataPrepRule =
  | SqlFillEmptyRule
  | SqlCastRule
  | SqlNormalizeTextRule
  | SqlParseDateRule
  | SqlDatePartRule
  | SqlRoundRule
  | SqlConcatRule;

export type SqlDataPrepJson = {
  enabled: boolean;
  rules: SqlDataPrepRule[];
};

/** Optional value overrides (as you already have) */
export type SqlValueOverrides = {
  a?: string | null;
  b?: string | null;
  c?: string | null;
};

/** Optional metadata */
export type SqlQueryMeta = {
  prompt?: string;
  createdAt?: string; // ISO
  updatedAt?: string; // ISO
  tool?: string;
  cohortBuilder?: {
    prompt?: string;
    filters?: any[];
    logic?: "all" | "any";
  };
};

/** ✅ Final */
export type SqlQueryJsonV1 = {
  version: SqlJsonVersion;

  // prompt (optional)
  prompt?: string;

  // Domain (required to run)
  domainId: number | null;

  // optional value overrides
  value_overrides?: SqlValueOverrides;

  // value override/cohort attachments
  value_overrideAttachments?: ValueOverrideAttachment[];
  cohortAttachment?: CohortAttachment | null;

  // projection order
  columns: SqlColumnRef[];

  // query-wide transforms (Data Prep)
  dataPrep?: SqlDataPrepJson | null;

  // filters
  filters?: SqlFilterNode | null;

  // aggregations
  aggs?: SqlAggregationsJson | null;

  // sorting
  sorting?: SqlSort[];

  // distinct rows
  distinct?: boolean;

  // metadata
  meta?: SqlQueryMeta;
};

export type SqlQueryJson = SqlQueryJsonV1;

export const sameCol = (a?: SqlColumnKey | null, b?: SqlColumnKey | null) => {
  if (!a || !b) return false;

  // computed/virtual identity
  if (a.exprId && b.exprId) return a.exprId === b.exprId;

  // explicit table identity
  if (a.workspaceTableId != null && b.workspaceTableId != null) {
    return a.workspaceTableId === b.workspaceTableId && a.columnName === b.columnName;
  }

  // physical identity
  if (a.modelColumnId != null && b.modelColumnId != null) return a.modelColumnId === b.modelColumnId;

  // fallback
  return a.columnName === b.columnName;
};

export function colKey(c: SqlColumnKey) {
  if (c.exprId) return `expr:${c.exprId}`;
  if (typeof c.workspaceTableId === "number") return `wt:${c.workspaceTableId}|name:${c.columnName}`;
  if (typeof c.modelColumnId === "number" && c.modelColumnId !== null) return `id:${c.modelColumnId}`;
  return `name:${c.columnName}`;
}

export function labelFor(c: SqlColumnRef | SqlColumnKey): string {
  const column = (c ?? {}) as Partial<SqlColumnRef>;
  const alias = typeof column.alias === "string" ? column.alias.trim() : "";
  const tableAlias = typeof column.tableAlias === "string" ? column.tableAlias.trim() : "";
  const table = typeof column.modelTableName === "string" ? column.modelTableName.trim() : "";
  const columnName =
    typeof column.columnName === "string" && column.columnName.trim()
      ? column.columnName
      : typeof column.modelColumnId === "number"
        ? `column_${column.modelColumnId}`
        : "unknown_column";

  if (alias) return alias;
  if (tableAlias) return `${tableAlias}.${columnName}`;
  return table ? `${table}.${columnName}` : columnName;
}
