import { useEffect, useRef, useState } from "react";

import { normalizeWorkflowStudioCopy, WORKFLOW_AI_LABEL } from "../model/branding";
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

type WorkflowPromptSuggestion = {
  title: string;
  summary: string;
  prompt: string;
};

const WORKFLOW_PROMPT_SUGGESTIONS: WorkflowPromptSuggestion[] = [
  {
    title: "Review intake requests",
    summary: "Start from a form submission, route it to a reviewer, and capture the response.",
    prompt: "Build a workflow that starts from an intake form, sends a human review task, captures the review reason, and ends with a notification.",
  },
  {
    title: "Schedule a governed export",
    summary: "Run a saved query on a schedule, get approval, then export the results.",
    prompt: "Create a scheduled workflow that runs a governed saved query, maps the output fields, requires approval, and exports a CSV to an approved destination.",
  },
  {
    title: "Handle a no-match exception",
    summary: "Try matching first, then send unresolved cases to a person.",
    prompt: "Draft a workflow that runs a matching policy, continues when a match is found, and creates a human task when no match is available.",
  },
  {
    title: "Process an inbound file",
    summary: "Watch for a file, import it, validate it, and route exceptions.",
    prompt: "Build a workflow that starts when an approved CSV file arrives, imports the file, validates rows, and sends exceptions to a human task.",
  },
  {
    title: "Approve data movement",
    summary: "Add a checkpoint before sensitive imports or exports run.",
    prompt: "Create a workflow that prepares data, pauses at an approval gate before data movement, captures the approval decision, and then exports only if approved.",
  },
  {
    title: "Notify an assigned team",
    summary: "Match to the right team and send them the details.",
    prompt: "Build a workflow that uses a matching policy to assign a team, sends a notification to that team, and captures the assignment outcome.",
  },
  {
    title: "Try candidates in order",
    summary: "Loop through matched candidates until someone accepts.",
    prompt: "Draft a workflow that matches candidates, sends a human task to the first candidate, loops to the next candidate if declined or timed out, and ends when accepted.",
  },
  {
    title: "Capture response reasons",
    summary: "Make approval, decline, or timeout reasons available for reports.",
    prompt: "Create a workflow that sends a human task, captures the human-readable response reason and response time, then branches based on the response.",
  },
  {
    title: "Stage imported records",
    summary: "Load inbound data safely before activation.",
    prompt: "Build a workflow that imports inbound records into staging, maps required fields, requires approval, and activates only after approval.",
  },
  {
    title: "Route webhook events",
    summary: "React when an approved system sends a live event.",
    prompt: "Create a workflow that starts from an approved webhook event, maps incoming fields, sends a human task when review is needed, and records the final outcome.",
  },
  {
    title: "Create an exception report",
    summary: "Find records needing attention and send them for review.",
    prompt: "Draft a workflow that runs a governed query for exception records, creates review tasks, captures decisions, and exports a final exception summary.",
  },
  {
    title: "Manual operations run",
    summary: "Let an operator run a controlled workflow on demand.",
    prompt: "Build a manual workflow that an operator can run on demand, gathers governed data, sends a notification, captures a run note, and ends cleanly.",
  },
];

function randomPromptSuggestions(count = 3): WorkflowPromptSuggestion[] {
  return [...WORKFLOW_PROMPT_SUGGESTIONS]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

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
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const [promptSuggestions, setPromptSuggestions] = useState<WorkflowPromptSuggestion[]>(() => randomPromptSuggestions());
  const [isDrafting, setIsDrafting] = useState(false);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [history, pendingPrompt, error]);

  useEffect(() => {
    if (open) setPromptSuggestions(randomPromptSuggestions());
  }, [open]);

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
          responseMessage: normalizeWorkflowStudioCopy(draft.plain_language_summary) || "Workflow graph drafted and applied to the canvas.",
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
    setPromptSuggestions(randomPromptSuggestions());
  };

  const usePromptSuggestion = (suggestion: WorkflowPromptSuggestion) => {
    if (isDrafting) return;
    setPrompt(suggestion.prompt);
    promptRef.current?.focus();
  };

  return (
    <section className="ff-designer-copilot ncqv2-ai-panel" aria-label="Workflow AI assistant">
      <div className="ncqv2-ai-panel-header">
        <div className="ncqv2-ai-brand">
          <h2 className="ncqv2-ai-title">
            <span className="ncqv2-ai-title-query">Workflow</span>{" "}
            <span className="ncqv2-ai-title-ai">AI</span>
          </h2>
        </div>
        <button type="button" className="btn btn-sm ncqv2-ai-close-btn" onClick={onClose} aria-label="Close Workflow AI">
          <i className="fa fa-times" aria-hidden="true" />
        </button>
      </div>

      <div className="ncqv2-ai-panel-body">
        <div className="ncqv2-ai-thread" aria-live="polite" ref={threadRef}>
          {!history.length ? (
            <div className="ncqv2-ai-empty-state">
              <div className="small text-muted">Describe the workflow change you want. Workflow AI will draft the graph through the workspace LLM path.</div>
            </div>
          ) : null}

          {!history.length && !pendingPrompt ? (
            <section className="ncqv2-ai-prompt-suggestions" aria-label="Workflow prompt suggestions">
              <div className="ncqv2-ai-prompt-suggestions-header">
                <div className="ncqv2-ai-prompt-suggestions-title">What do you want to build today?</div>
              </div>
              <div className="ncqv2-ai-prompt-suggestion-list">
                {promptSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    className="ncqv2-ai-prompt-suggestion-card"
                    onClick={() => usePromptSuggestion(suggestion)}
                    disabled={isDrafting}
                    aria-label={`Use prompt suggestion: ${suggestion.title}`}
                  >
                    <strong>{suggestion.title}</strong>
                    <span>{suggestion.summary}</span>
                  </button>
                ))}
              </div>
            </section>
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
                <div className="ncqv2-ai-bubble-label">{WORKFLOW_AI_LABEL}</div>
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
                ref={promptRef}
                className="form-control ncqv2-ai-goal-input"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  void handleSubmit();
                }}
                placeholder="Ask Workflow AI to generate or modify this workflow graph"
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
