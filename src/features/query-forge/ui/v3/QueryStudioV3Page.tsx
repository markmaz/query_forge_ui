import { useMemo, useReducer, useState } from "react";
import { Link } from "react-router-dom";

import { routes } from "../../../../app/navigation/routes";
import { AnalysisStudioLayout } from "./analysis-studio/components/AnalysisStudioLayout";
import { DataExplorerPanel } from "./analysis-studio/components/DataExplorerPanel";
import { CopilotPanel } from "./analysis-studio/components/CopilotPanel";
import { AnalysisCanvas } from "./analysis-studio/components/AnalysisCanvas";
import { ResultsPanel } from "./analysis-studio/components/ResultsPanel";
import { StepEditorDrawer } from "./analysis-studio/components/StepEditorDrawer";
import { SkillBuilder } from "./analysis-studio/components/skills/SkillBuilder";
import {
  analysisReducer,
  createInitialAnalysisState,
} from "./analysis-studio/model/analysisState";
import {
  buildExplainText,
  buildMockResultRows,
  buildMockSql,
  getOrderedNodes,
  pipelineToSqlJson,
} from "./analysis-studio/model/analysisSqlAdapter";
import type {
  AnalysisNodeConfig,
  AnalysisNodeType,
  CopilotSuggestion,
  SuggestedNextAction,
  StudioDomainLike,
  StudioResultTab,
} from "./analysis-studio/model/analysisTypes";
import {
  flattenExplorerFields,
  getActionAnchorNodeId,
  getActiveDomainMetadata,
  getCopilotSuggestions,
  getStepSummary,
  getSuggestedNextActions,
} from "./analysis-studio/model/analysisUtils";
import {
  useStudioDomainExplorer,
  useStudioDomains,
} from "./analysis-studio/hooks/useStudioMetadata";
import "../v2/v2.css";
import "./analysis-studio/analysisStudio.css";

function toErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Request failed. Please retry.";
}

export default function QueryStudioV3Page() {
  const [analysisState, dispatch] = useReducer(
    analysisReducer,
    undefined,
    createInitialAnalysisState,
  );
  const [activeTab, setActiveTab] = useState<StudioResultTab>("results");
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [copilotFocusRequest, setCopilotFocusRequest] = useState<{
    token: number;
    promptHint?: string;
  } | null>(null);

  const domainsQuery = useStudioDomains();
  const explorerQuery = useStudioDomainExplorer(analysisState.activeDomainId);

  const domains = domainsQuery.data ?? [];
  const domainExplorer = explorerQuery.data ?? null;

  const orderedNodes = useMemo(
    () => getOrderedNodes(analysisState),
    [analysisState],
  );
  const suggestionAnchorNodeId = useMemo(
    () => getActionAnchorNodeId(analysisState),
    [analysisState],
  );
  const selectedNode = analysisState.selectedNodeId
    ? (analysisState.nodes[analysisState.selectedNodeId] ?? null)
    : null;
  const editingNode = editingNodeId
    ? (analysisState.nodes[editingNodeId] ?? null)
    : null;

  const activeDomain = useMemo(
    () => getActiveDomainMetadata(domains, analysisState.activeDomainId),
    [domains, analysisState.activeDomainId],
  );

  const domainLike: StudioDomainLike | null =
    domainExplorer?.domain ?? activeDomain;
  const availableFields = useMemo(
    () => flattenExplorerFields(domainExplorer),
    [domainExplorer],
  );

  const suggestedActions = useMemo(
    () =>
      getSuggestedNextActions(
        analysisState.nodes,
        analysisState.orderedNodeIds,
        analysisState.selectedNodeId,
        domainLike,
      ),
    [
      analysisState.nodes,
      analysisState.orderedNodeIds,
      analysisState.selectedNodeId,
      domainLike,
    ],
  );

  const copilotSuggestions = useMemo(
    () => getCopilotSuggestions(domainLike, domainExplorer, suggestedActions),
    [domainLike, domainExplorer, suggestedActions],
  );

  const sqlJson = useMemo(
    () => pipelineToSqlJson(analysisState, domainExplorer),
    [analysisState, domainExplorer],
  );
  const mockSql = useMemo(
    () => buildMockSql(analysisState, domainExplorer),
    [analysisState, domainExplorer],
  );
  const mockRows = useMemo(
    () => buildMockResultRows(analysisState, domainExplorer),
    [analysisState, domainExplorer],
  );
  const explainText = useMemo(
    () => buildExplainText(analysisState),
    [analysisState],
  );

  const insertStep = (
    afterNodeId: string | null,
    nodeType: AnalysisNodeType,
  ) => {
    dispatch({
      type: "insert-step",
      afterNodeId,
      nodeType,
    });
  };

  const handleSelectDomain = (domainId: number) => {
    const domain = domains.find((item) => item.id === domainId);
    if (!domain) return;
    dispatch({ type: "set-domain", domain });
    setEditingNodeId(null);
  };

  const handleSuggestedAction = (
    action: SuggestedNextAction,
    anchorNodeId: string | null,
  ) => {
    if (action.kind === "ask_ai") {
      setCopilotFocusRequest({
        token: Date.now(),
        promptHint:
          action.promptHint ??
          `Help me continue this ${domainLike?.label ?? "analysis"} pipeline.`,
      });
      return;
    }

    if (action.nodeType) {
      insertStep(anchorNodeId, action.nodeType);
    }
  };

  const handleCopilotSuggestion = (suggestion: CopilotSuggestion) => {
    if (suggestion.nodeType) {
      insertStep(suggestionAnchorNodeId, suggestion.nodeType);
      return;
    }

    setCopilotFocusRequest({
      token: Date.now(),
      promptHint: suggestion.promptHint ?? suggestion.description,
    });
  };

  const toolbar = (
    <div className="analysisToolbar">
      <div>
        <h1>QueryForge Analysis Studio</h1>
        <p>
          Guided branching-ready analysis pipeline. Stage 1 renders a single
          path.
        </p>
      </div>
      <div className="analysisToolbar__actions">
        <Link
          to={routes.NoCodeQueryBuilder}
          className="analysisBtn analysisBtn--ghost"
        >
          Open Classic Builder
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <AnalysisStudioLayout
        toolbar={toolbar}
        dataExplorer={
          <DataExplorerPanel
            domains={domains}
            domainsLoading={domainsQuery.isLoading}
            domainsError={toErrorMessage(domainsQuery.error)}
            selectedDomainId={analysisState.activeDomainId}
            explorer={domainExplorer}
            explorerLoading={explorerQuery.isLoading}
            explorerError={toErrorMessage(explorerQuery.error)}
            onSelectDomain={handleSelectDomain}
            onRetryDomains={() => void domainsQuery.refetch()}
            onRetryExplorer={() => void explorerQuery.refetch()}
          />
        }
        canvas={
          <AnalysisCanvas
            domains={domains}
            orderedNodes={orderedNodes}
            selectedNodeId={analysisState.selectedNodeId}
            suggestionAnchorNodeId={suggestionAnchorNodeId}
            suggestedActions={suggestedActions}
            getSummary={getStepSummary}
            onSelectDomain={handleSelectDomain}
            onSelectNode={(nodeId) => dispatch({ type: "select-node", nodeId })}
            onEditNode={(nodeId) => {
              dispatch({ type: "select-node", nodeId });
              setEditingNodeId(nodeId);
            }}
            onDeleteNode={(nodeId) => {
              dispatch({ type: "delete-node", nodeId });
              if (editingNodeId === nodeId) setEditingNodeId(null);
            }}
            onSuggestedAction={handleSuggestedAction}
          />
        }
        copilot={
          <CopilotPanel
            suggestions={copilotSuggestions}
            focusRequest={copilotFocusRequest}
            onPromptSubmit={async () => {}}
            onApplySuggestion={handleCopilotSuggestion}
          />
        }
        results={
          <ResultsPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            rows={mockRows}
            sql={mockSql}
            explainText={explainText}
            sqlJson={sqlJson}
          />
        }
      />

      <StepEditorDrawer
        isOpen={Boolean(editingNode)}
        node={editingNode}
        domains={domains}
        activeDomainId={analysisState.activeDomainId}
        availableFields={availableFields}
        onClose={() => setEditingNodeId(null)}
        onSave={(nodeId: string, config: AnalysisNodeConfig) => {
          if (editingNode?.type === "domain") {
            const nextDomainId =
              (config as { domainId?: number | null }).domainId ?? null;
            const nextDomain =
              domains.find((domain) => domain.id === nextDomainId) ?? null;
            if (nextDomain) {
              dispatch({ type: "set-domain", domain: nextDomain });
              setEditingNodeId(null);
              return;
            }
          }

          dispatch({ type: "update-node-config", nodeId, config });
          if (selectedNode?.id !== nodeId)
            dispatch({ type: "select-node", nodeId });
          setEditingNodeId(null);
        }}
      />

      <SkillBuilder queryId={null} workspaceId={null} />
    </>
  );
}
