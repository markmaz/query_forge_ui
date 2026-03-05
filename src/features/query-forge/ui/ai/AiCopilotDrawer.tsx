import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  aiCopilotReducer,
  createInitialAiCopilotState,
  type AiCopilotState,
} from "./aiCopilotSlice";
import {
  emitAiSuggestTelemetry,
  emitNextActionTelemetry,
  emitPromptFeedbackTelemetry,
  planDomainNextActions,
  submitPromptFeedback,
  toAiSuggestUserMessage,
} from "./aiCopilotApi";
import {
  mapSectionToAiMode,
  type AiSuggestion,
  type AiCopilotSection,
  type PlannerNextAction,
  type PromptFeedbackRequest,
  type PromptFeedbackVote,
  type QueryStudioSuggestRequest,
} from "./types";
import type { SqlQueryJson } from "../../model/sqlJson";
import { PlanExplanation } from "./components/PlanExplanation";
import { toast } from "react-toastify";
import { usePlannerConversation } from "./usePlannerConversation";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asNumberRecord(value: unknown): Record<string, number> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const entries = Object.entries(record).filter(([, entry]) => typeof entry === "number" && Number.isFinite(entry));
  if (!entries.length) return undefined;
  return Object.fromEntries(entries) as Record<string, number>;
}

function toNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const AI_COPILOT_HISTORY_STORAGE_KEY = "query_forge.ai_copilot.history";
const AI_COPILOT_HISTORY_STORAGE_VERSION = 1;

type PersistedAiCopilotThread = {
  version: number;
  history: AiCopilotState["history"];
  feedbackByResponseId: Record<string, PromptFeedbackVote | null>;
};

function getAiCopilotStorageKey(workspaceId: string | null, userId?: string | null): string {
  return `${AI_COPILOT_HISTORY_STORAGE_KEY}:${workspaceId?.trim() || "global"}:${userId?.trim() || "user"}`;
}

function readPersistedAiCopilotThread(
  workspaceId: string | null,
  userId?: string | null
): PersistedAiCopilotThread | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getAiCopilotStorageKey(workspaceId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      history?: unknown;
      feedbackByResponseId?: unknown;
    };
    if (parsed.version !== AI_COPILOT_HISTORY_STORAGE_VERSION) return null;
    const history = Array.isArray(parsed.history)
      ? (parsed.history.slice(-10) as AiCopilotState["history"])
      : [];
    const feedbackRaw =
      parsed.feedbackByResponseId && typeof parsed.feedbackByResponseId === "object"
        ? (parsed.feedbackByResponseId as Record<string, unknown>)
        : {};
    const feedbackByResponseId = Object.fromEntries(
      Object.entries(feedbackRaw).filter(([, value]) => value === "up" || value === "down" || value === null)
    ) as Record<string, PromptFeedbackVote | null>;
    return {
      version: AI_COPILOT_HISTORY_STORAGE_VERSION,
      history,
      feedbackByResponseId,
    };
  } catch {
    return null;
  }
}

function buildInitialAiCopilotState(
  section: AiCopilotSection,
  persistedThread: PersistedAiCopilotThread | null
): AiCopilotState {
  const initial = createInitialAiCopilotState(section);
  const history = persistedThread?.history ?? [];
  if (!history.length) return initial;
  const latest = history[history.length - 1];
  return {
    ...initial,
    history,
    message: latest?.responseMessage ?? "",
    suggestions: latest?.suggestions ?? [],
    plannerMeta: latest?.plannerMeta ?? null,
  };
}

export function AiCopilotDrawer(props: {
  activeSection: AiCopilotSection;
  workspaceId: string | null;
  userId?: string | null;
  sqlJson?: SqlQueryJson | null;
  domainContext?: QueryStudioSuggestRequest["domainContext"];
  candidates?: QueryStudioSuggestRequest["candidates"];
  onApplySuggestion: (suggestion: AiSuggestion) => void;
  onClose: () => void;
}) {
  const { workspaceId, userId = null, sqlJson, domainContext, candidates, onApplySuggestion, onClose } =
    props;
  const copilotSection: AiCopilotSection = "AI First";
  const plannerConversation = usePlannerConversation({
    workspaceId,
    userId,
    activeSection: copilotSection,
    sqlJson,
    domainContext,
    candidates,
  });
  const persistedThread = useMemo(() => readPersistedAiCopilotThread(workspaceId, userId), [workspaceId, userId]);
  const [state, dispatch] = React.useReducer(
    aiCopilotReducer,
    {
      activeSection: copilotSection,
      persistedThread,
    },
    ({ activeSection: initialSection, persistedThread: initialPersistedThread }) =>
      buildInitialAiCopilotState(initialSection, initialPersistedThread)
  );
  const [goal, setGoal] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [feedbackByResponseId, setFeedbackByResponseId] = useState<
    Record<string, "up" | "down" | null>
  >(() => persistedThread?.feedbackByResponseId ?? {});
  const [feedbackLoadingByResponseId, setFeedbackLoadingByResponseId] = useState<
    Record<string, boolean>
  >({});
  const [copiedPromptKey, setCopiedPromptKey] = useState<string | null>(null);
  const [asyncNextActionsByEntryId, setAsyncNextActionsByEntryId] = useState<Record<string, PlannerNextAction[]>>({});
  const [nextActionsLoadingByEntryId, setNextActionsLoadingByEntryId] = useState<Record<string, boolean>>({});
  const [nextActionsErrorByEntryId, setNextActionsErrorByEntryId] = useState<Record<string, string | null>>({});
  const [nextActionsStatusByEntryId, setNextActionsStatusByEntryId] = useState<
    Record<string, "deferred" | "ready" | undefined>
  >({});
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const nextActionImpressionKeysRef = useRef<Set<string>>(new Set());
  const copiedPromptTimerRef = useRef<number | null>(null);
  const nextActionsRequestSeqRef = useRef<Record<string, number>>({});
  const nextActionsAbortByEntryRef = useRef<Record<string, AbortController>>({});

  const cancelAllDeferredNextActionsRequests = () => {
    Object.values(nextActionsAbortByEntryRef.current).forEach((controller) => controller.abort());
    nextActionsAbortByEntryRef.current = {};
    nextActionsRequestSeqRef.current = {};
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getAiCopilotStorageKey(workspaceId, userId);
    const hasFeedback = Object.keys(feedbackByResponseId).length > 0;
    if (!state.history.length && !hasFeedback) {
      window.localStorage.removeItem(key);
      return;
    }

    const payload: PersistedAiCopilotThread = {
      version: AI_COPILOT_HISTORY_STORAGE_VERSION,
      history: state.history,
      feedbackByResponseId,
    };

    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      try {
        // Fall back to a smaller payload when localStorage quota is tight.
        const compactHistory = state.history.map(({ rawResponse, ...rest }) => rest);
        window.localStorage.setItem(
          key,
          JSON.stringify({
            version: AI_COPILOT_HISTORY_STORAGE_VERSION,
            history: compactHistory,
            feedbackByResponseId,
          })
        );
      } catch {
        // no-op
      }
    }
  }, [workspaceId, userId, state.history, feedbackByResponseId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      cancelAllDeferredNextActionsRequests();
      if (copiedPromptTimerRef.current) {
        window.clearTimeout(copiedPromptTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [state.history.length, state.loading, state.error]);

  const copyPromptToClipboard = async (promptText: string, promptKey: string) => {
    if (!promptText.trim()) return;
    try {
      await navigator.clipboard?.writeText(promptText);
      setCopiedPromptKey(promptKey);
      if (copiedPromptTimerRef.current) {
        window.clearTimeout(copiedPromptTimerRef.current);
      }
      copiedPromptTimerRef.current = window.setTimeout(() => {
        setCopiedPromptKey((prev) => (prev === promptKey ? null : prev));
      }, 1200);
    } catch {
      // no-op: copying is a convenience action
    }
  };

  const submitPrompt = async (promptText?: string) => {
    const prompt = (promptText ?? goal).trim();
    if (!prompt || state.loading) return;

    const startedAt = Date.now();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "requestStart" });
    setPendingPrompt(prompt);
    setGoal("");

    try {
      const response = await plannerConversation.sendPrompt(prompt, {
        signal: controller.signal,
      });
      dispatch({ type: "requestSuccess", response, prompt });
      setPendingPrompt(null);
      emitAiSuggestTelemetry({
        mode: mapSectionToAiMode(copilotSection),
        prompt_length: prompt.length,
        success: true,
        latency_ms: Date.now() - startedAt,
        debug_attempts: response.debugAttempts,
      });
    } catch (err) {
      if (isAbortError(err)) {
        dispatch({ type: "requestCancel" });
        setPendingPrompt(null);
        return;
      }
      dispatch({ type: "requestError", error: toAiSuggestUserMessage(err) });
      setPendingPrompt(null);
      const status = typeof err === "object" && err && "status" in err ? Number((err as any).status) : null;
      emitAiSuggestTelemetry({
        mode: mapSectionToAiMode(copilotSection),
        prompt_length: prompt.length,
        success: false,
        latency_ms: Date.now() - startedAt,
        error_status: Number.isFinite(status) ? status : null,
      });
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    dispatch({ type: "requestCancel" });
  };

  const handleSendButtonClick = () => {
    if (state.loading) {
      handleCancel();
      return;
    }
    void submitPrompt();
  };

  const handleNewSession = () => {
    abortRef.current?.abort();
    cancelAllDeferredNextActionsRequests();
    dispatch({ type: "clearHistory" });
    plannerConversation.newSession();
    setPendingPrompt(null);
    setGoal("");
    setFeedbackByResponseId({});
    setFeedbackLoadingByResponseId({});
    setAsyncNextActionsByEntryId({});
    setNextActionsLoadingByEntryId({});
    setNextActionsErrorByEntryId({});
    setNextActionsStatusByEntryId({});
  };

  const handleClearHistory = () => {
    abortRef.current?.abort();
    cancelAllDeferredNextActionsRequests();
    dispatch({ type: "clearHistory" });
    plannerConversation.newSession();
    setPendingPrompt(null);
    setGoal("");
    setFeedbackByResponseId({});
    setFeedbackLoadingByResponseId({});
    setAsyncNextActionsByEntryId({});
    setNextActionsLoadingByEntryId({});
    setNextActionsErrorByEntryId({});
    setNextActionsStatusByEntryId({});
  };

  const handleThumb = async (
    entry: {
      id: string;
      prompt: string;
      responseMessage: string;
      rawResponse?: unknown;
      plannerMeta: {
        traceId?: string;
        timingsMs?: Record<string, number>;
        planJsonV2: { base_domain_id: number; intent?: string; [key: string]: unknown };
      } | null;
      suggestions: AiSuggestion[];
    },
    vote: PromptFeedbackVote
  ) => {
    if (!workspaceId?.trim()) {
      toast.error("Unable to save feedback without a workspace.");
      return;
    }
    if (feedbackLoadingByResponseId[entry.id]) return;

    const rawResponse = asRecord(entry.rawResponse);
    const rawPlan = asRecord(rawResponse?.plan_json_v2);
    const rawSqlJson = asRecord(rawResponse?.sql_json);
    const rawSqlMeta = asRecord(rawSqlJson?.meta);
    const rawDebug = asRecord(rawResponse?.debug);
    const traceId =
      entry.plannerMeta?.traceId ??
      toNonEmptyString(rawResponse?.trace_id) ??
      toNonEmptyString(rawResponse?.traceId);
    const previousVote = feedbackByResponseId[entry.id] ?? null;

    const feedbackPayload: PromptFeedbackRequest = {
      workspace_id: workspaceId,
      vote,
      ...(traceId ? { trace_id: traceId } : {}),
      ...(toNonEmptyString(rawResponse?.normalized_prompt) ||
      toNonEmptyString(rawPlan?.normalized_prompt) ||
      toNonEmptyString(rawSqlMeta?.normalized_prompt)
        ? {
            normalized_prompt:
              toNonEmptyString(rawResponse?.normalized_prompt) ??
              toNonEmptyString(rawPlan?.normalized_prompt) ??
              toNonEmptyString(rawSqlMeta?.normalized_prompt),
          }
        : {}),
      ...(entry.prompt ? { prompt_text: entry.prompt } : {}),
      response_json: entry.rawResponse ?? {
        message: entry.responseMessage,
        plannerMeta: entry.plannerMeta,
        suggestions: entry.suggestions,
      },
      meta: {
        ...(toNonEmptyString(entry.suggestions[0]?.debug?.model) || toNonEmptyString(rawDebug?.model)
          ? {
              model:
                toNonEmptyString(entry.suggestions[0]?.debug?.model) ??
                toNonEmptyString(rawDebug?.model),
            }
          : {}),
        ...(entry.plannerMeta?.timingsMs || asNumberRecord(rawResponse?.timings_ms)
          ? {
              timings_ms: entry.plannerMeta?.timingsMs ?? asNumberRecord(rawResponse?.timings_ms),
            }
          : {}),
        ...(Number.isFinite(entry.plannerMeta?.planJsonV2.base_domain_id)
          ? { domain_id: entry.plannerMeta?.planJsonV2.base_domain_id }
          : typeof rawSqlJson?.domainId === "number" && Number.isFinite(rawSqlJson.domainId)
            ? { domain_id: rawSqlJson.domainId }
            : {}),
        ...(rawPlan && "domain_version" in rawPlan
          ? { domain_version: rawPlan.domain_version as number | string }
          : {}),
        ...(toNonEmptyString(entry.plannerMeta?.planJsonV2.intent) || toNonEmptyString(rawPlan?.intent)
          ? {
              intent:
                toNonEmptyString(entry.plannerMeta?.planJsonV2.intent) ??
                toNonEmptyString(rawPlan?.intent),
            }
          : {}),
      },
    };

    setFeedbackByResponseId((prev) => ({ ...prev, [entry.id]: vote }));
    setFeedbackLoadingByResponseId((prev) => ({ ...prev, [entry.id]: true }));

    try {
      const response = await submitPromptFeedback(feedbackPayload, { workspaceId });
      setFeedbackByResponseId((prev) => ({
        ...prev,
        [entry.id]: response.vote === "down" ? "down" : "up",
      }));
      emitPromptFeedbackTelemetry({
        vote,
        success: true,
        ...(traceId ? { trace_id: traceId } : {}),
      });
    } catch (error) {
      setFeedbackByResponseId((prev) => ({ ...prev, [entry.id]: previousVote }));
      const status =
        typeof error === "object" &&
        error &&
        "response" in error &&
        typeof (error as { response?: { status?: unknown } }).response?.status === "number"
          ? ((error as { response?: { status?: number } }).response?.status ?? null)
          : null;
      emitPromptFeedbackTelemetry({
        vote,
        success: false,
        status,
        ...(traceId ? { trace_id: traceId } : {}),
      });
      toast.error("Could not save feedback. Please try again.");
    } finally {
      setFeedbackLoadingByResponseId((prev) => ({ ...prev, [entry.id]: false }));
    }
  };

  const orderedHistory = useMemo(() => state.history, [state.history]);

  useEffect(() => {
    for (const entry of orderedHistory) {
      const resolvedStatus = nextActionsStatusByEntryId[entry.id] ?? entry.plannerMeta?.nextActionsStatus;
      const resolvedNextActions = asyncNextActionsByEntryId[entry.id] ?? entry.plannerMeta?.nextActions ?? [];
      const isLoading = Boolean(nextActionsLoadingByEntryId[entry.id]);
      const hasError = Boolean(nextActionsErrorByEntryId[entry.id]);
      const shouldFetch =
        resolvedStatus === "deferred" &&
        resolvedNextActions.length === 0 &&
        !isLoading &&
        !hasError;
      if (!shouldFetch) continue;

      if (!workspaceId?.trim()) {
        setNextActionsErrorByEntryId((prev) => ({ ...prev, [entry.id]: "Suggestions unavailable" }));
        continue;
      }

      const previousController = nextActionsAbortByEntryRef.current[entry.id];
      previousController?.abort();
      const controller = new AbortController();
      nextActionsAbortByEntryRef.current[entry.id] = controller;

      const requestSeq = (nextActionsRequestSeqRef.current[entry.id] ?? 0) + 1;
      nextActionsRequestSeqRef.current[entry.id] = requestSeq;

      setNextActionsLoadingByEntryId((prev) => ({ ...prev, [entry.id]: true }));
      setNextActionsErrorByEntryId((prev) => ({ ...prev, [entry.id]: null }));

      const rawResponse = asRecord(entry.rawResponse);
      const conversationId =
        entry.plannerMeta?.conversationId ??
        toNonEmptyString(rawResponse?.conversation_id) ??
        null;
      const traceId =
        entry.plannerMeta?.traceId ??
        toNonEmptyString(rawResponse?.trace_id) ??
        undefined;
      const verticalNorm = toNonEmptyString(entry.plannerMeta?.planJsonV2.vertical_norm) ?? "education";

      void planDomainNextActions(
        {
          workspace_id: workspaceId,
          prompt: entry.prompt,
          plan_json_v2: entry.plannerMeta?.planJsonV2 ?? ({} as any),
          vertical_norm: verticalNorm,
          ...(conversationId ? { conversation_id: conversationId } : {}),
          ...(traceId ? { trace_id: traceId } : {}),
        },
        { signal: controller.signal, workspaceId }
      )
        .then((payload) => {
          if (nextActionsRequestSeqRef.current[entry.id] !== requestSeq) return;
          const nextActions = Array.isArray(payload.next_actions)
            ? (payload.next_actions as PlannerNextAction[])
            : [];
          const nextActionsStatus = payload.next_actions_status === "deferred" ? "deferred" : "ready";
          setAsyncNextActionsByEntryId((prev) => ({ ...prev, [entry.id]: nextActions }));
          setNextActionsStatusByEntryId((prev) => ({ ...prev, [entry.id]: nextActionsStatus }));
          setNextActionsErrorByEntryId((prev) => ({ ...prev, [entry.id]: null }));
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (nextActionsRequestSeqRef.current[entry.id] !== requestSeq) return;
          setNextActionsErrorByEntryId((prev) => ({ ...prev, [entry.id]: "Suggestions unavailable" }));
          setNextActionsStatusByEntryId((prev) => ({ ...prev, [entry.id]: "ready" }));
        })
        .finally(() => {
          if (nextActionsRequestSeqRef.current[entry.id] !== requestSeq) return;
          setNextActionsLoadingByEntryId((prev) => ({ ...prev, [entry.id]: false }));
          delete nextActionsAbortByEntryRef.current[entry.id];
        });
    }
  }, [
    asyncNextActionsByEntryId,
    nextActionsErrorByEntryId,
    nextActionsLoadingByEntryId,
    nextActionsStatusByEntryId,
    orderedHistory,
    workspaceId,
  ]);

  useEffect(() => {
    for (const entry of orderedHistory) {
      const nextActions = asyncNextActionsByEntryId[entry.id] ?? entry.plannerMeta?.nextActions ?? [];
      if (!nextActions.length) continue;
      const impressionKey = `${entry.id}:${nextActions
        .map((action) => `${action.label}|${action.prompt}`)
        .join("||")}`;
      if (nextActionImpressionKeysRef.current.has(impressionKey)) continue;
      nextActionImpressionKeysRef.current.add(impressionKey);
      emitNextActionTelemetry({
        event: "next_action_impression",
        count: nextActions.length,
        ...(entry.plannerMeta?.traceId ? { trace_id: entry.plannerMeta.traceId } : {}),
      });
    }
  }, [asyncNextActionsByEntryId, orderedHistory]);

  const handleNextActionClick = (
    entry: {
      plannerMeta: { traceId?: string } | null;
    },
    nextAction: PlannerNextAction
  ) => {
    if (state.loading || !nextAction.prompt.trim()) return;
    emitNextActionTelemetry({
      event: "next_action_clicked",
      label: nextAction.label,
      intent: nextAction.intent,
      confidence: nextAction.confidence,
      ...(entry.plannerMeta?.traceId ? { trace_id: entry.plannerMeta.traceId } : {}),
    });
    void submitPrompt(nextAction.prompt);
  };

  return (
    <section className="ncqv2-ai-panel" aria-label="QueryForge AI">
      <div className="ncqv2-ai-panel-header">
        <div className="ncqv2-ai-brand">
          <h2 className="ncqv2-ai-title">
            <span className="ncqv2-ai-title-query">Query</span>
            <span className="ncqv2-ai-title-forge">Forge</span>{" "}
            <span className="ncqv2-ai-title-ai">AI</span>
          </h2>
        </div>
        <button
          type="button"
          className="btn btn-sm ncqv2-ai-close-btn"
          onClick={onClose}
          aria-label="Close AI Copilot"
        >
          <i className="fa fa-xmark" aria-hidden="true" />
        </button>
      </div>

      <div className="ncqv2-ai-panel-body">
        <div className="ncqv2-ai-thread" aria-live="polite" ref={threadRef}>
          {plannerConversation.sessionNotice ? (
            <div className="alert alert-info py-2 px-2 small mb-2" role="status">
              {plannerConversation.sessionNotice}
            </div>
          ) : null}

          {!orderedHistory.length ? (
            <div className="ncqv2-ai-empty-state">
              <div className="small text-muted">Start a conversation to build and apply query plans.</div>
            </div>
          ) : null}

          {orderedHistory.map((entry) => {
            const feedback = feedbackByResponseId[entry.id] ?? null;
            const feedbackLoading = Boolean(feedbackLoadingByResponseId[entry.id]);
            const applySuggestion =
              entry.suggestions.find((suggestion) => suggestion.sqlJson || suggestion.actions.length > 0) ??
              null;
            const confidence = applySuggestion?.confidence ?? null;
            const hasPlanExplanation = Boolean(entry.plannerMeta?.explanation);
            const nextActions = asyncNextActionsByEntryId[entry.id] ?? entry.plannerMeta?.nextActions ?? [];
            const nextActionsStatus = nextActionsStatusByEntryId[entry.id] ?? entry.plannerMeta?.nextActionsStatus;
            const nextActionsLoading = Boolean(nextActionsLoadingByEntryId[entry.id]) ||
              (nextActionsStatus === "deferred" &&
                nextActions.length === 0 &&
                !nextActionsErrorByEntryId[entry.id]);
            const nextActionsError = nextActionsErrorByEntryId[entry.id];
            const showNextActionsSection = nextActionsLoading || Boolean(nextActionsError) || nextActions.length > 0;

            return (
              <article key={entry.id} className="ncqv2-ai-turn">
                <div className="ncqv2-ai-bubble ncqv2-ai-bubble-user">
                  <div className="ncqv2-ai-bubble-label">You</div>
                  <div className="ncqv2-ai-bubble-text">{entry.prompt}</div>
                  <button
                    type="button"
                    className="btn btn-sm ncqv2-ai-copy-btn"
                    onClick={() => {
                      void copyPromptToClipboard(entry.prompt, `history-${entry.id}`);
                    }}
                    aria-label={copiedPromptKey === `history-${entry.id}` ? "Prompt copied" : "Copy prompt"}
                    title={copiedPromptKey === `history-${entry.id}` ? "Copied" : "Copy prompt"}
                  >
                    <i
                      className={`fa ${copiedPromptKey === `history-${entry.id}` ? "fa-check" : "fa-copy"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <div className="ncqv2-ai-bubble ncqv2-ai-bubble-assistant">
                  <div className="ncqv2-ai-bubble-label">QueryForge AI</div>
                  {entry.responseMessage && !hasPlanExplanation ? (
                    <div className="ncqv2-ai-bubble-text">{entry.responseMessage}</div>
                  ) : null}

                  <PlanExplanation
                    plannerMeta={entry.plannerMeta}
                    confidence={confidence}
                    onApplyChanges={
                      applySuggestion ? () => onApplySuggestion(applySuggestion) : null
                    }
                    canApply={Boolean(applySuggestion)}
                  />

                  {showNextActionsSection ? (
                    <section className="ncqv2-ai-next-actions" aria-label="Next action suggestions">
                      <div className="ncqv2-ai-next-actions-title">Next actions</div>
                      {nextActionsLoading ? (
                        <div className="small text-muted">Loading suggestions…</div>
                      ) : nextActionsError ? (
                        <div className="small text-muted">{nextActionsError}</div>
                      ) : (
                        <div className="ncqv2-ai-next-actions-list">
                          {nextActions.map((nextAction, idx) => (
                            <button
                              key={`${entry.id}-next-action-${idx}`}
                              type="button"
                              className="ncqv2-ai-next-action-card"
                              onClick={() => handleNextActionClick(entry, nextAction)}
                              disabled={state.loading}
                              aria-label={`Run next action: ${nextAction.label}`}
                            >
                              <div className="ncqv2-ai-next-action-label">{nextAction.label}</div>
                              {nextAction.reason ? (
                                <div className="ncqv2-ai-next-action-reason">{nextAction.reason}</div>
                              ) : null}
                              <div className="ncqv2-ai-next-action-meta">
                                <span className="badge text-bg-light border">
                                  {nextAction.intent}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {entry.plannerMeta && !entry.plannerMeta.validation.is_valid ? (
                    <div className="alert alert-danger py-2 px-2 mt-2 mb-2 small" role="alert">
                      <div className="fw-semibold mb-1">Plan validation failed</div>
                      {entry.plannerMeta.validation.errors.length > 0 ? (
                        <ul className="mb-2 ps-3">
                          {entry.plannerMeta.validation.errors.map((err, idx) => (
                            <li key={`planner-validation-${entry.id}-${idx}`}>
                              <code>{err.code}</code>
                              {err.path ? ` (${err.path})` : ""}: {err.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mb-2">Planner returned validation issues.</div>
                      )}
                      {entry.plannerMeta.traceId ? (
                        <div className="mb-0">
                          Trace ID: <code>{entry.plannerMeta.traceId}</code>
                        </div>
                      ) : null}
                      <ul className="mb-0 mt-2 ps-3">
                        <li>Try rephrasing the prompt.</li>
                        <li>Try a different domain.</li>
                        <li>Contact support with the trace ID if the issue persists.</li>
                      </ul>
                    </div>
                  ) : null}

                  <div className="ncqv2-ai-feedback-row">
                    <button
                      type="button"
                      className={`btn btn-sm ncqv2-ai-feedback-btn ${feedback === "up" ? "is-active" : ""}`}
                      onClick={() => {
                        void handleThumb(entry, "up");
                      }}
                      disabled={feedbackLoading}
                      aria-label="Rate response helpful"
                      title="Was this response accurate?"
                      data-tooltip="Was this response accurate?"
                    >
                      <i className="fa fa-thumbs-up" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ncqv2-ai-feedback-btn ${feedback === "down" ? "is-active" : ""}`}
                      onClick={() => {
                        void handleThumb(entry, "down");
                      }}
                      disabled={feedbackLoading}
                      aria-label="Rate response not helpful"
                      title="What was inaccurate?"
                      data-tooltip="What was inaccurate?"
                    >
                      <i className="fa fa-thumbs-down" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {state.loading ? (
            <article className="ncqv2-ai-turn">
              {pendingPrompt ? (
                <div className="ncqv2-ai-bubble ncqv2-ai-bubble-user">
                  <div className="ncqv2-ai-bubble-label">You</div>
                  <div className="ncqv2-ai-bubble-text">{pendingPrompt}</div>
                  <button
                    type="button"
                    className="btn btn-sm ncqv2-ai-copy-btn"
                    onClick={() => {
                      void copyPromptToClipboard(pendingPrompt, "pending");
                    }}
                    aria-label={copiedPromptKey === "pending" ? "Prompt copied" : "Copy prompt"}
                    title={copiedPromptKey === "pending" ? "Copied" : "Copy prompt"}
                  >
                    <i
                      className={`fa ${copiedPromptKey === "pending" ? "fa-check" : "fa-copy"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              ) : null}
              <div className="ncqv2-ai-bubble ncqv2-ai-bubble-assistant ncqv2-ai-thinking-bubble" aria-live="polite" aria-label="Thinking">
                <span className="ncqv2-ai-thinking-word">
                  {"Thinking".split("").map((char, idx) => (
                    <span
                      key={`thinking-${idx}`}
                      className="ncqv2-ai-thinking-char"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      {char}
                    </span>
                  ))}
                </span>
                <span className="ncqv2-ai-thinking-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            </article>
          ) : null}

          {state.error ? <div className="alert alert-warning py-2 px-2 mb-0">{state.error}</div> : null}
        </div>

        <div className="ncqv2-ai-composer">
          <form
            className="ncqv2-ai-goal"
            onSubmit={(e) => {
              e.preventDefault();
              if (state.loading) {
                handleCancel();
                return;
              }
              void submitPrompt();
            }}
          >
            <label htmlFor="qf-ai-goal" className="visually-hidden">
              Goal
            </label>
            <div className="ncqv2-ai-goal-box">
              <textarea
                id="qf-ai-goal"
                className="form-control ncqv2-ai-goal-input"
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  if (state.error) dispatch({ type: "clearError" });
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  if (state.loading) {
                    handleCancel();
                    return;
                  }
                  void submitPrompt();
                }}
                placeholder="Ask QueryForge AI to plan or edit your query"
                rows={3}
              />
              <div className="ncqv2-ai-composer-tools">
                <button
                  type="button"
                  className="btn btn-sm ncqv2-ai-tool-btn"
                  onClick={handleClearHistory}
                  disabled={state.loading || state.history.length === 0}
                  aria-label="Clear chat"
                  title="Clear chat"
                  data-tooltip="Clear chat"
                >
                  <i className="fa fa-trash" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm ncqv2-ai-tool-btn"
                  onClick={handleNewSession}
                  disabled={state.loading}
                  aria-label="New session"
                  title="Start a new planning session"
                  data-tooltip="New session"
                >
                  <i className="fa fa-rotate-right" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                className={`ncqv2-ai-send-btn ${state.loading ? "is-cancel" : ""}`}
                disabled={!state.loading && !goal.trim()}
                onClick={handleSendButtonClick}
                aria-label={state.loading ? "Stop generating" : "Send"}
                title={state.loading ? "Stop generating" : "Send"}
              >
                <i className={`fa ${state.loading ? "fa-stop" : "fa-arrow-up"}`} aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export default AiCopilotDrawer;
