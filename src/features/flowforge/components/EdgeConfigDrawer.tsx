import type { FlowForgeEdge, FlowForgeNode } from "../model/types";

type EdgeConfigDrawerProps = {
  edge?: FlowForgeEdge;
  sourceNode?: FlowForgeNode;
  targetNode?: FlowForgeNode;
  open: boolean;
  editable?: boolean;
  onChange: (edgeId: string, patch: Partial<FlowForgeEdge>) => void;
  onDelete: (edgeId: string) => void;
  onClose: () => void;
};

const DEFAULT_DECISION_OUTCOMES = ["accepted", "declined", "timed_out", "approved", "rejected", "needs_review"];

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function labelForOutcomes(outcomes: string[]) {
  if (!outcomes.length) return null;
  return outcomes.map(titleCase).join(" / ");
}

function uniqueOutcomes(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function decisionOutcomes(sourceNode?: FlowForgeNode) {
  const configured = sourceNode?.data?.outcomes;
  if (Array.isArray(configured)) {
    const values = configured.map((entry) => String(entry || "").trim()).filter(Boolean);
    if (values.length) return Array.from(new Set(values));
  }
  return DEFAULT_DECISION_OUTCOMES;
}

export default function EdgeConfigDrawer({
  edge,
  sourceNode,
  targetNode,
  open,
  editable = false,
  onChange,
  onDelete,
  onClose,
}: EdgeConfigDrawerProps) {
  if (!open || !edge) return null;

  const sourceIsDecision = sourceNode?.type === "decision";
  const outcomes = decisionOutcomes(sourceNode);
  const selectedOutcomes = Array.isArray(edge.branches) && edge.branches.length
    ? uniqueOutcomes(edge.branches)
    : [String(edge.branch || edge.condition || "").trim()].filter(Boolean);
  const title = sourceNode && targetNode ? `${sourceNode.label} to ${targetNode.label}` : "Configure connection";
  const onOutcomeChange = (outcome: string, checked: boolean) => {
    const nextOutcomes = checked
      ? Array.from(new Set([...selectedOutcomes, outcome]))
      : selectedOutcomes.filter((entry) => entry !== outcome);
    onChange(edge.id, {
      branch: nextOutcomes.length === 1 ? nextOutcomes[0] : null,
      branches: nextOutcomes.length ? nextOutcomes : null,
      condition: null,
      label: labelForOutcomes(nextOutcomes),
    });
  };

  return (
    <>
      <button type="button" className="ff-node-config-drawer-backdrop" aria-label="Close connection configuration" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Connection configuration" className="ff-node-config-drawer">
        <header className="ff-node-config-drawer-header">
          <div>
            <div className="ff-eyebrow">Connection configuration</div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ff-node-config-drawer-close" aria-label="Close connection configuration" onClick={onClose}>
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        </header>
        <div className="ff-node-config-drawer-body">
          <div className="ff-admin-form">
            <div className="ff-field-group">
              <div className="ff-field-label">Route</div>
              <span className="ff-field-helper">
                {sourceIsDecision
                  ? "Choose one or more decision outcomes that use this connection."
                  : "Use a label when this connection needs a visible transition name."}
              </span>
            </div>

            {sourceIsDecision ? (
              <div className="ff-decision-outcome-checks" aria-label="Decision outcomes">
                {outcomes.map((outcome) => (
                  <label key={outcome}>
                    <input
                      type="checkbox"
                      checked={selectedOutcomes.includes(outcome)}
                      disabled={!editable}
                      onChange={(event) => onOutcomeChange(outcome, event.target.checked)}
                    />
                    {titleCase(outcome)}
                  </label>
                ))}
                <span className="ff-field-helper">Leave all unchecked to make this the default route.</span>
              </div>
            ) : (
              <label>
                Label
                <input
                  value={edge.label ?? ""}
                  disabled={!editable}
                  onChange={(event) => onChange(edge.id, { label: event.target.value.trim() || null })}
                />
              </label>
            )}

            <div className="ff-runtime-card">
              <div className="ff-card-heading">
                <div>
                  <span>Connection</span>
                  <strong>{edge.id}</strong>
                </div>
              </div>
              <dl className="ff-run-metadata">
                <div>
                  <dt>Source</dt>
                  <dd>{sourceNode?.label ?? edge.source}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{targetNode?.label ?? edge.target}</dd>
                </div>
              </dl>
            </div>

            {editable ? (
              <button type="button" className="btn btn-outline-danger" onClick={() => onDelete(edge.id)}>
                <i className="fa-solid fa-trash" aria-hidden="true" /> Delete connection
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
