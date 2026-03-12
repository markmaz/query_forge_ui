import type { AnalysisNode, StudioDomainSummary, SuggestedNextAction } from "../model/analysisTypes";
import { AnalysisStepCard } from "./AnalysisStepCard";
import { NextStepSuggestions } from "./NextStepSuggestions";

type AnalysisCanvasProps = {
  domains: StudioDomainSummary[];
  orderedNodes: AnalysisNode[];
  selectedNodeId: string | null;
  suggestionAnchorNodeId: string | null;
  suggestedActions: SuggestedNextAction[];
  getSummary: (node: AnalysisNode) => string;
  onSelectDomain: (domainId: number) => void;
  onSelectNode: (nodeId: string) => void;
  onEditNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onSuggestedAction: (action: SuggestedNextAction, anchorNodeId: string | null) => void;
};

export function AnalysisCanvas(props: AnalysisCanvasProps) {
  const {
    domains,
    orderedNodes,
    selectedNodeId,
    suggestionAnchorNodeId,
    suggestedActions,
    getSummary,
    onSelectDomain,
    onSelectNode,
    onEditNode,
    onDeleteNode,
    onSuggestedAction,
  } = props;

  return (
    <div className="analysisCanvas">
      <div className="analysisCanvas__header">
        <div>
          <h2>Analysis Canvas</h2>
          <p>Build a guided analysis pipeline now, with a data model ready for future branching.</p>
        </div>
      </div>

      {orderedNodes.length === 0 ? (
        <div className="analysisCanvas__empty">
          <h3>Start with a domain</h3>
          <p>Choose a trusted business domain to begin your analysis.</p>
          <div className="analysisCanvas__domainChoices">
            {domains.map((domain) => (
              <button key={domain.id} type="button" onClick={() => onSelectDomain(domain.id)}>
                <strong>{domain.label}</strong>
                <span>{domain.description ?? "Business-ready data domain"}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="analysisCanvas__pipeline">
          {orderedNodes.map((node, index) => (
            <div key={node.id} className="analysisCanvas__segment">
              <AnalysisStepCard
                node={node}
                summary={getSummary(node)}
                selected={selectedNodeId === node.id}
                stepNumber={index + 1}
                onSelect={onSelectNode}
                onEdit={onEditNode}
                onDelete={onDeleteNode}
              />

              {suggestionAnchorNodeId === node.id ? (
                <NextStepSuggestions
                  actions={suggestedActions}
                  onActionClick={(action) => onSuggestedAction(action, node.id)}
                />
              ) : (
                <div className="analysisCanvas__connector" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
