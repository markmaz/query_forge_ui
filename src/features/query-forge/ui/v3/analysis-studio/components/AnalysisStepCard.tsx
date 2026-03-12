import type { AnalysisNode } from "../model/analysisTypes";
import { NODE_TYPE_LABELS } from "../model/analysisUtils";

type AnalysisStepCardProps = {
  node: AnalysisNode;
  summary: string;
  selected: boolean;
  stepNumber: number;
  onSelect: (nodeId: string) => void;
  onEdit: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
};

export function AnalysisStepCard(props: AnalysisStepCardProps) {
  const { node, summary, selected, stepNumber, onSelect, onEdit, onDelete } = props;

  return (
    <article
      className={`analysisStepCard ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(node.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      <header className="analysisStepCard__header">
        <div className="analysisStepCard__stepKey">
          <span className="analysisStepCard__stepNumber">Step {stepNumber}</span>
          <span className={`analysisStepCard__typeBadge is-${node.type}`}>{NODE_TYPE_LABELS[node.type]}</span>
        </div>
        <div className="analysisStepCard__actions">
          <button
            type="button"
            className="analysisIconBtn"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(node.id);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="analysisIconBtn is-danger"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(node.id);
            }}
          >
            Delete
          </button>
        </div>
      </header>
      <p className="analysisStepCard__summary">{summary}</p>
    </article>
  );
}
