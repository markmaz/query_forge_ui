import { useEffect, useRef, useState } from "react";

import type { FlowForgeElementDefinition } from "../model/workflowElements";
import { FLOWFORGE_ELEMENTS } from "../model/workflowElements";
import "./FlowForgeAiAssistantPanel.css";

interface FlowForgeAiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  onAddElement: (element: FlowForgeElementDefinition) => void;
}

type AssistantTurn = {
  id: string;
  prompt: string;
  responseMessage: string;
  suggestedElement: FlowForgeElementDefinition;
};

function inferElement(prompt: string): FlowForgeElementDefinition {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("schedule") || normalized.includes("daily") || normalized.includes("weekly")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "schedule_trigger") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("saved query") || normalized.includes("query extract") || normalized.includes("report")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "query_extract") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("export") || normalized.includes("sftp") || normalized.includes("s3") || normalized.includes("email")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "export") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("import") || normalized.includes("upload") || normalized.includes("inbound file")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "import") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("map") || normalized.includes("transform") || normalized.includes("validate")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "map_transform") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("approve") || normalized.includes("accept") || normalized.includes("human")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "approval") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("match") || normalized.includes("rank") || normalized.includes("filter") || normalized.includes("eligible")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "matching") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("decision") || normalized.includes("branch")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "decision") ?? FLOWFORGE_ELEMENTS[0];
  }
  return FLOWFORGE_ELEMENTS.find((item) => item.type === "intake") ?? FLOWFORGE_ELEMENTS[0];
}

function createTurn(prompt: string, suggestedElement: FlowForgeElementDefinition): AssistantTurn {
  return {
    id: `${Date.now()}-${suggestedElement.type}`,
    prompt,
    responseMessage: `I added a ${suggestedElement.label} as a draft step. Configure the action drawer next, then save a draft version when the graph is ready.`,
    suggestedElement,
  };
}

export default function FlowForgeAiAssistantPanel({
  open,
  onClose,
  onAddElement,
}: FlowForgeAiAssistantPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<AssistantTurn[]>([]);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [history]);

  if (!open) return null;

  const handleSubmit = (nextPrompt = prompt) => {
    const trimmed = nextPrompt.trim();
    if (!trimmed) return;
    const suggested = inferElement(trimmed);
    setHistory((current) => [...current, createTurn(trimmed, suggested)]);
    onAddElement(suggested);
    setPrompt("");
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
              <div className="small text-muted">Describe the workflow step you want to add. FlowForge AI will draft the next canvas action.</div>
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
                      onClick={() => onAddElement(entry.suggestedElement)}
                      aria-label={`Add another ${entry.suggestedElement.label}`}
                    >
                      <div className="ncqv2-ai-next-action-label">Add another {entry.suggestedElement.label}</div>
                      <div className="ncqv2-ai-next-action-reason">Repeat this step when the workflow needs the same action again.</div>
                    </button>
                    <button
                      type="button"
                      className="ncqv2-ai-next-action-card"
                      onClick={() => handleSubmit("Add a decision branch for the previous workflow step.")}
                      aria-label="Draft decision branch"
                    >
                      <div className="ncqv2-ai-next-action-label">Draft decision branch</div>
                      <div className="ncqv2-ai-next-action-reason">Add an explicit branch after the drafted action.</div>
                    </button>
                  </div>
                </section>
              </div>
            </article>
          ))}
        </div>

        <div className="ncqv2-ai-composer">
          <form
            className="ncqv2-ai-goal"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
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
                  handleSubmit();
                }}
                placeholder="Ask FlowForge AI to add an intake, matching, task, decision, export, or schedule step"
                rows={3}
              />
              <div className="ncqv2-ai-composer-tools">
                <button
                  type="button"
                  className="btn btn-sm ncqv2-ai-tool-btn"
                  onClick={clearHistory}
                  disabled={!history.length}
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
                  aria-label="New session"
                  title="Start a new planning session"
                  data-tooltip="New session"
                >
                  <i className="fa fa-rotate-right" aria-hidden="true" />
                </button>
              </div>
              <button type="submit" className="ncqv2-ai-send-btn" disabled={!prompt.trim()} aria-label="Draft next step" title="Draft next step">
                <i className="fa fa-arrow-up" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
