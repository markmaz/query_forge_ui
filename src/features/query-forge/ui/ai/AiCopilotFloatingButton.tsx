import React from "react";

export function AiCopilotFloatingButton(props: {
  isActive: boolean;
  onToggle: () => void;
}) {
  const { isActive, onToggle } = props;

  return (
    <button
      type="button"
      className={`ncqv2-ai-fab ${isActive ? "is-active" : ""}`}
      onClick={onToggle}
      aria-label="Ask QueryForge AI"
      aria-pressed={isActive}
      title="Ask QueryForge AI"
    >
      <i className="fa fa-bolt" aria-hidden="true" />
      <span className="ncqv2-ai-fab-label">Ask AI</span>
    </button>
  );
}

export default AiCopilotFloatingButton;
