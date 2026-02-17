import React, { useEffect, useMemo, useRef, useState } from "react";
import { aiCopilotReducer, createInitialAiCopilotState } from "./aiCopilotSlice";
import {
  emitAiSuggestTelemetry,
  requestQueryStudioSuggestions,
  toAiSuggestUserMessage,
} from "./aiCopilotApi";
import {
  SECTION_QUICK_ACTIONS,
  mapSectionToAiMode,
  summarizeBuilderAction,
  type AiCopilotSection,
  type AiSuggestion,
  type QueryStudioSuggestRequest,
} from "./types";
import type { SqlQueryJson } from "../../model/sqlJson";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const STARTER_QUERY_PROMPTS: string[] = [
  "Show student enrollment by grade level for the current school year.",
  "Find top 10 courses by average final score this semester.",
  "Break down attendance trends by campus and month.",
  "List students with missing assignments in the last 30 days.",
  "Compare pass rates year over year by subject area.",
];

function pickRandomStarterPrompt(): string {
  const idx = Math.floor(Math.random() * STARTER_QUERY_PROMPTS.length);
  return STARTER_QUERY_PROMPTS[idx] ?? STARTER_QUERY_PROMPTS[0];
}

export function AiCopilotDrawer(props: {
  activeSection: AiCopilotSection;
  workspaceId: string | null;
  sqlJson?: SqlQueryJson | null;
  domainContext?: QueryStudioSuggestRequest["domainContext"];
  candidates?: QueryStudioSuggestRequest["candidates"];
  onApplySuggestion: (suggestion: AiSuggestion) => void;
  onClose: () => void;
}) {
  const { activeSection, workspaceId, sqlJson, domainContext, candidates, onApplySuggestion, onClose } =
    props;
  const [state, dispatch] = React.useReducer(
    aiCopilotReducer,
    createInitialAiCopilotState(activeSection)
  );
  const [goal, setGoal] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    dispatch({ type: "setActiveSection", section: activeSection });
  }, [activeSection]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const quickActions = SECTION_QUICK_ACTIONS[state.activeSection];

  const submitPrompt = async (promptText?: string) => {
    const prompt = (promptText ?? goal).trim();
    if (!prompt || state.loading) return;

    const startedAt = Date.now();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "requestStart" });
    try {
      const response = await requestQueryStudioSuggestions(
        {
          workspaceId,
          activeSection: state.activeSection,
          ...(sqlJson ? { sqlJson } : {}),
          domainContext,
          candidates,
          userPrompt: prompt,
        },
        controller.signal
      );
      dispatch({ type: "requestSuccess", response, prompt });
      emitAiSuggestTelemetry({
        mode: mapSectionToAiMode(state.activeSection),
        prompt_length: prompt.length,
        success: true,
        latency_ms: Date.now() - startedAt,
        debug_attempts: response.debugAttempts,
      });
    } catch (err) {
      if (isAbortError(err)) {
        dispatch({ type: "requestCancel" });
        return;
      }
      dispatch({ type: "requestError", error: toAiSuggestUserMessage(err) });
      const status = typeof err === "object" && err && "status" in err ? Number((err as any).status) : null;
      emitAiSuggestTelemetry({
        mode: mapSectionToAiMode(state.activeSection),
        prompt_length: prompt.length,
        success: false,
        latency_ms: Date.now() - startedAt,
        error_status: Number.isFinite(status) ? status : null,
      });
    }
  };

  const history = useMemo(() => state.history.slice(-10).reverse(), [state.history]);
  const isStandalone = state.activeSection === "AI First";
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

  return (
    <section className="ncqv2-ai-panel" aria-label="QueryForge AI">
      <div className="ncqv2-ai-panel-header">
        <div className="ncqv2-ai-brand">
          <h2 className="ncqv2-ai-title">
            <span className="ncqv2-ai-title-query">Query</span>
            <span className="ncqv2-ai-title-forge">Forge</span>{" "}
            <span className="ncqv2-ai-title-ai">AI</span>
          </h2>
          <div className="ncqv2-ai-context">Helping with: {state.activeSection}</div>
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
          <label htmlFor="qf-ai-goal" className="form-label mb-1">
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
              placeholder="Describe what you want to build"
              rows={4}
            />
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

        <div className="ncqv2-ai-chips" aria-label="Quick AI actions">
          {quickActions.map((quick) => (
            <button
              key={quick}
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                if (isStandalone) {
                  const starter = pickRandomStarterPrompt();
                  setGoal(starter);
                  if (state.error) dispatch({ type: "clearError" });
                  return;
                }
                setGoal(quick);
                void submitPrompt(quick);
              }}
              disabled={state.loading}
            >
              {quick}
            </button>
          ))}
        </div>

        {state.loading ? (
          <div className="ncqv2-ai-thinking" aria-live="polite" aria-label="Thinking">
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
        ) : null}
        {state.error ? <div className="alert alert-warning py-2">{state.error}</div> : null}

        {!state.loading && state.message ? <div className="ncqv2-ai-message">{state.message}</div> : null}

        {!state.loading ? (
        <div className="ncqv2-ai-suggestions" aria-live="polite">
          {state.suggestions.map((suggestion, idx) => {
            const suggestionId = suggestion.id ?? `${idx}-${suggestion.title}`;
            const expanded = Boolean(state.expandedSuggestionIds[suggestionId]);
            return (
              <article key={suggestionId} className="ncqv2-ai-card">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <h3 className="ncqv2-ai-card-title">{suggestion.title}</h3>
                    <p className="ncqv2-ai-card-why">{suggestion.why}</p>
                  </div>
                  <span
                    className={`badge ncqv2-ai-confidence ncqv2-ai-confidence-${suggestion.confidence}`}
                  >
                    {suggestion.confidence}
                  </span>
                </div>
                {suggestion.debug ? (
                  <div className="small text-muted mb-1">Model attempts: {suggestion.debug.attempts}</div>
                ) : null}
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => dispatch({ type: "toggleSuggestion", suggestionId })}
                >
                  {expanded ? "Hide changes" : "Review changes"}
                </button>

                {expanded ? (
                  <div className="ncqv2-ai-actions mt-2">
                    <div className="small text-muted mb-1">Changes to apply</div>
                    <ul className="mb-2">
                      {suggestion.actions.map((action, actionIdx) => (
                        <li key={`${suggestionId}-action-${actionIdx}`}>
                          {summarizeBuilderAction(action)}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onApplySuggestion(suggestion)}
                      disabled={!suggestion.actions.length && !suggestion.sqlJson}
                    >
                      Apply changes
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        ) : null}

        {history.length ? (
          <div className="ncqv2-ai-history">
            <div className="small text-muted mb-1">Recent prompts</div>
            <ul>
              {history.map((entry) => (
                <li key={entry.id}>
                  <span className="fw-semibold">{entry.prompt}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default AiCopilotDrawer;
