import React from "react";
import { SectionShell } from "./SectionShell";

type Props = {
  prompt: string;
  onChangePrompt: (v: string) => void;
  onRunPrompt: () => void;
  onExamples: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide?: () => void;
};

export const PromptSection: React.FC<Props> = ({
  prompt,
  onChangePrompt,
  onRunPrompt,
  onExamples,
  collapsed,
  onToggleCollapsed,
  onHide,
  onToggleFullscreen,
  isFullscreen
}) => {
  const canRun = prompt.trim().length > 0;

  return (
    <SectionShell
      id="prompt"
      title="Prompt"
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      iconClass="fa-lightbulb"
      onHide={onHide}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
    >
      {/* Header row BELOW title, ABOVE body */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="text-muted small">
          Describe what you want…
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => onChangePrompt("")}
            disabled={!canRun}
          >
            <i className="fa fa-eraser me-1" />
            Clear
          </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={onExamples}
          >
            <i className="fa fa-question me-1" />
            Examples
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onRunPrompt}
            disabled={!canRun}
          >
            <i className="fa fa-bolt me-1" />
            Run
          </button>
        </div>
      </div>

      {/* Body */}
      <textarea
        className="form-control"
        rows={3}
        placeholder='Example: "Show physical therapists in Kentucky with provider name, state, and type"'
        value={prompt}
        onChange={(e) => onChangePrompt(e.target.value)}
      />
    </SectionShell>
  );
};

export default PromptSection;