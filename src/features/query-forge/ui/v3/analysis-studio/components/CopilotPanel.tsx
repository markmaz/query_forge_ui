import { useEffect, useRef, useState } from "react";
import type { CopilotSuggestion } from "../model/analysisTypes";

type CopilotPanelProps = {
  suggestions: CopilotSuggestion[];
  focusRequest?: { token: number; promptHint?: string } | null;
  onPromptSubmit?: (prompt: string) => void | Promise<void>;
  onApplySuggestion: (suggestion: CopilotSuggestion) => void;
};

export function CopilotPanel(props: CopilotPanelProps) {
  const { suggestions, focusRequest, onPromptSubmit, onApplySuggestion } = props;
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!focusRequest?.token) return;
    if (focusRequest.promptHint) {
      setPrompt((previous) => {
        if (previous.trim()) return previous;
        return focusRequest.promptHint ?? "";
      });
    }
    promptRef.current?.focus();
  }, [focusRequest]);

  const submitPrompt = async () => {
    const nextPrompt = prompt.trim();
    if (!nextPrompt || submitting) return;
    setSubmitting(true);
    try {
      await Promise.resolve(onPromptSubmit?.(nextPrompt));
      setPrompt("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="analysisCopilot ncqv2-ai-panel" aria-label="QueryForge AI">
      <header className="analysisCopilot__header ncqv2-ai-panel-header">
        <div className="analysisCopilot__brand ncqv2-ai-brand">
          <h2 className="analysisCopilot__title ncqv2-ai-title">
            <span className="analysisCopilot__titleQuery ncqv2-ai-title-query">Query</span>
            <span className="analysisCopilot__titleForge ncqv2-ai-title-forge">Forge</span>{" "}
            <span className="analysisCopilot__titleAi ncqv2-ai-title-ai">AI</span>
          </h2>
        </div>
      </header>

      <div className="analysisCopilot__body ncqv2-ai-panel-body">
        <form
          className="analysisCopilot__goal ncqv2-ai-goal"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPrompt();
          }}
        >
          <label className="analysisField analysisCopilot__field" htmlFor="analysis-copilot-prompt">
            <span>Describe what you want to analyze</span>
          </label>
          <div className="analysisCopilot__goalBox ncqv2-ai-goal-box">
            <textarea
              id="analysis-copilot-prompt"
              ref={promptRef}
              rows={3}
              className="form-control analysisCopilot__prompt ncqv2-ai-goal-input"
              placeholder="Ask QueryForge AI to plan or edit your query"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                event.preventDefault();
                void submitPrompt();
              }}
            />
            <button
              type="submit"
              className="analysisCopilot__sendBtn ncqv2-ai-send-btn"
              disabled={!prompt.trim() || submitting}
              aria-label="Send"
              title="Send"
            >
              <i className="fa fa-arrow-up" aria-hidden="true" />
            </button>
          </div>
        </form>

        <section className="analysisCopilot__suggestionSection ncqv2-ai-next-actions" aria-label="Next step suggestions">
          <div className="analysisCopilot__suggestionTitle ncqv2-ai-next-actions-title">Suggested next steps</div>
          <ul className="analysisCopilot__suggestions ncqv2-ai-next-actions-list">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button type="button" className="analysisCopilot__suggestionCard ncqv2-ai-next-action-card" onClick={() => onApplySuggestion(suggestion)}>
                  <div className="analysisCopilot__suggestionLabel ncqv2-ai-next-action-label">{suggestion.label}</div>
                  <div className="analysisCopilot__suggestionReason ncqv2-ai-next-action-reason">{suggestion.description}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
