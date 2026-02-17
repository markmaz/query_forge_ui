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
  | "contains"
  | "starts_with"
  | "in"
  | "gt"
  | "lt"
  | "between";

export type AiDomainCandidate = {
  domainId: number;
  name?: string;
  description?: string;
  domainName?: string;
  domainKind?: string;
  score?: number;
};

export type AiTableCandidate = {
  tableId?: number | null;
  tableName: string;
  modelTableId?: number | null;
  score: number;
  reasons?: string[];
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
  reasons?: string[];
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
  domainContext?: {
    selectedDomainId?: number | null;
    domainCandidates?: AiDomainCandidate[];
  } | null;
  candidates?: {
    tables?: AiTableCandidate[];
    columns?: AiColumnCandidate[];
  } | null;
};

export type QueryStudioSuggestResponse = {
  message: string;
  suggestions: AiSuggestion[];
  confidence?: number;
  debugAttempts?: 1 | 2;
  trace?: unknown;
};

export type AiSuggestRequest = {
  mode: AiSuggestMode;
  prompt: string;
  currentSqlJson?: SqlQueryJson | null;
  domainContext?: QueryStudioSuggestRequest["domainContext"];
  candidates?: QueryStudioSuggestRequest["candidates"];
};

export type AiSuggestResponse = {
  edits: BuilderAction[];
  explanation: string;
  confidence: number;
  sqlJson: SqlQueryJson;
  debug: {
    model: string;
    attempts: 1 | 2;
  };
};

export const SECTION_QUICK_ACTIONS: Record<AiCopilotSection, string[]> = {
  "AI First": ["Help me start this query"],
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
  "contains",
  "starts_with",
  "in",
  "gt",
  "lt",
  "between",
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
