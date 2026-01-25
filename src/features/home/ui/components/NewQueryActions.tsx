// src/features/no-code-sql/ui/components/home/NewQueryActions.tsx
import React from "react";

export type NewQueryActionsProps = {
  onNewQuery: () => void;
  onFromTemplate?: () => void;
  onAiAssist?: () => void;
  disabled?: boolean;
};

const ActionTile: React.FC<{
  title: string;
  desc: string;
  cta: string;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ title, desc, cta, onClick, disabled }) => {
  return (
    <div className="card border h-100">
      <div className="card-body d-flex flex-column">
        <div className="fw-semibold">{title}</div>
        <div className="text-muted small mt-1" style={{ lineHeight: 1.4 }}>
          {desc}
        </div>
        <div className="mt-auto pt-3">
          <button className="btn btn-outline-primary btn-sm w-100" type="button" onClick={onClick} disabled={disabled || !onClick}>
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
};

const NewQueryActions: React.FC<NewQueryActionsProps> = ({ onNewQuery, onFromTemplate, onAiAssist, disabled }) => {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-header bg-body">
        <div className="fw-semibold">Create something new</div>
      </div>

      <div className="card-body">
        <div className="row g-2">
          <div className="col-12">
            <ActionTile
              title="New Query"
              desc="Start from scratch in the visual builder."
              cta="New Query"
              onClick={onNewQuery}
              disabled={disabled}
            />
          </div>

          <div className="col-12 col-md-6">
            <ActionTile
              title="From Template"
              desc="Use a starter query for common workflows."
              cta="Browse Templates"
              onClick={onFromTemplate}
              disabled={disabled}
            />
          </div>

          <div className="col-12 col-md-6">
            <ActionTile
              title="AI Assisted"
              desc="Describe what you want — we’ll propose structure (no auto-exec)."
              cta="Try AI Assist"
              onClick={onAiAssist}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewQueryActions;