import React, { useMemo } from "react";
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

type PromptAction = {
  id: "clear" | "examples" | "run";
  label: string;
  iconClass: string;
  className: string;
  disabled?: boolean;
  onClick: () => void;
};

function PromptActions({ actions }: { actions: PromptAction[] }) {
  return (
    <div className="d-flex align-items-center gap-2">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={action.className}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          <i className={`${action.iconClass} me-1`} />
          {action.label}
        </button>
      ))}
    </div>
  );
}

export const PromptSection: React.FC<Props> = ({
  prompt,
  onChangePrompt,
  onRunPrompt,
  onExamples,
  collapsed,
  onToggleCollapsed,
  onHide,
  onToggleFullscreen,
  isFullscreen,
}) => {
  const promptHasValue = prompt.trim().length > 0;

  const actions = useMemo<PromptAction[]>(
    () => [
      {
        id: "clear",
        label: "Clear",
        iconClass: "fa fa-eraser",
        className: "btn btn-sm btn-outline-secondary",
        disabled: !promptHasValue,
        onClick: () => onChangePrompt(""),
      },
      {
        id: "examples",
        label: "Examples",
        iconClass: "fa fa-question",
        className: "btn btn-sm btn-outline-primary",
        onClick: onExamples,
      },
      {
        id: "run",
        label: "Run",
        iconClass: "fa fa-bolt",
        className: "btn btn-sm btn-primary",
        disabled: !promptHasValue,
        onClick: onRunPrompt,
      },
    ],
    [onChangePrompt, onExamples, onRunPrompt, promptHasValue]
  );

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
      headerTone="accent"
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="text-muted small">Describe what you want…</div>
        <PromptActions actions={actions} />
      </div>

      <textarea
        className="form-control"
        rows={3}
        placeholder='Example: "Show physical therapists in Kentucky with provider name, state, and type"'
        value={prompt}
        onChange={(event) => onChangePrompt(event.target.value)}
      />
    </SectionShell>
  );
};

export default PromptSection;
