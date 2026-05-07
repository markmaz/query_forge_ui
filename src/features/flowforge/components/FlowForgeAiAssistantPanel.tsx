import { useEffect, useRef, useState } from "react";

import type { FlowForgeWorkflowAIDraft } from "../model/types";
import "./FlowForgeAiAssistantPanel.css";

interface FlowForgeAiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  onDraftWorkflow: (prompt: string) => Promise<FlowForgeWorkflowAIDraft>;
}

type AssistantTurn = {
  id: string;
  prompt: string;
  responseMessage: string;
  draft: FlowForgeWorkflowAIDraft;
};

export default function FlowForgeAiAssistantPanel({
  open,
  onClose,
  onDraftWorkflow,
}: FlowForgeAiAssistantPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<AssistantTurn[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [history, pendingPrompt, error]);

  if (!open) return null;

  const handleSubmit = async (nextPrompt = prompt) => {
    const trimmed = nextPrompt.trim();
    if (!trimmed || isDrafting) return;
    setIsDrafting(true);
    setPendingPrompt(trimmed);
    setError(null);
    try {
      const draft = await onDraftWorkflow(trimmed);
      setHistory((current) => [
        ...current,
        {
          id: `${Date.now()}-${draft.draft_source}`,
          prompt: trimmed,
          responseMessage: draft.plain_language_summary || "Workflow graph drafted and applied to the canvas.",
          draft,
        },
      ]);
      setPrompt("");
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Unable to draft workflow graph.");
    } finally {
      setPendingPrompt("");
      setIsDrafting(false);
    }
  };

  const copyPrompt = async (value: string, turnId: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedPromptId(turnId);
      window.setTimeout(() => setCopiedPromptId(null), 1200);
    } catch {
      setCopiedPromptId(null);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    setCopiedPromptId(null);
    setError(null);
  };

  const startNewSession = () => {
    clearHistory();
    setPrompt("");
  };

  return (
    <section className="ff-designer-copilot ncqv2-ai-panel" aria-label="FlowForge AI assistant">
      <div className="ncqv2-ai-panel-header">
        <div className="ncqv2-ai-brand">
          <h2 className="ncqv2-ai-title">
            <span className="ncqv2-ai-title-query">Flow</span>
            <span className="ncqv2-ai-title-forge">Forge</span>{" "}
            <span className="ncqv2-ai-title-ai">AI</span>
          </h2>
        </div>
        <button type="button" className="btn btn-sm ncqv2-ai-close-btn" onClick={onClose} aria-label="Close FlowForge AI">
          <i className="fa fa-times" aria-hidden="true" />
        </button>
      </div>

      <div className="ncqv2-ai-panel-body">
        <div className="ncqv2-ai-thread" aria-live="polite" ref={threadRef}>
          {!history.length ? (
            <div className="ncqv2-ai-empty-state">
              <div className="small text-muted">Describe the workflow change you want. FlowForge AI will draft the graph through the workspace LLM path.</div>
            </div>
          ) : null}

          {history.map((entry) => (
            <article key={entry.id} className="ncqv2-ai-turn">
              <div className="ncqv2-ai-bubble ncqv2-ai-bubble-user">
                <div className="ncqv2-ai-bubble-label">You</div>
                <div className="ncqv2-ai-bubble-text">{entry.prompt}</div>
                <button
                  type="button"
                  className="btn btn-sm ncqv2-ai-copy-btn"
                  onClick={() => {
                    void copyPrompt(entry.prompt, entry.id);
                  }}
                  aria-label={copiedPromptId === entry.id ? "Prompt copied" : "Copy prompt"}
                  title={copiedPromptId === entry.id ? "Copied" : "Copy prompt"}
                >
                  <i className={`fa ${copiedPromptId === entry.id ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
                </button>
              </div>

              <div className="ncqv2-ai-bubble ncqv2-ai-bubble-assistant">
                <div className="ncqv2-ai-bubble-label">FlowForge AI</div>
                <div className="ncqv2-ai-bubble-text">{entry.responseMessage}</div>
                <section className="ncqv2-ai-next-actions" aria-label="Next actions">
                  <div className="ncqv2-ai-next-actions-title">Next actions</div>
                  <div className="ncqv2-ai-next-actions-list">
                    <button
                      type="button"
                      className="ncqv2-ai-next-action-card"
                      onClick={() => handleSubmit("Tighten the generated workflow with validation-friendly configuration placeholders.")}
                      disabled={isDrafting}
                      aria-label="Refine generated workflow"
                    >
                      <div className="ncqv2-ai-next-action-label">Refine generated workflow</div>
                      <div className="ncqv2-ai-next-action-reason">Ask the workspace LLM to make the applied graph more production-ready.</div>
                    </button>
                    <button
                      type="button"
                      className="ncqv2-ai-next-action-card"
                      onClick={() => handleSubmit("Add or improve the decision branch for the previous workflow step.")}
                      disabled={isDrafting}
                      aria-label="Draft decision branch"
                    >
                      <div className="ncqv2-ai-next-action-label">Draft decision branch</div>
                      <div className="ncqv2-ai-next-action-reason">Add an explicit branch after the drafted action.</div>
                    </button>
                  </div>
                </section>
                <div className="ncqv2-ai-next-action-meta">
                  {entry.draft.draft_source}
                  {entry.draft.model_name ? ` / ${entry.draft.model_name}` : ""}
                  {entry.draft.validation_status ? ` / ${entry.draft.validation_status}` : ""}
                </div>
              </div>
            </article>
          ))}

          {pendingPrompt ? (
            <article className="ncqv2-ai-turn">
              <div className="ncqv2-ai-bubble ncqv2-ai-bubble-user">
                <div className="ncqv2-ai-bubble-label">You</div>
                <div className="ncqv2-ai-bubble-text">{pendingPrompt}</div>
              </div>
              <div className="ncqv2-ai-bubble ncqv2-ai-bubble-assistant ncqv2-ai-thinking-bubble" aria-live="polite" aria-label="Thinking">
                <span className="ncqv2-ai-thinking-word">Thinking</span>
                <span className="ncqv2-ai-thinking-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            </article>
          ) : null}

          {error ? (
            <div className="ff-ai-error" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="ncqv2-ai-composer">
          <form
            className="ncqv2-ai-goal"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <label htmlFor="flowforge-workflow-ai-prompt" className="visually-hidden">
              Workflow prompt
            </label>
            <div className="ncqv2-ai-goal-box">
              <textarea
                id="flowforge-workflow-ai-prompt"
                className="form-control ncqv2-ai-goal-input"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  void handleSubmit();
                }}
                placeholder="Ask FlowForge AI to generate or modify this workflow graph"
                rows={3}
              />
              <div className="ncqv2-ai-composer-tools">
                <button
                  type="button"
                  className="btn btn-sm ncqv2-ai-tool-btn"
                  onClick={clearHistory}
                  disabled={isDrafting || !history.length}
                  aria-label="Clear chat"
                  title="Clear chat"
                  data-tooltip="Clear chat"
                >
                  <i className="fa fa-trash" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm ncqv2-ai-tool-btn"
                  onClick={startNewSession}
                  disabled={isDrafting}
                  aria-label="New session"
                  title="Start a new planning session"
                  data-tooltip="New session"
                >
                  <i className="fa fa-rotate-right" aria-hidden="true" />
                </button>
              </div>
              <button type="submit" className="ncqv2-ai-send-btn" disabled={isDrafting || !prompt.trim()} aria-label="Draft workflow graph" title="Draft workflow graph">
                <i className={`fa ${isDrafting ? "fa-spinner fa-spin" : "fa-arrow-up"}`} aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
