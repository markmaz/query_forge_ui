import type { ReactNode } from "react";

export type FlowForgeInstructionStepState = "complete" | "current" | "blocked";

export interface FlowForgeInstructionStep {
  label: string;
  detail: string;
  state: FlowForgeInstructionStepState;
}

interface FlowForgeInstructionalFlowProps {
  eyebrow: string;
  title: string;
  statusLabel: string;
  statusTone: "valid" | "warning" | "invalid";
  steps: FlowForgeInstructionStep[];
  actions?: ReactNode;
  note?: ReactNode;
  ariaLabel: string;
}

function stepIcon(state: FlowForgeInstructionStepState) {
  if (state === "complete") return "fa-check";
  if (state === "current") return "fa-circle-dot";
  return "fa-lock";
}

export default function FlowForgeInstructionalFlow({
  eyebrow,
  title,
  statusLabel,
  statusTone,
  steps,
  actions,
  note,
  ariaLabel,
}: FlowForgeInstructionalFlowProps) {
  return (
    <section className="ff-production-readiness-panel ff-instructional-flow" aria-label={ariaLabel}>
      <div className="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div className="ff-eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
        </div>
        <span className={`ff-validation-chip is-${statusTone}`}>{statusLabel}</span>
      </div>
      <ol className="ff-readiness-list">
        {steps.map((step) => (
          <li key={step.label} className={`ff-readiness-step is-${step.state}`}>
            <span className="ff-readiness-icon" aria-hidden="true">
              <i className={`fa ${stepIcon(step.state)}`} />
            </span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </span>
          </li>
        ))}
      </ol>
      {actions ? <div className="ff-readiness-actions">{actions}</div> : null}
      {note ? <div className="small ff-muted">{note}</div> : null}
    </section>
  );
}
