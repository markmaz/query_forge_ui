// src/features/query-forge/ui/components/home/NewQueryActions.tsx
import React from "react";

export type NewQueryActionsProps = {
  onNewQuery: () => void;
  onNewWorkflow?: () => void;
  onForgeMatch?: () => void;
  onNewSkill?: () => void;
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

const NewQueryActions: React.FC<NewQueryActionsProps> = ({
  onNewQuery,
  onNewWorkflow,
  onForgeMatch,
  onNewSkill,
  onAiAssist,
  disabled,
}) => {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-header bg-body">
        <div className="fw-semibold">Start new work</div>
      </div>

      <div className="card-body">
        <div className="row g-2">
          <div className="col-12">
            <ActionTile
              title="New Query"
              desc="Build a governed semantic query."
              cta="New Query"
              onClick={onNewQuery}
              disabled={disabled}
            />
          </div>

          <div className="col-12 col-md-6">
            <ActionTile
              title="New Workflow"
              desc="Design intake, matching, review, and delivery flows."
              cta="Open Designer"
              onClick={onNewWorkflow}
              disabled={disabled}
            />
          </div>

          <div className="col-12 col-md-6">
            <ActionTile
              title="Forge Match"
              desc="Map uploaded fields into governed domains."
              cta="Start Match"
              onClick={onForgeMatch}
              disabled={disabled}
            />
          </div>

          <div className="col-12 col-md-6">
            <ActionTile
              title="Skill"
              desc="Create a reusable automation from query results."
              cta="New Skill"
              onClick={onNewSkill}
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
