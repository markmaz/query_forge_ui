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

export type PlannerRequestOptions = {
  signal?: AbortSignal;
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

export async function generateSemanticPlan(
  payload: PlannerRequest,
  options: PlannerRequestOptions = {}
): Promise<PlannerResponse> {
  try {
    const request = plannerRequestSchema.parse(payload);
    const response = await api.post(PLAN_PATH, request, plannerRequestConfig(request.workspace_id, options.signal));
    return parsePlanResponse(response.data);
  } catch (error) {
    throw toServiceError(error, "Unable to generate semantic plan.");
  }
}

export async function suggestSemanticColumns(
  payload: PlannerRequest,
  options: PlannerRequestOptions = {}
): Promise<PlannerSuggestResponse> {
  try {
    const request = plannerRequestSchema.parse(payload);
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
