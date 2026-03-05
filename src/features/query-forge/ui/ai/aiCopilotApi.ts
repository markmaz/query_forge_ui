import axios from "axios";
import api from "../../../../shared/services/api";
import { appRuntimeConfig } from "../../../../shared/config/runtime";
import type {
  AiSuggestRequest,
  AiSuggestResponse,
  PlanDomainRequest,
  PlanDomainNextActionsRequest,
  PlanDomainNextActionsResponse,
  PlanDomainResponse,
  PromptFeedbackRequest,
  PromptFeedbackResponse,
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
const planDomainEndpointPath = (import.meta.env.VITE_API_URL as string | undefined)?.includes("/api/v1")
  ? "/planner/plan_domain"
  : "/api/v1/planner/plan_domain";
const planDomainNextActionsEndpointPath = (import.meta.env.VITE_API_URL as string | undefined)?.includes("/api/v1")
  ? "/planner/plan_domain/next_actions"
  : "/api/v1/planner/plan_domain/next_actions";
const promptFeedbackEndpointPath = (import.meta.env.VITE_API_URL as string | undefined)?.includes("/api/v1")
  ? "/prompt-feedback"
  : "/api/v1/prompt-feedback";
const AI_SUGGEST_TELEMETRY_EVENT = "qf:ai-suggest-telemetry";
const PROMPT_FEEDBACK_TELEMETRY_EVENT = "qf:prompt-feedback-telemetry";
const NEXT_ACTION_TELEMETRY_EVENT = "qf:next-action-telemetry";
const DEFAULT_VERTICAL_NORM = "education";

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

export type PromptFeedbackTelemetryPayload = {
  event: "prompt_feedback";
  vote: "up" | "down";
  success: boolean;
  status?: number | null;
  trace_id?: string;
  timestamp: string;
};

export type NextActionTelemetryPayload = {
  event: "next_action_impression" | "next_action_clicked";
  count?: number;
  label?: string;
  intent?: string;
  confidence?: number;
  trace_id?: string;
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
    aggs: { enabled: false, metrics: [], groupBy: [], derivedMetrics: [] },
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
    rawResponse: {
      edits,
      explanation:
        request.prompt.trim() || "I built a starter query plan from your current QueryForge context.",
      confidence: request.mode === "ai_first" ? 0.86 : 0.72,
      sqlJson,
    },
    debug: {
      model: "queryforge-ai-mock",
      attempts: 1,
    },
  };
}

export function toAiSuggestUserMessage(error: unknown): string {
  const normalized = toAiSuggestApiError(error);
  const status = normalized.status;
  const backendMessage = extractErrorMessage(normalized.details);
  if (backendMessage) return backendMessage;
  if (
    typeof normalized.message === "string" &&
    normalized.message.trim() &&
    !/^Request failed with status code \d{3}$/i.test(normalized.message)
  ) {
    return normalized.message.trim();
  }

  if (status === 400) return "Invalid planner request. Check prompt and workspace header.";
  if (status === 404) return "Planner unavailable or no matching domain was found.";
  if (status === 401 || status === 403) return "Authentication or workspace access failed.";
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

export function emitPromptFeedbackTelemetry(
  payload: Omit<PromptFeedbackTelemetryPayload, "event" | "timestamp">
) {
  if (typeof window === "undefined") return;
  const eventPayload: PromptFeedbackTelemetryPayload = {
    event: "prompt_feedback",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push(eventPayload);
  }

  window.dispatchEvent(
    new CustomEvent<PromptFeedbackTelemetryPayload>(PROMPT_FEEDBACK_TELEMETRY_EVENT, {
      detail: eventPayload,
    })
  );
}

export function emitNextActionTelemetry(
  payload: Omit<NextActionTelemetryPayload, "timestamp">
) {
  if (typeof window === "undefined") return;
  const eventPayload: NextActionTelemetryPayload = {
    timestamp: new Date().toISOString(),
    ...payload,
  };

  const dataLayer = (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push(eventPayload);
  }

  window.dispatchEvent(
    new CustomEvent<NextActionTelemetryPayload>(NEXT_ACTION_TELEMETRY_EVENT, {
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

export async function planDomain(
  payload: PlanDomainRequest,
  options?: { signal?: AbortSignal; workspaceId?: string | null }
): Promise<PlanDomainResponse> {
  const workspaceId = options?.workspaceId ?? null;
  const response = await api.post<PlanDomainResponse>(planDomainEndpointPath, payload, {
    signal: options?.signal,
    headers: workspaceId ? { "X-Workspace-Id": workspaceId } : undefined,
  });
  return response.data;
}

export async function planDomainNextActions(
  payload: PlanDomainNextActionsRequest,
  options?: { signal?: AbortSignal; workspaceId?: string | null }
): Promise<PlanDomainNextActionsResponse> {
  const workspaceId = options?.workspaceId ?? payload.workspace_id ?? null;
  const response = await api.post<PlanDomainNextActionsResponse>(planDomainNextActionsEndpointPath, payload, {
    signal: options?.signal,
    headers: workspaceId ? { "X-Workspace-Id": workspaceId } : undefined,
  });
  return response.data;
}

export async function submitPromptFeedback(
  payload: PromptFeedbackRequest,
  options?: { signal?: AbortSignal; workspaceId?: string | null }
): Promise<PromptFeedbackResponse> {
  const workspaceId = options?.workspaceId ?? payload.workspace_id ?? null;
  const response = await api.post<PromptFeedbackResponse>(promptFeedbackEndpointPath, payload, {
    signal: options?.signal,
    headers: { "X-Workspace-Id": String(workspaceId ?? "") },
  });
  return response.data;
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
    const verticalNorm = (payload.vertical_norm ?? payload.verticalNorm ?? "").trim() || DEFAULT_VERTICAL_NORM;
    const workspaceId = options?.workspaceId ?? payload.workspaceId ?? null;
    const resolvedFastMode =
      typeof payload.fast_mode === "boolean"
        ? payload.fast_mode
        : appRuntimeConfig.planDomainFastModeDefault;
    const baseDomainCandidate =
      payload.domainContext?.selectedDomainId ??
      payload.currentSqlJson?.domainId ??
      null;
    const requestPayload: PlanDomainRequest = {
      prompt: (payload.prompt ?? "").trim(),
      vertical_norm: verticalNorm,
      fast_mode: resolvedFastMode,
      base_domain_id: typeof baseDomainCandidate === "number" && Number.isFinite(baseDomainCandidate)
        ? baseDomainCandidate
        : null,
      debug: payload.debug === true,
      next_actions_async: true,
      ...(typeof payload.conversation_id === "string" && payload.conversation_id.trim().length > 0
        ? { conversation_id: payload.conversation_id.trim() }
        : {}),
    };
    const response = await planDomain(requestPayload, {
      signal: options?.signal,
      workspaceId,
    });

    try {
      return parseAiSuggestResponse(response);
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

export function toQueryStudioSuggestResponse(response: AiSuggestResponse): QueryStudioSuggestResponse {
  const confidence = scoreToConfidence(response.confidence);
  const shouldHydrateSqlJson = response.sqlJsonHydratable !== false;
  return {
    message: response.explanation,
    confidence: response.confidence,
    debugAttempts: response.debug.attempts,
    conversationId: response.plannerMeta?.conversationId ?? null,
    plannerMeta: response.plannerMeta,
    rawResponse: response.rawResponse,
    suggestions: [
      {
        id: "backend-plan",
        title: "Apply AI query plan",
        why: response.explanation,
        confidence,
        actions: response.edits,
        ...(shouldHydrateSqlJson ? { sqlJson: response.sqlJson } : {}),
        debug: response.debug,
      },
    ],
    trace: {
      model: response.debug.model,
      attempts: response.debug.attempts,
      planner: response.plannerMeta,
    },
  };
}

export async function requestQueryStudioSuggestions(
  payload: QueryStudioSuggestRequest,
  signal?: AbortSignal
): Promise<QueryStudioSuggestResponse> {
  const hasBaseDomainOverride =
    typeof payload.baseDomainId === "number" && Number.isFinite(payload.baseDomainId);
  const sqlJsonWithDomainOverride = payload.sqlJson
    ? hasBaseDomainOverride
      ? { ...payload.sqlJson, domainId: payload.baseDomainId ?? null }
      : payload.sqlJson
    : undefined;
  const domainContextWithOverride = payload.domainContext
    ? hasBaseDomainOverride
      ? { ...payload.domainContext, selectedDomainId: payload.baseDomainId ?? null }
      : payload.domainContext
    : hasBaseDomainOverride
      ? { selectedDomainId: payload.baseDomainId ?? null }
      : undefined;

  const requestPayload: AiSuggestRequest = {
    mode: mapSectionToAiMode(payload.activeSection),
    prompt: (payload.userPrompt ?? "").trim(),
    ...(typeof payload.conversationId === "string" && payload.conversationId.trim().length > 0
      ? { conversation_id: payload.conversationId.trim() }
      : {}),
    ...(typeof payload.verticalNorm === "string" && payload.verticalNorm.trim().length > 0
      ? { vertical_norm: payload.verticalNorm.trim() }
      : {}),
    ...(typeof payload.fastMode === "boolean" ? { fast_mode: payload.fastMode } : {}),
    ...(typeof payload.debug === "boolean" ? { debug: payload.debug } : {}),
  };
  if (sqlJsonWithDomainOverride) {
    requestPayload.currentSqlJson = sqlJsonWithDomainOverride;
  }
  if (domainContextWithOverride) {
    requestPayload.domainContext = domainContextWithOverride;
  }
  if (payload.candidates) {
    requestPayload.candidates = payload.candidates;
  }

  const response = await aiSuggest(requestPayload, { signal, workspaceId: payload.workspaceId });
  return toQueryStudioSuggestResponse(response);
}
