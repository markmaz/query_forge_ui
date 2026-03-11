import axios from "axios";
import api, { getApiWorkspaceId } from "../../../../shared/services/api";
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
import { parseAiSuggestResponse } from "./types";

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
const aiSuggestEndpointPath = (import.meta.env.VITE_API_URL as string | undefined)?.includes("/api/v1")
  ? "/ai/suggest"
  : "/api/v1/ai/suggest";
const planDomainNextActionsEndpointPath = (import.meta.env.VITE_API_URL as string | undefined)?.includes("/api/v1")
  ? "/planner/plan_domain/next_actions"
  : "/api/v1/planner/plan_domain/next_actions";
const promptFeedbackEndpointPath = (import.meta.env.VITE_API_URL as string | undefined)?.includes("/api/v1")
  ? "/prompt-feedback"
  : "/api/v1/prompt-feedback";
const AI_SUGGEST_TELEMETRY_EVENT = "qf:ai-suggest-telemetry";
const PROMPT_FEEDBACK_TELEMETRY_EVENT = "qf:prompt-feedback-telemetry";
const NEXT_ACTION_TELEMETRY_EVENT = "qf:next-action-telemetry";

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

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readWorkspaceIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const camel = window.localStorage.getItem("workspaceId");
    if (typeof camel === "string" && camel.trim().length > 0) return camel.trim();
    const snake = window.localStorage.getItem("workspace_id");
    if (typeof snake === "string" && snake.trim().length > 0) return snake.trim();
  } catch {
    // ignore storage errors
  }
  return null;
}

function normalizeDomainContext(
  domainContext: AiSuggestRequest["domainContext"] | null | undefined
): AiSuggestRequest["domainContext"] | undefined {
  if (!domainContext) return undefined;
  const selectedDomainId =
    typeof domainContext.selectedDomainId === "number" && Number.isFinite(domainContext.selectedDomainId)
      ? domainContext.selectedDomainId
      : undefined;

  const candidates = Array.isArray(domainContext.domainCandidates)
    ? domainContext.domainCandidates
    : [];

  const normalizedCandidates = candidates
    .filter((candidate) => typeof candidate?.domainId === "number" && Number.isFinite(candidate.domainId))
    .map((candidate) => {
      const fallbackName = toNonEmptyString(candidate.domainName) ?? `Domain ${candidate.domainId}`;
      return {
        domainId: candidate.domainId,
        name: toNonEmptyString(candidate.name) ?? fallbackName,
        description: toNonEmptyString(candidate.description) ?? "",
        ...(toNonEmptyString(candidate.domainName) ? { domainName: toNonEmptyString(candidate.domainName) } : {}),
        ...(toNonEmptyString(candidate.domainKind) ? { domainKind: toNonEmptyString(candidate.domainKind) } : {}),
        ...(typeof candidate.score === "number" && Number.isFinite(candidate.score)
          ? { score: candidate.score }
          : {}),
      };
    });

  if (selectedDomainId == null && normalizedCandidates.length === 0) return undefined;
  return {
    ...(selectedDomainId != null ? { selectedDomainId } : {}),
    domainCandidates: normalizedCandidates,
  };
}

function normalizeCandidates(
  candidates: AiSuggestRequest["candidates"] | null | undefined
): AiSuggestRequest["candidates"] | undefined {
  if (!candidates) return undefined;

  const tables = Array.isArray(candidates.tables)
    ? candidates.tables.map((table) => ({
        ...(typeof table.tableId === "number" || table.tableId == null ? { tableId: table.tableId ?? null } : {}),
        tableName: String(table.tableName ?? ""),
        ...(typeof table.modelTableId === "number" || table.modelTableId == null
          ? { modelTableId: table.modelTableId ?? null }
          : {}),
        score: Number.isFinite(table.score) ? table.score : 0,
        reasons: Array.isArray(table.reasons) ? table.reasons.filter((reason): reason is string => typeof reason === "string") : [],
      }))
    : [];

  const columns = Array.isArray(candidates.columns)
    ? candidates.columns.map((column) => ({
        ...(typeof column.modelColumnId === "number" || column.modelColumnId == null
          ? { modelColumnId: column.modelColumnId ?? null }
          : {}),
        columnName: String(column.columnName ?? ""),
        ...(typeof column.workspaceTableId === "number" || column.workspaceTableId == null
          ? { workspaceTableId: column.workspaceTableId ?? null }
          : {}),
        ...(typeof column.modelTableId === "number" || column.modelTableId == null
          ? { modelTableId: column.modelTableId ?? null }
          : {}),
        ...(column.modelTableName == null || typeof column.modelTableName === "string"
          ? { modelTableName: column.modelTableName ?? null }
          : {}),
        label: String(column.label ?? column.columnName ?? ""),
        description: String(column.description ?? ""),
        ...(column.dataType == null || typeof column.dataType === "string" ? { dataType: column.dataType ?? null } : {}),
        score: Number.isFinite(column.score) ? column.score : 0,
        reasons: Array.isArray(column.reasons)
          ? column.reasons.filter((reason): reason is string => typeof reason === "string")
          : [],
      }))
    : [];

  if (tables.length === 0 && columns.length === 0) return undefined;
  return { tables, columns };
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

  if (status === 400) return "Invalid AI suggest request. Check prompt, payload, and workspace header.";
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
    const workspaceId = options?.workspaceId ?? getApiWorkspaceId() ?? readWorkspaceIdFromStorage() ?? null;
    const trimmedWorkspaceId = toNonEmptyString(workspaceId);
    const normalizedDomainContext = normalizeDomainContext(payload.domainContext);
    const normalizedCandidates = normalizeCandidates(payload.candidates);
    const requestPayload: AiSuggestRequest = {
      mode: payload.mode,
      prompt: (payload.prompt ?? "").trim(),
      ...(payload.debug === true ? { debug: true } : {}),
      ...(payload.currentSqlJson ? { currentSqlJson: payload.currentSqlJson } : {}),
      ...(normalizedDomainContext ? { domainContext: normalizedDomainContext } : {}),
      ...(normalizedCandidates ? { candidates: normalizedCandidates } : {}),
    };
    const response = await api.post(aiSuggestEndpointPath, requestPayload, {
      signal: options?.signal,
      headers: trimmedWorkspaceId ? { "X-Workspace-Id": trimmedWorkspaceId } : undefined,
    });

    try {
      const parsed = parseAiSuggestResponse(response.data);
      const deprecatedHeaderRaw = response.headers?.["x-queryforge-deprecated"];
      const deprecated =
        typeof deprecatedHeaderRaw === "string"
          ? deprecatedHeaderRaw.trim().toLowerCase() === "true"
          : false;
      const replacementHeaderRaw = response.headers?.["x-queryforge-replacement"];
      const replacement = typeof replacementHeaderRaw === "string" && replacementHeaderRaw.trim().length > 0
        ? replacementHeaderRaw.trim()
        : null;
      return {
        ...parsed,
        ...(deprecated || replacement
          ? {
              deprecation: {
                deprecated,
                replacement,
              },
            }
          : {}),
      };
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
    deprecation: response.deprecation,
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
  const prompt = (payload.userPrompt ?? "").trim();
  const workspaceId =
    toNonEmptyString(payload.workspaceId) ??
    toNonEmptyString(getApiWorkspaceId()) ??
    toNonEmptyString(readWorkspaceIdFromStorage());

  const requestPayload: PlanDomainRequest = {
    prompt,
    next_actions_async: true,
    ...(typeof payload.debug === "boolean" ? { debug: payload.debug } : {}),
    ...(typeof payload.fastMode === "boolean" ? { fast_mode: payload.fastMode } : {}),
    ...(typeof payload.baseDomainId === "number" && Number.isFinite(payload.baseDomainId)
      ? { base_domain_id: payload.baseDomainId }
      : {}),
    ...(typeof payload.conversationId === "string" && payload.conversationId.trim().length > 0
      ? { conversation_id: payload.conversationId.trim() }
      : {}),
  };

  try {
    const plannerResponse = await planDomain(requestPayload, {
      signal,
      workspaceId: workspaceId ?? null,
    });
    const parsed = parseAiSuggestResponse(plannerResponse as unknown);
    return toQueryStudioSuggestResponse(parsed);
  } catch (error) {
    const normalized = toAiSuggestApiError(error);
    if (normalized.message === "Request cancelled") {
      throw new DOMException("Request cancelled", "AbortError");
    }
    throw normalized;
  }
}
