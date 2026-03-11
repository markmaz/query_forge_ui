import axios from "axios";
import api from "../api";
import { toServiceError } from "./errors";
import {
  editOperationSchema,
  plannerExtractRequestSchema,
  plannerRequestSchema,
  plannerResponseSchema,
  plannerSuggestResponseSchema,
  spacyExtractionSchema,
  type PlannerExtractRequest,
  type PlannerRequest,
  type PlannerResponse,
  type PlannerSuggestResponse,
  type SpacyExtraction,
} from "./schemas";

const PLAN_PATH = "/semantic/plan";
const SUGGEST_COLUMNS_PATH = "/semantic/suggest-columns";
const EXTRACT_PATH = "/planner/extract";
const PLAN_LLM_V2_PATH = "/planner/plan_llm";
const DEFAULT_VERTICAL_NORM = "education";

export type PlannerRequestOptions = {
  signal?: AbortSignal;
};

export type PlannerEngine = "legacy" | "llm_v2";

export type RunSemanticPlannerInput = {
  engine: PlannerEngine;
  workspaceId: string;
  prompt: string;
  domainId?: number;
  vertical: string;
  debug?: boolean;
  maxConcepts?: number;
  maxColumns?: number;
};

export type PlannerResult = {
  sqlJson: Record<string, unknown> | null;
  raw: Record<string, unknown>;
  engine: PlannerEngine;
  traceId?: string;
  validation?: { is_valid: boolean; errors: string[]; repairs_applied: string[] };
  candidates?: { domains: unknown[]; concepts: unknown[]; columns: unknown[] };
  timingsMs?: Record<string, number>;
};

const toObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toStringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value == null ? fallback : String(value);

const toNumberValue = (value: unknown, fallback = 0): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toNullableNumberValue = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const toStringArray = (value: unknown): string[] => toArray(value).map((entry) => toStringValue(entry)).filter(Boolean);

const toNumberRecord = (value: unknown): Record<string, number> | undefined => {
  const record = toObject(value);
  if (!record) return undefined;
  const entries = Object.entries(record)
    .map(([key, val]) => [key, toNumberValue(val, Number.NaN)] as const)
    .filter((entry) => Number.isFinite(entry[1]));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const hasOwnKeys = (value: unknown): value is Record<string, unknown> => {
  const row = toObject(value);
  return Boolean(row && Object.keys(row).length > 0);
};

function isPlannerPayloadCandidate(payload: unknown): boolean {
  const candidate = toObject(payload);
  if (!candidate) return false;

  return [
    "deterministic",
    "concept_vector",
    "conceptVector",
    "concept_mapping",
    "conceptMapping",
    "column_vector",
    "columnVector",
    "llm_plan",
    "llmPlan",
    "debug",
  ].some((key) => key in candidate);
}

function normalizePlannerCandidate(payload: unknown): unknown {
  const candidate = toObject(payload);
  if (!candidate) return payload;

  const deterministic = toObject(candidate.deterministic);
  const conceptVector = toObject(candidate.concept_vector ?? candidate.conceptVector);
  const conceptMapping = toObject(candidate.concept_mapping ?? candidate.conceptMapping);
  const columnVector = toObject(candidate.column_vector ?? candidate.columnVector);
  const llmPlanRaw = candidate.llm_plan ?? candidate.llmPlan;
  const llmPlan = toObject(llmPlanRaw);
  const debugRaw = toObject(candidate.debug);
  const timingsRaw = toObject(debugRaw?.timings_ms ?? debugRaw?.timingsMs);
  const spacyRaw = toObject(candidate.spacy);

  const mappedColumns = toArray(conceptMapping?.mapped_columns ?? conceptMapping?.mappedColumns).map((entry) => {
    const row = toObject(entry);
    return {
      model_column_id: toNumberValue(row?.model_column_id ?? row?.modelColumnId),
      table_name: toStringValue(row?.table_name ?? row?.tableName),
      column_name: toStringValue(row?.column_name ?? row?.columnName),
      concept_key: toStringValue(row?.concept_key ?? row?.conceptKey),
      weight: toNumberValue(row?.weight, 1),
    };
  });

  const columnHits = toArray(columnVector?.hits).map((entry) => {
    const row = toObject(entry);
    return {
      model_column_id: toNumberValue(row?.model_column_id ?? row?.modelColumnId),
      score: toNumberValue(row?.score),
      table_name: toStringValue(row?.table_name ?? row?.tableName),
      column_name: toStringValue(row?.column_name ?? row?.columnName),
      concept_key: toStringValue(row?.concept_key ?? row?.conceptKey),
    };
  });

  const conceptHits = toArray(conceptVector?.hits).map((entry) => {
    const row = toObject(entry);
    return {
      concept_key: toStringValue(row?.concept_key ?? row?.conceptKey),
      concept_id: toNullableNumberValue(row?.concept_id ?? row?.conceptId),
      score: toNumberValue(row?.score),
      source: toStringValue(row?.source ?? "unknown"),
      alias_key: row?.alias_key == null ? null : toStringValue(row?.alias_key),
    };
  });

  const selectedColumns = toArray(llmPlan?.selected_columns ?? llmPlan?.selectedColumns).map((entry) => {
    const row = toObject(entry);
    return {
      concept_key: toStringValue(row?.concept_key ?? row?.conceptKey),
      model_column_id: toNumberValue(row?.model_column_id ?? row?.modelColumnId),
    };
  });

  const filters = toArray(llmPlan?.filters).map((entry) => {
    const row = toObject(entry);
    return {
      concept_key: toStringValue(row?.concept_key ?? row?.conceptKey),
      op: toStringValue(row?.op),
      value: row?.value,
    };
  });

  const matched = toArray(deterministic?.matched).map((entry) => {
    const row = toObject(entry);
    return {
      token: toStringValue(row?.token),
      concept_key: toStringValue(row?.concept_key ?? row?.conceptKey),
      confidence: toNumberValue(row?.confidence),
      reason: toStringValue(row?.reason),
    };
  });

  const validEdits = toArray(candidate.edits).filter((entry) => editOperationSchema.safeParse(entry).success);

  const normalizedSpacy = spacyRaw
    ? {
        normalized_text: toStringValue(spacyRaw.normalized_text ?? spacyRaw.normalizedText),
        ents: toArray(spacyRaw.ents).map((entry) => {
          const entity = toObject(entry);
          return {
            start: toNumberValue(entity?.start),
            end: toNumberValue(entity?.end),
            label: toStringValue(entity?.label),
            text: toStringValue(entity?.text),
          };
        }),
        by_label: (() => {
          const byLabel = toObject(spacyRaw.by_label ?? spacyRaw.byLabel);
          if (!byLabel) return {};
          return Object.fromEntries(
            Object.entries(byLabel).map(([label, values]) => [label, toStringArray(values)])
          );
        })(),
        slots: {
          metric: toStringArray(toObject(spacyRaw.slots)?.metric),
          dimensions: toStringArray(toObject(spacyRaw.slots)?.dimensions),
          subgroups: toStringArray(toObject(spacyRaw.slots)?.subgroups),
          time_ranges: toStringArray(toObject(spacyRaw.slots)?.time_ranges),
          org_schools: toStringArray(toObject(spacyRaw.slots)?.org_schools),
          org_districts: toStringArray(toObject(spacyRaw.slots)?.org_districts),
        },
        warnings: toStringArray(spacyRaw.warnings),
      }
    : undefined;

  return {
    prompt: toStringValue(candidate.prompt),
    deterministic: {
      matched,
      unmatched_tokens: toStringArray(deterministic?.unmatched_tokens ?? deterministic?.unmatchedTokens),
    },
    concept_vector: {
      query_text: toStringValue(
        conceptVector?.query_text ?? conceptVector?.queryText ?? candidate.prompt ?? ""
      ),
      hits: conceptHits,
    },
    concept_mapping: {
      concepts: toStringArray(conceptMapping?.concepts),
      mapped_columns: mappedColumns,
    },
    column_vector: {
      filtered_to_candidate_count: toNumberValue(
        columnVector?.filtered_to_candidate_count ?? columnVector?.filteredToCandidateCount,
        columnHits.length
      ),
      hits: columnHits,
    },
    llm_plan: llmPlan
      ? {
          model: toStringValue(llmPlan.model),
          sql_json: toObject(llmPlan.sql_json ?? llmPlan.sqlJson) ?? {},
          selected_columns: selectedColumns,
          filters,
          join_plan: toObject(llmPlan.join_plan ?? llmPlan.joinPlan) ?? {},
          confidence: toNumberValue(llmPlan.confidence),
          notes: toStringArray(llmPlan.notes),
        }
      : undefined,
    debug: {
      timings_ms: {
        deterministic: toNumberValue(timingsRaw?.deterministic),
        concept_vector: toNumberValue(timingsRaw?.concept_vector ?? timingsRaw?.conceptVector),
        concept_mapping: toNumberValue(timingsRaw?.concept_mapping ?? timingsRaw?.conceptMapping),
        column_vector: toNumberValue(timingsRaw?.column_vector ?? timingsRaw?.columnVector),
        llm: toNumberValue(timingsRaw?.llm),
      },
      warnings: toStringArray(debugRaw?.warnings),
    },
    edits: validEdits.length > 0 ? validEdits : undefined,
    explanation:
      candidate.explanation == null ? undefined : toStringValue(candidate.explanation),
    confidence:
      candidate.confidence == null ? undefined : toNumberValue(candidate.confidence),
    spacy: normalizedSpacy,
  };
}

function plannerResponseCandidates(payload: unknown): unknown[] {
  return [
    payload,
    (payload as { data?: unknown } | null)?.data,
    (payload as { item?: unknown } | null)?.item,
    (payload as { row?: unknown } | null)?.row,
    (payload as { result?: unknown } | null)?.result,
    (payload as { plan?: unknown } | null)?.plan,
    (payload as { response?: unknown } | null)?.response,
  ];
}

function responseRootObject(payload: unknown): Record<string, unknown> {
  const candidates = plannerResponseCandidates(payload);
  for (const candidate of candidates) {
    const object = toObject(candidate);
    if (object) return object;
  }
  return {};
}

function normalizeValidation(value: unknown): PlannerResult["validation"] {
  const row = toObject(value);
  if (!row) return undefined;
  return {
    is_valid: Boolean(row.is_valid),
    errors: toStringArray(row.errors),
    repairs_applied: toStringArray(row.repairs_applied),
  };
}

function normalizeCandidates(value: unknown): PlannerResult["candidates"] {
  const row = toObject(value);
  if (!row) return undefined;
  return {
    domains: toArray(row.domains),
    concepts: toArray(row.concepts),
    columns: toArray(row.columns),
  };
}

function extractTraceId(value: unknown): string | undefined {
  const row = toObject(value);
  if (!row) return undefined;
  const traceId = toStringValue(row.trace_id ?? row.traceId, "").trim();
  return traceId || undefined;
}

function normalizeEngineLegacyLabel(engine: PlannerEngine): string {
  return engine === "llm_v2" ? "LLM v2 (planner/plan_llm)" : "Legacy (semantic/plan)";
}

function isPlannerLlmDisabledError(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 404) return false;
  const payload = toObject(error.response?.data);
  const message = toStringValue(payload?.message ?? payload?.error, "").toLowerCase();
  return message.includes("planner_llm route disabled");
}

function buildBasePlannerResponse(prompt: string): PlannerResponse {
  return {
    prompt,
    deterministic: { matched: [], unmatched_tokens: [] },
    concept_vector: { query_text: prompt, hits: [] },
    concept_mapping: { concepts: [], mapped_columns: [] },
    column_vector: { filtered_to_candidate_count: 0, hits: [] },
    debug: {
      timings_ms: {
        deterministic: 0,
        concept_vector: 0,
        concept_mapping: 0,
        column_vector: 0,
        llm: 0,
      },
      warnings: [],
    },
  };
}

export function plannerResultToPlannerResponse(result: PlannerResult, promptFallback = ""): PlannerResponse {
  if (result.engine === "legacy") {
    try {
      return parsePlanResponse(result.raw);
    } catch {
      // fall through to normalized fallback
    }
  }

  const prompt = toStringValue(result.raw.prompt, promptFallback);
  const base = buildBasePlannerResponse(prompt);
  const llmSqlJson =
    result.sqlJson ??
    (hasOwnKeys((result.raw as Record<string, unknown>).sql_json) ? ((result.raw as Record<string, unknown>).sql_json as Record<string, unknown>) : null) ??
    (hasOwnKeys((result.raw as Record<string, unknown>).sqlJson) ? ((result.raw as Record<string, unknown>).sqlJson as Record<string, unknown>) : null) ??
    (hasOwnKeys((result.raw as Record<string, unknown>).plan_json) ? ((result.raw as Record<string, unknown>).plan_json as Record<string, unknown>) : null) ??
    (hasOwnKeys((result.raw as Record<string, unknown>).planJson) ? ((result.raw as Record<string, unknown>).planJson as Record<string, unknown>) : null);
  const timings = result.timingsMs ?? {};
  const getTiming = (...keys: string[]) => {
    for (const key of keys) {
      const value = timings[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return 0;
  };

  return {
    ...base,
    llm_plan: llmSqlJson
      ? {
          model: "planner/plan_llm",
          sql_json: llmSqlJson,
          selected_columns: [],
          filters: [],
          join_plan: {},
          confidence: result.validation?.is_valid ? 1 : 0,
          notes: result.validation?.errors ?? [],
        }
      : undefined,
    debug: {
      timings_ms: {
        deterministic: getTiming("deterministic"),
        concept_vector: getTiming("concept_vector", "conceptVector"),
        concept_mapping: getTiming("concept_mapping", "conceptMapping"),
        column_vector: getTiming("column_vector", "columnVector"),
        llm: getTiming("llm", "planner_llm", "plan"),
      },
      warnings: result.validation?.errors ?? [],
    },
    explanation: result.validation
      ? result.validation.is_valid
        ? `LLM v2 plan validated. Engine: ${normalizeEngineLegacyLabel(result.engine)}.`
        : `LLM v2 plan returned validation issues. Engine: ${normalizeEngineLegacyLabel(result.engine)}.`
      : `Plan generated by ${normalizeEngineLegacyLabel(result.engine)}.`,
    confidence: result.validation ? (result.validation.is_valid ? 1 : 0) : undefined,
  };
}

function parsePlanResponse(payload: unknown): PlannerResponse {
  const candidates = plannerResponseCandidates(payload);
  for (const candidate of candidates) {
    const parsed = plannerResponseSchema.safeParse(candidate);
    if (parsed.success) {
      return parsed.data;
    }
  }

  for (const candidate of candidates) {
    if (!isPlannerPayloadCandidate(candidate)) continue;
    const normalized = normalizePlannerCandidate(candidate);
    const parsed = plannerResponseSchema.safeParse(normalized);
    if (parsed.success) {
      return parsed.data;
    }
  }

  throw new Error("Invalid semantic plan response payload.");
}

function parseSpacyResponse(payload: unknown): SpacyExtraction {
  const candidates = plannerResponseCandidates(payload);
  for (const candidate of candidates) {
    const direct = spacyExtractionSchema.safeParse(candidate);
    if (direct.success) {
      return direct.data;
    }
    const nested = spacyExtractionSchema.safeParse((candidate as { spacy?: unknown } | null)?.spacy);
    if (nested.success) {
      return nested.data;
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizePlannerCandidate(candidate);
    const parsed = plannerResponseSchema.safeParse(normalized);
    if (parsed.success && parsed.data.spacy) {
      return parsed.data.spacy;
    }
  }

  throw new Error("Invalid planner extraction response payload.");
}

function parseSuggestResponse(payload: unknown): PlannerSuggestResponse {
  const candidates = plannerResponseCandidates(payload);

  for (const candidate of candidates) {
    const parsedSuggest = plannerSuggestResponseSchema.safeParse(candidate);
    if (parsedSuggest.success) {
      return parsedSuggest.data;
    }
  }

  for (const candidate of candidates) {
    if (!isPlannerPayloadCandidate(candidate)) continue;
    const normalized = normalizePlannerCandidate(candidate);
    const parsedPlan = plannerResponseSchema.safeParse(normalized);
    if (parsedPlan.success) {
      const plan = parsedPlan.data;
      return {
        ...plan,
        edits: plan.edits ?? [],
        explanation: plan.explanation?.trim() || "Suggested semantic columns.",
        confidence:
          typeof plan.confidence === "number"
            ? plan.confidence
            : typeof plan.llm_plan?.confidence === "number"
              ? plan.llm_plan.confidence
              : 0,
      };
    }
  }

  throw new Error("Invalid semantic suggest response payload.");
}

function plannerRequestConfig(workspaceId: string, signal?: AbortSignal) {
  return {
    signal,
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  };
}

type PlannerRequestPayload = Omit<PlannerRequest, "vertical_norm">;

function normalizePlannerRequest(payload: PlannerRequest): PlannerRequestPayload {
  const request = plannerRequestSchema.parse(payload);
  const { vertical_norm: _ignored, ...rest } = request;
  return {
    ...rest,
  };
}

export async function generateSemanticPlan(
  payload: PlannerRequest,
  options: PlannerRequestOptions = {}
): Promise<PlannerResponse> {
  try {
    const request = normalizePlannerRequest(payload);
    const response = await api.post(PLAN_PATH, request, plannerRequestConfig(request.workspace_id, options.signal));
    return parsePlanResponse(response.data);
  } catch (error) {
    throw toServiceError(error, "Unable to generate semantic plan.");
  }
}

export async function runSemanticPlanner(
  input: RunSemanticPlannerInput,
  options: PlannerRequestOptions = {}
): Promise<PlannerResult> {
  const workspaceId = toStringValue(input.workspaceId, "").trim();
  const prompt = toStringValue(input.prompt, "").trim();
  const vertical = toStringValue(input.vertical, "").trim() || DEFAULT_VERTICAL_NORM;

  if (!workspaceId || !prompt) {
    throw new Error("Workspace and prompt are required.");
  }

  if (input.engine === "legacy") {
    try {
      const request = normalizePlannerRequest({
        workspace_id: workspaceId,
        prompt,
        domain_id: input.domainId,
        debug: input.debug ?? false,
        max_concepts: input.maxConcepts,
        max_columns: input.maxColumns,
      });
      const response = await api.post(PLAN_PATH, request, plannerRequestConfig(workspaceId, options.signal));
      const parsed = parsePlanResponse(response.data);
      const responseRoot = responseRootObject(response.data);

      return {
        engine: "legacy",
        sqlJson:
          toObject(responseRoot.sql_json ?? responseRoot.sqlJson) ??
          toObject(parsed.llm_plan?.sql_json) ??
          null,
        raw: responseRoot,
        traceId: extractTraceId(responseRoot),
        validation: normalizeValidation(responseRoot.validation),
        candidates: normalizeCandidates(responseRoot.candidates),
        timingsMs: toNumberRecord(responseRoot.timings_ms ?? responseRoot.timingsMs ?? parsed.debug.timings_ms),
      };
    } catch (error) {
      throw toServiceError(error, "Unable to generate semantic plan.");
    }
  }

  try {
    const response = await api.post(
      PLAN_LLM_V2_PATH,
      {
        workspace_id: workspaceId,
        prompt,
        vertical,
        constraints: {
          max_domains: 3,
          max_columns: input.maxColumns ?? 40,
          max_concepts: input.maxConcepts ?? 25,
          allow_pii: false,
        },
        debug: input.debug ?? false,
      },
      plannerRequestConfig(workspaceId, options.signal)
    );

    const responseRoot = responseRootObject(response.data);
    const sqlJsonCandidate = toObject(responseRoot.sql_json ?? responseRoot.sqlJson);
    const planJsonCandidate = toObject(responseRoot.plan_json ?? responseRoot.planJson);
    const sqlJson =
      sqlJsonCandidate && Object.keys(sqlJsonCandidate).length > 0
        ? sqlJsonCandidate
        : planJsonCandidate && Object.keys(planJsonCandidate).length > 0
          ? planJsonCandidate
          : null;

    return {
      engine: "llm_v2",
      sqlJson,
      raw: responseRoot,
      traceId: extractTraceId(responseRoot),
      validation: normalizeValidation(responseRoot.validation),
      candidates: normalizeCandidates(responseRoot.candidates),
      timingsMs: toNumberRecord(responseRoot.timings_ms ?? responseRoot.timingsMs),
    };
  } catch (error) {
    if (isPlannerLlmDisabledError(error)) {
      throw new Error("LLM v2 planner is disabled on backend. Switch Planner Engine to Legacy.");
    }
    throw toServiceError(error, "Unable to generate semantic plan.");
  }
}

export async function suggestSemanticColumns(
  payload: PlannerRequest,
  options: PlannerRequestOptions = {}
): Promise<PlannerSuggestResponse> {
  try {
    const request = normalizePlannerRequest(payload);
    const response = await api.post(
      SUGGEST_COLUMNS_PATH,
      request,
      plannerRequestConfig(request.workspace_id, options.signal)
    );
    return parseSuggestResponse(response.data);
  } catch (error) {
    throw toServiceError(error, "Unable to suggest semantic columns.");
  }
}

export async function testPlannerExtraction(
  payload: PlannerExtractRequest,
  options: PlannerRequestOptions = {}
): Promise<SpacyExtraction> {
  try {
    const request = plannerExtractRequestSchema.parse(payload);
    const response = await api.post(EXTRACT_PATH, request, { signal: options.signal });
    return parseSpacyResponse(response.data);
  } catch (error) {
    throw toServiceError(error, "Unable to test planner extraction.");
  }
}
