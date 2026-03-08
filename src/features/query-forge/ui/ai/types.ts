import type { SqlColumnKey, SqlQueryJson } from "../../model/sqlJson";

export type AiCopilotSection =
  | "AI First"
  | "Domain"
  | "Columns"
  | "Data Prep"
  | "Filters"
  | "Aggs"
  | "Sorting"
  | "Results";

export type AiSuggestMode =
  | "ai_first"
  | "domains"
  | "columns"
  | "filters"
  | "aggregation"
  | "data_prep";

export type BuilderAction =
  | { op: "setDomain"; domainId: number }
  | { op: "addSelect"; col: SqlColumnKey; alias?: string | null }
  | { op: "addFilter"; col: SqlColumnKey; operator: SqlFilterOperator; value: unknown }
  | { op: "setDistinct"; value: boolean }
  | {
      op: "addAggregate";
      func: "count_distinct" | "count" | "sum" | "avg";
      col?: SqlColumnKey | null;
      alias: string;
    }
  | { op: "addGroupBy"; col: SqlColumnKey }
  | { op: "addSort"; col: SqlColumnKey; dir: "asc" | "desc" };

export type SqlFilterOperator =
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

export type AiDomainCandidate = {
  domainId: number;
  name: string;
  description: string;
  domainName?: string | null;
  domainKind?: string | null;
  score?: number | null;
};

export type AiTableCandidate = {
  tableId?: number | null;
  tableName: string;
  modelTableId?: number | null;
  score: number;
  reasons: string[];
};

export type AiColumnCandidate = {
  modelColumnId?: number | null;
  columnName: string;
  workspaceTableId?: number | null;
  modelTableId?: number | null;
  modelTableName?: string | null;
  label: string;
  description: string;
  dataType?: string | null;
  score: number;
  reasons: string[];
};

export type AiSuggestion = {
  id?: string;
  title: string;
  why: string;
  confidence: "high" | "medium" | "low";
  actions: BuilderAction[];
  sqlJson?: SqlQueryJson;
  debug?: { model: string; attempts: 1 | 2 };
};

export type QueryStudioSuggestRequest = {
  workspaceId: string | null;
  activeSection: AiCopilotSection;
  sqlJson?: SqlQueryJson | null;
  userPrompt?: string;
  conversationId?: string | null;
  verticalNorm?: string;
  baseDomainId?: number;
  fastMode?: boolean;
  debug?: boolean;
  domainContext?: {
    selectedDomainId?: number | null;
    domainCandidates: AiDomainCandidate[];
  } | null;
  candidates?: {
    tables: AiTableCandidate[];
    columns: AiColumnCandidate[];
  } | null;
};

export type QueryStudioSuggestResponse = {
  message: string;
  suggestions: AiSuggestion[];
  confidence?: number;
  debugAttempts?: 1 | 2;
  conversationId?: string | null;
  plannerMeta?: PlannerResultMetadata;
  deprecation?: AiSuggestDeprecationNotice;
  trace?: unknown;
  rawResponse?: unknown;
};

export type AiSuggestDeprecationNotice = {
  deprecated: boolean;
  replacement: string | null;
};

export type AiSuggestRequest = {
  mode: AiSuggestMode;
  prompt: string;
  vertical_norm?: string;
  debug?: boolean;
  currentSqlJson?: SqlQueryJson | null;
  domainContext?: QueryStudioSuggestRequest["domainContext"];
  candidates?: QueryStudioSuggestRequest["candidates"];
};

export type AiSuggestResponse = {
  edits: BuilderAction[];
  explanation: string;
  confidence: number;
  sqlJson: SqlQueryJson;
  sqlJsonHydratable?: boolean;
  debug: {
    model: string;
    attempts: 1 | 2;
  };
  deprecation?: AiSuggestDeprecationNotice;
  plannerMeta?: PlannerResultMetadata;
  rawResponse?: unknown;
};

export type PlannerIntent = "aggregate" | "list" | "trend";

export type PlanValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type PlanValidation = {
  is_valid: boolean;
  errors: PlanValidationIssue[];
  repairs_applied: string[];
};

export type PlanV2 = {
  schema_version: 2;
  trace_id: string;
  workspace_id: string;
  vertical_norm: string;
  base_domain_id: number;
  domain_name?: string | null;
  intent?: PlannerIntent | string;
  selects?: unknown;
  filters?: unknown[];
  time?: unknown;
  grouping?: unknown;
  debug?: unknown | null;
  [key: string]: unknown;
};

export type PlanExplanationSummarySource = "llm" | "deterministic";

export type PlanExplanationDomain = {
  selected_domain_name?: string | null;
  reason?: string | null;
  [key: string]: unknown;
};

export type PlanExplanationDimension = {
  label?: string | null;
  reason?: string | null;
  column_key?: string | null;
  [key: string]: unknown;
};

export type PlanExplanationMetric = {
  label?: string | null;
  reason?: string | null;
  metric_ref?: unknown;
  [key: string]: unknown;
};

export type PlanExplanationFilter = {
  label?: string | null;
  op_label?: string | null;
  value?: unknown;
  values?: unknown[];
  reason?: string | null;
  column_key?: string | null;
  [key: string]: unknown;
};

export type PlanDomainExplanation = {
  summary?: string | null;
  summary_source?: PlanExplanationSummarySource | null;
  domain?: PlanExplanationDomain | null;
  dimensions?: PlanExplanationDimension[];
  metrics?: PlanExplanationMetric[];
  filters?: PlanExplanationFilter[];
  [key: string]: unknown;
};

export type PlannerNextActionFilter = {
  column_key: string;
  op: string;
  value?: unknown;
  values?: unknown[];
};

export type PlannerNextAction = {
  label: string;
  prompt: string;
  reason: string;
  intent: PlannerIntent;
  confidence: number;
  dimensions: string[];
  metrics: string[];
  filters: PlannerNextActionFilter[];
};

export type PlannerNextActionsStatus = "deferred" | "ready";

export type PlannerResultMetadata = {
  route: "plan_domain";
  conversationId?: string | null;
  planJsonV2: PlanV2;
  validation: PlanValidation;
  explanation?: PlanDomainExplanation | null;
  nextActions?: PlannerNextAction[];
  nextActionsStatus?: PlannerNextActionsStatus;
  traceId?: string;
  timingsMs?: Record<string, number>;
  debug?: unknown;
};

export type PlanDomainRequest = {
  prompt: string;
  vertical_norm: string;
  fast_mode?: boolean;
  base_domain_id?: number | null;
  debug?: boolean;
  conversation_id?: string | null;
  next_actions_async?: boolean;
};

export type PlanDomainResponse = {
  conversation_id?: string | null;
  plan_json_v2: PlanV2;
  sql_json: SqlQueryJson;
  validation: PlanValidation;
  explanation?: PlanDomainExplanation;
  next_actions?: PlannerNextAction[];
  next_actions_status?: PlannerNextActionsStatus;
  trace_id?: string;
  timings_ms?: Record<string, number>;
  debug?: unknown;
  [key: string]: unknown;
};

export type PlanDomainNextActionsRequest = {
  workspace_id: string;
  prompt: string;
  plan_json_v2: PlanV2;
  vertical_norm?: string;
  conversation_id?: string | null;
  trace_id?: string;
};

export type PlanDomainNextActionsResponse = {
  next_actions?: PlannerNextAction[];
  next_actions_status?: PlannerNextActionsStatus;
  [key: string]: unknown;
};

export type PromptFeedbackVote = "up" | "down";

export type PromptFeedbackMeta = {
  model?: string;
  timings_ms?: Record<string, number>;
  domain_id?: number;
  domain_version?: number | string;
  intent?: string;
};

export type PromptFeedbackRequest = {
  workspace_id: string;
  trace_id?: string;
  vote: PromptFeedbackVote;
  normalized_prompt?: string;
  prompt_text?: string;
  response_json: unknown;
  meta?: PromptFeedbackMeta;
};

export type PromptFeedbackResponse = {
  id: string | number;
  created_at: string;
  updated_at: string;
  vote: PromptFeedbackVote;
};

export const SECTION_QUICK_ACTIONS: Record<AiCopilotSection, string[]> = {
  "AI First": [],
  Domain: ["Help me pick a domain", "Search domains by intent"],
  Columns: ["Suggest columns for my goal", "Find identifiers", "Avoid PII"],
  "Data Prep": ["Suggest data cleanup rules", "Normalize text fields", "Add safe type casts"],
  Filters: ["Suggest filters", "Add date range", "Add common constraints"],
  Aggs: ["Suggest metrics", "Suggest group by"],
  Sorting: ["Suggest sort"],
  Results: ["Explain this query", "Validate joins", "Performance hints"],
};

export function mapSectionToAiMode(section: AiCopilotSection): AiSuggestMode {
  switch (section) {
    case "AI First":
      return "ai_first";
    case "Domain":
      return "domains";
    case "Columns":
      return "columns";
    case "Data Prep":
      return "data_prep";
    case "Filters":
      return "filters";
    case "Aggs":
      return "aggregation";
    case "Sorting":
    case "Results":
      return "ai_first";
    default:
      return "ai_first";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseColumnKey(value: unknown): SqlColumnKey {
  if (!isRecord(value)) throw new Error("Invalid SQL column key");
  if (typeof value.columnName !== "string" || !value.columnName.trim()) {
    throw new Error("Invalid SQL column key: columnName");
  }

  const parseNullableNumber = (field: string): number | null | undefined => {
    if (!(field in value)) return undefined;
    const raw = value[field];
    if (raw == null) return null;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    throw new Error(`Invalid SQL column key: ${field}`);
  };

  const parseNullableString = (field: string): string | null | undefined => {
    if (!(field in value)) return undefined;
    const raw = value[field];
    if (raw == null) return null;
    if (typeof raw === "string") return raw;
    throw new Error(`Invalid SQL column key: ${field}`);
  };

  return {
    columnName: value.columnName,
    modelColumnId: parseNullableNumber("modelColumnId") ?? null,
    workspaceTableId: parseNullableNumber("workspaceTableId"),
    exprId: parseNullableString("exprId"),
    alias: parseNullableString("alias"),
  };
}

const FILTER_OPERATORS: SqlFilterOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "starts_with",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "is_null",
  "is_not_null",
];
const AGG_FUNCS = ["count_distinct", "count", "sum", "avg"] as const;

function parseBuilderAction(value: unknown): BuilderAction {
  if (!isRecord(value) || typeof value.op !== "string") {
    throw new Error("Invalid AI edit operation");
  }

  switch (value.op) {
    case "setDomain": {
      if (typeof value.domainId !== "number" || !Number.isFinite(value.domainId)) {
        throw new Error("Invalid setDomain operation");
      }
      return { op: "setDomain", domainId: value.domainId };
    }
    case "addSelect": {
      const parsed = {
        op: "addSelect",
        col: parseColumnKey(value.col),
      } as BuilderAction;
      if ("alias" in value && value.alias != null && typeof value.alias !== "string") {
        throw new Error("Invalid addSelect alias");
      }
      if ("alias" in value) {
        (parsed as Extract<BuilderAction, { op: "addSelect" }>).alias =
          (value.alias as string | null | undefined) ?? null;
      }
      return parsed;
    }
    case "addFilter": {
      if (!FILTER_OPERATORS.includes(value.operator as SqlFilterOperator)) {
        throw new Error("Invalid addFilter operator");
      }
      return {
        op: "addFilter",
        col: parseColumnKey(value.col),
        operator: value.operator as SqlFilterOperator,
        value: value.value,
      };
    }
    case "addGroupBy":
      return { op: "addGroupBy", col: parseColumnKey(value.col) };
    case "addAggregate": {
      if (!AGG_FUNCS.includes(value.func as (typeof AGG_FUNCS)[number])) {
        throw new Error("Invalid addAggregate func");
      }
      if (typeof value.alias !== "string") {
        throw new Error("Invalid addAggregate alias");
      }
      const parsed: Extract<BuilderAction, { op: "addAggregate" }> = {
        op: "addAggregate",
        func: value.func as "count_distinct" | "count" | "sum" | "avg",
        alias: value.alias,
      };
      if ("col" in value) parsed.col = value.col == null ? null : parseColumnKey(value.col);
      return parsed;
    }
    case "addSort": {
      if (value.dir !== "asc" && value.dir !== "desc") {
        throw new Error("Invalid addSort dir");
      }
      return { op: "addSort", col: parseColumnKey(value.col), dir: value.dir };
    }
    case "setDistinct":
      if (typeof value.value !== "boolean") throw new Error("Invalid setDistinct value");
      return { op: "setDistinct", value: value.value };
    default:
      throw new Error("Unsupported AI edit operation");
  }
}

export function parseAiSuggestResponse(payload: unknown): AiSuggestResponse {
  if (!isRecord(payload)) {
    throw new Error("Invalid AI suggest response");
  }

  if (isRecord(payload.plan_json_v2) || isRecord(payload.sql_json) || isRecord(payload.validation)) {
    return parsePlanDomainAiResponse(payload);
  }

  if (!Array.isArray(payload.edits)) {
    throw new Error("Invalid AI suggest response edits");
  }
  if (typeof payload.explanation !== "string") {
    throw new Error("Invalid AI suggest explanation");
  }
  if (typeof payload.confidence !== "number" || !Number.isFinite(payload.confidence)) {
    throw new Error("Invalid AI suggest confidence");
  }
  if (!isRecord(payload.sqlJson)) {
    throw new Error("Invalid AI suggest sqlJson");
  }

  const debugRaw = isRecord(payload.debug) ? payload.debug : {};
  const model = typeof debugRaw.model === "string" ? debugRaw.model : "unknown";
  const attempts = debugRaw.attempts === 2 ? 2 : 1;

  return {
    edits: payload.edits.map(parseBuilderAction),
    explanation: payload.explanation,
    confidence: Math.max(0, Math.min(1, payload.confidence)),
    sqlJson: payload.sqlJson as SqlQueryJson,
    debug: { model, attempts },
    rawResponse: payload,
  };
}

function parsePlanValidation(value: unknown): PlanValidation {
  if (!isRecord(value) || typeof value.is_valid !== "boolean") {
    throw new Error("Invalid planner validation");
  }

  const rawErrors = Array.isArray(value.errors) ? value.errors : [];
  const errors = rawErrors.map((entry, idx) => {
    if (isRecord(entry)) {
      return {
        code: typeof entry.code === "string" ? entry.code : `error_${idx + 1}`,
        path: typeof entry.path === "string" ? entry.path : "",
        message:
          typeof entry.message === "string" && entry.message.trim()
            ? entry.message
            : typeof entry.code === "string"
              ? entry.code
              : "Planner validation error",
      };
    }
    if (typeof entry === "string") {
      return { code: entry, path: "", message: entry };
    }
    return { code: `error_${idx + 1}`, path: "", message: "Planner validation error" };
  });

  return {
    is_valid: value.is_valid,
    errors,
    repairs_applied: Array.isArray(value.repairs_applied)
      ? value.repairs_applied.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function parsePlanV2(value: unknown): PlanV2 {
  if (!isRecord(value)) throw new Error("Invalid planner plan_json_v2");

  const traceId =
    typeof value.trace_id === "string"
      ? value.trace_id
      : typeof value.traceId === "string"
        ? value.traceId
        : "";
  const workspaceId = typeof value.workspace_id === "string" ? value.workspace_id : "";
  const verticalNorm =
    typeof value.vertical_norm === "string"
      ? value.vertical_norm
      : typeof value.verticalNorm === "string"
        ? value.verticalNorm
        : "";
  const baseDomainId = isFiniteNumber(value.base_domain_id)
    ? value.base_domain_id
    : isFiniteNumber(value.baseDomainId)
      ? value.baseDomainId
      : 0;

  return {
    ...(value as Record<string, unknown>),
    schema_version: 2,
    trace_id: traceId,
    workspace_id: workspaceId,
    vertical_norm: verticalNorm,
    base_domain_id: baseDomainId,
    domain_name:
      value.domain_name == null
        ? null
        : typeof value.domain_name === "string"
          ? value.domain_name
          : null,
  } as PlanV2;
}

function parseTimingsMs(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter(([, v]) => isFiniteNumber(v));
  if (!entries.length) return undefined;
  return Object.fromEntries(entries) as Record<string, number>;
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parsePlanDomainExplanation(value: unknown): PlanDomainExplanation | null {
  if (!isRecord(value)) return null;

  const summarySourceRaw = toNullableString(value.summary_source);
  const summarySource: PlanExplanationSummarySource | null =
    summarySourceRaw === "llm" || summarySourceRaw === "deterministic"
      ? summarySourceRaw
      : null;

  const domainRaw = isRecord(value.domain) ? value.domain : null;
  const domain: PlanExplanationDomain | null = domainRaw
    ? {
        ...domainRaw,
        selected_domain_name: toNullableString(domainRaw.selected_domain_name),
        reason: toNullableString(domainRaw.reason),
      }
    : null;

  const dimensions = toUnknownArray(value.dimensions)
    .filter(isRecord)
    .map(
      (entry): PlanExplanationDimension => ({
        ...entry,
        label: toNullableString(entry.label),
        reason: toNullableString(entry.reason),
        column_key: toNullableString(entry.column_key),
      })
    );

  const metrics = toUnknownArray(value.metrics)
    .filter(isRecord)
    .map(
      (entry): PlanExplanationMetric => ({
        ...entry,
        label: toNullableString(entry.label),
        reason: toNullableString(entry.reason),
        metric_ref: "metric_ref" in entry ? entry.metric_ref : undefined,
      })
    );

  const filters = toUnknownArray(value.filters)
    .filter(isRecord)
    .map(
      (entry): PlanExplanationFilter => ({
        ...entry,
        label: toNullableString(entry.label),
        op_label: toNullableString(entry.op_label),
        value: "value" in entry ? entry.value : undefined,
        values: Array.isArray(entry.values) ? entry.values : undefined,
        reason: toNullableString(entry.reason),
        column_key: toNullableString(entry.column_key),
      })
    );

  return {
    ...value,
    summary: toNullableString(value.summary),
    summary_source: summarySource,
    domain,
    dimensions,
    metrics,
    filters,
  };
}

function parsePlannerNextActionIntent(value: unknown): PlannerIntent {
  if (value === "aggregate" || value === "trend" || value === "list") return value;
  return "list";
}

function parsePlannerNextActionsStatus(value: unknown): PlannerNextActionsStatus | undefined {
  if (value === "deferred" || value === "ready") return value;
  return undefined;
}

function parsePlannerNextActions(value: unknown): PlannerNextAction[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((entry): PlannerNextAction | null => {
      const prompt = toNullableString(entry.prompt);
      if (!prompt) return null;
      const label = toNullableString(entry.label) ?? "Follow-up";
      const reason = toNullableString(entry.reason) ?? "";
      const confidenceRaw = typeof entry.confidence === "number" && Number.isFinite(entry.confidence)
        ? entry.confidence
        : 0;
      const confidence = Math.max(0, Math.min(1, confidenceRaw));
      const dimensions = Array.isArray(entry.dimensions)
        ? entry.dimensions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      const metrics = Array.isArray(entry.metrics)
        ? entry.metrics.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      const filters = Array.isArray(entry.filters)
        ? entry.filters
            .filter(isRecord)
            .map((filter): PlannerNextActionFilter | null => {
              const columnKey = toNullableString(filter.column_key);
              const op = toNullableString(filter.op);
              if (!columnKey || !op) return null;
              return {
                column_key: columnKey,
                op,
                ...("value" in filter ? { value: filter.value } : {}),
                ...(Array.isArray(filter.values) ? { values: filter.values } : {}),
              };
            })
            .filter((item): item is PlannerNextActionFilter => Boolean(item))
        : [];

      return {
        label,
        prompt,
        reason,
        intent: parsePlannerNextActionIntent(entry.intent),
        confidence,
        dimensions,
        metrics,
        filters,
      };
    })
    .filter((item): item is PlannerNextAction => Boolean(item));
}

function buildPlanDomainExplanation(
  plan: PlanV2,
  validation: PlanValidation,
  explanation?: PlanDomainExplanation | null
): string {
  const summary = explanation?.summary?.trim();
  if (summary) return summary;
  const domainLabel = (plan.domain_name ?? "").trim() || `domain #${plan.base_domain_id}`;
  if (!validation.is_valid) {
    return `Plan validation failed for ${domainLabel}. Review validation errors below.`;
  }
  if (validation.repairs_applied.length > 0) {
    return `Domain-first planner generated SQL JSON for ${domainLabel} with ${validation.repairs_applied.length} repair${validation.repairs_applied.length === 1 ? "" : "s"} applied.`;
  }
  return `Domain-first planner generated SQL JSON for ${domainLabel}.`;
}

function createFallbackSqlJson(domainId: number | null, prompt?: string): SqlQueryJson {
  return {
    version: 1,
    domainId,
    columns: [],
    prompt: prompt ?? "",
    dataPrep: null,
    filters: null,
    aggs: { enabled: false, metrics: [], groupBy: [], derivedMetrics: [] },
    sorting: [],
    distinct: false,
    value_overrides: { a: null, b: null, c: null },
    value_overrideAttachments: [],
    cohortAttachment: null,
    meta: { tool: "planner_domain_v2" },
  };
}

function parsePlanDomainAiResponse(payload: Record<string, unknown>): AiSuggestResponse {
  if (!("plan_json_v2" in payload) || !isRecord(payload.plan_json_v2)) {
    throw new Error("Invalid planner response: missing plan_json_v2");
  }
  if (!("validation" in payload)) {
    throw new Error("Invalid planner response: missing validation");
  }

  const planJsonV2 = parsePlanV2(payload.plan_json_v2);
  const validation = parsePlanValidation(payload.validation);
  const planExplanation = parsePlanDomainExplanation(payload.explanation);
  const nextActions = parsePlannerNextActions(payload.next_actions ?? payload.nextActions);
  const nextActionsStatus = parsePlannerNextActionsStatus(
    payload.next_actions_status ?? payload.nextActionsStatus
  );
  const explanation = buildPlanDomainExplanation(planJsonV2, validation, planExplanation);
  const debugRaw = isRecord(payload.debug) ? payload.debug : {};
  const model = typeof debugRaw.model === "string" ? debugRaw.model : "unknown";
  const attempts = debugRaw.attempts === 2 ? 2 : 1;
  const traceId =
    (typeof payload.trace_id === "string" && payload.trace_id) ||
    (typeof planJsonV2.trace_id === "string" ? planJsonV2.trace_id : undefined);
  const conversationId =
    typeof payload.conversation_id === "string" && payload.conversation_id.trim().length > 0
      ? payload.conversation_id.trim()
      : null;
  const hasSqlJson = isRecord(payload.sql_json) && Object.keys(payload.sql_json).length > 0;
  if (validation.is_valid && !hasSqlJson) {
    throw new Error("Invalid planner response: missing sql_json for a valid plan");
  }
  const sqlJsonSource = hasSqlJson
    ? (payload.sql_json as Record<string, unknown>)
    : (createFallbackSqlJson(
        isFiniteNumber(planJsonV2.base_domain_id) ? planJsonV2.base_domain_id : null,
        typeof payload.prompt === "string" ? payload.prompt : undefined
      ) as Record<string, unknown>);
  const sqlJsonWithFilterFallback: SqlQueryJson =
    sqlJsonSource.filters == null && Array.isArray(planJsonV2.filters) && planJsonV2.filters.length > 0
      ? ({
          ...sqlJsonSource,
          filters: planJsonV2.filters,
        } as SqlQueryJson)
      : (sqlJsonSource as SqlQueryJson);

  return {
    edits: Array.isArray(payload.edits) ? payload.edits.map(parseBuilderAction) : [],
    explanation,
    confidence: validation.is_valid ? 0.85 : 0.55,
    sqlJson: sqlJsonWithFilterFallback,
    sqlJsonHydratable: hasSqlJson,
    debug: { model, attempts },
    rawResponse: payload,
    plannerMeta: {
      route: "plan_domain",
      conversationId,
      planJsonV2,
      validation,
      explanation: planExplanation,
      nextActions,
      nextActionsStatus,
      traceId,
      timingsMs: parseTimingsMs(payload.timings_ms),
      debug: payload.debug,
    },
  };
}

export function summarizeBuilderAction(action: BuilderAction): string {
  switch (action.op) {
    case "setDomain":
      return `Set domain to #${action.domainId}`;
    case "addSelect":
      return `Add column ${action.col.columnName}`;
    case "addFilter":
      return `Add filter: ${action.col.columnName} ${action.operator}`;
    case "setDistinct":
      return `Set distinct ${action.value ? "on" : "off"}`;
    case "addAggregate":
      return `Add ${action.func} metric`;
    case "addGroupBy":
      return `Add group by ${action.col.columnName}`;
    case "addSort":
      return `Sort by ${action.col.columnName} ${action.dir.toUpperCase()}`;
    default:
      return "Apply builder update";
  }
}
