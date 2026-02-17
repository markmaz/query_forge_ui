import axios from "axios";
import api from "../../../../shared/services/api";
import type {
  AiSuggestRequest,
  AiSuggestResponse,
  QueryStudioSuggestRequest,
  QueryStudioSuggestResponse,
  SqlFilterOperator,
} from "./types";
import { mapSectionToAiMode, parseAiSuggestResponse } from "./types";

const AI_MOCK_OVERRIDE_KEY = "__QF_AI_MOCK_ENABLED__";
const isMockEnabled = () => {
  const override = (globalThis as Record<string, unknown>)[AI_MOCK_OVERRIDE_KEY];
  if (typeof override === "boolean") return override;
  // Backend-first by default; mock mode must be explicitly enabled.
  return (import.meta.env.VITE_QUERYFORGE_AI_MOCK ?? "0") !== "0";
};
const endpointPath = (import.meta.env.VITE_API_URL as string | undefined)?.includes("/api/v1")
  ? "/ai/suggest"
  : "/api/v1/ai/suggest";
const AI_SUGGEST_TELEMETRY_EVENT = "qf:ai-suggest-telemetry";

export type AiSuggestTelemetryPayload = {
  event: "ai_suggest";
  mode: string;
  prompt_length: number;
  success: boolean;
  latency_ms: number;
  debug_attempts?: number;
  error_status?: number | null;
  timestamp: string;
};

export class AiSuggestApiError extends Error {
  readonly status: number | null;
  readonly details: unknown;
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    options?: { status?: number | null; details?: unknown; isNetworkError?: boolean }
  ) {
    super(message);
    this.name = "AiSuggestApiError";
    this.status = options?.status ?? null;
    this.details = options?.details;
    this.isNetworkError = options?.isNetworkError ?? false;
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Request cancelled", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) return value as Record<string, unknown>;
  return {};
}

function extractErrorMessage(data: unknown): string | null {
  const body = asRecord(data);
  const message = body.message ?? body.error ?? body.detail;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function toStatusCode(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return typeof error.response?.status === "number" ? error.response.status : null;
  }
  if (error instanceof AiSuggestApiError) {
    return error.status;
  }
  return null;
}

function toAiSuggestApiError(error: unknown): AiSuggestApiError {
  if (error instanceof AiSuggestApiError) return error;

  if (axios.isCancel(error) || (error instanceof DOMException && error.name === "AbortError")) {
    return new AiSuggestApiError("Request cancelled", { status: null });
  }

  if (axios.isAxiosError(error)) {
    const status = typeof error.response?.status === "number" ? error.response.status : null;
    const details = error.response?.data;
    const message = extractErrorMessage(details) ?? error.message ?? "AI request failed";
    return new AiSuggestApiError(message, {
      status,
      details,
      isNetworkError: !error.response,
    });
  }

  return new AiSuggestApiError("AI request failed", { status: null, details: error });
}

function scoreToConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function emptySqlJson() {
  return {
    version: 1 as const,
    domainId: null,
    columns: [],
    prompt: "",
    dataPrep: null,
    filters: null,
    aggs: { enabled: false, metrics: [], groupBy: [] },
    sorting: [],
    distinct: true,
    value_overrides: { a: null, b: null, c: null },
    value_overrideAttachments: [],
    cohortAttachment: null,
    meta: { tool: "query_builder" },
  };
}

function key(columnName: string) {
  return { modelColumnId: null, columnName, workspaceTableId: null, exprId: null };
}

function filterOpForMode(mode: AiSuggestRequest["mode"]): SqlFilterOperator {
  if (mode === "columns") return "equals";
  if (mode === "filters") return "contains";
  return "equals";
}

function buildMockResponse(request: AiSuggestRequest): AiSuggestResponse {
  const current = { ...emptySqlJson(), ...(request.currentSqlJson ?? {}) };
  const edits: AiSuggestResponse["edits"] = [];
  let sqlJson = { ...current };

  if (request.mode === "domains" || request.mode === "ai_first") {
    const selected = request.domainContext?.selectedDomainId ?? request.domainContext?.domainCandidates?.[0]?.domainId;
    if (typeof selected === "number") {
      edits.push({ op: "setDomain", domainId: selected });
      sqlJson = { ...sqlJson, domainId: selected };
    }
  }

  const candidateColumn = request.candidates?.columns?.[0]?.columnName ?? "patient_id";
  const secondColumn = request.candidates?.columns?.[1]?.columnName ?? "patient_gender";
  const addSelect = (name: string) => {
    const col = key(name);
    edits.push({ op: "addSelect", col });
    const exists = (sqlJson.columns ?? []).some((c) => c.columnName === name);
    if (!exists) sqlJson = { ...sqlJson, columns: [...(sqlJson.columns ?? []), col] };
  };

  if (request.mode === "columns" || request.mode === "ai_first" || request.mode === "domains") {
    addSelect(candidateColumn);
    addSelect(secondColumn);
  }

  if (request.mode === "filters" || request.mode === "ai_first") {
    edits.push({
      op: "addFilter",
      col: key(candidateColumn),
      operator: filterOpForMode(request.mode),
      value: request.mode === "filters" ? "active" : "P-100",
    });
  }

  if (request.mode === "aggregation") {
    edits.push({ op: "addGroupBy", col: key(secondColumn) });
    edits.push({
      op: "addAggregate",
      func: "count",
      col: null,
      alias: "row_count",
    });
  }

  if (request.mode === "data_prep") {
    edits.push({
      op: "addSort",
      col: key(candidateColumn),
      dir: "asc",
    });
  }

  return {
    edits,
    explanation:
      request.prompt.trim() || "I built a starter query plan from your current QueryForge context.",
    confidence: request.mode === "ai_first" ? 0.86 : 0.72,
    sqlJson,
    debug: {
      model: "queryforge-ai-mock",
      attempts: 1,
    },
  };
}

export function toAiSuggestUserMessage(error: unknown): string {
  const status = toStatusCode(error);
  if (status === 400) return "Invalid AI request";
  if (status === 500) return "AI returned invalid structured output";
  if (status === 502 || status === 503 || status == null) return "AI service unavailable";
  return "Unable to get suggestions right now.";
}

export function emitAiSuggestTelemetry(payload: Omit<AiSuggestTelemetryPayload, "event" | "timestamp">) {
  if (typeof window === "undefined") return;
  const eventPayload: AiSuggestTelemetryPayload = {
    event: "ai_suggest",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push(eventPayload);
  }

  window.dispatchEvent(
    new CustomEvent<AiSuggestTelemetryPayload>(AI_SUGGEST_TELEMETRY_EVENT, {
      detail: eventPayload,
    })
  );
}

export function setAiSuggestMockEnabledForTests(enabled: boolean | null) {
  if (enabled === null) {
    delete (globalThis as Record<string, unknown>)[AI_MOCK_OVERRIDE_KEY];
    return;
  }
  (globalThis as Record<string, unknown>)[AI_MOCK_OVERRIDE_KEY] = enabled;
}

export async function aiSuggest(
  payload: AiSuggestRequest,
  options?: { signal?: AbortSignal; workspaceId?: string | null }
): Promise<AiSuggestResponse> {
  if (isMockEnabled()) {
    await sleep(250, options?.signal);
    return buildMockResponse(payload);
  }

  try {
    const response = await api.post(endpointPath, payload, {
      signal: options?.signal,
      headers: options?.workspaceId ? { "X-Workspace-Id": options.workspaceId } : undefined,
    });

    try {
      return parseAiSuggestResponse(response.data);
    } catch (parseError) {
      throw new AiSuggestApiError("AI returned invalid structured output", {
        status: 500,
        details: parseError,
      });
    }
  } catch (error) {
    const normalized = toAiSuggestApiError(error);
    if (normalized.message === "Request cancelled") {
      throw new DOMException("Request cancelled", "AbortError");
    }
    throw normalized;
  }
}

export async function requestQueryStudioSuggestions(
  payload: QueryStudioSuggestRequest,
  signal?: AbortSignal
): Promise<QueryStudioSuggestResponse> {
  const requestPayload: AiSuggestRequest = {
    mode: mapSectionToAiMode(payload.activeSection),
    prompt: (payload.userPrompt ?? "").trim(),
  };
  if (payload.sqlJson) {
    requestPayload.currentSqlJson = payload.sqlJson;
  }
  if (payload.domainContext) {
    requestPayload.domainContext = payload.domainContext;
  }
  if (payload.candidates) {
    requestPayload.candidates = payload.candidates;
  }

  const response = await aiSuggest(requestPayload, { signal, workspaceId: payload.workspaceId });

  const confidence = scoreToConfidence(response.confidence);

  return {
    message: response.explanation,
    confidence: response.confidence,
    debugAttempts: response.debug.attempts,
    suggestions: [
      {
        id: "backend-plan",
        title: "Apply AI query plan",
        why: response.explanation,
        confidence,
        actions: response.edits,
        sqlJson: response.sqlJson,
        debug: response.debug,
      },
    ],
    trace: {
      model: response.debug.model,
      attempts: response.debug.attempts,
    },
  };
}
