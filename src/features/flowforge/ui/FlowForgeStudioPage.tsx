import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { XYPosition } from "@xyflow/react";

import {
  createFlowForgeWorkflowDraft,
  createFlowForgeWorkflowVersion,
  deleteFlowForgeWorkflow,
  getFlowForgeRunInspector,
  listFlowForgeWorkflows,
  listFlowForgeWorkflowVersions,
  publishFlowForgeWorkflowVersion,
  validateFlowForgeGraph,
} from "../api/workflowsApi";
import FlowForgeAiAssistantPanel from "../components/FlowForgeAiAssistantPanel";
import FlowForgeDesignerRail, { FlowForgeWorkflowPanel } from "../components/FlowForgeDesignerRail";
import FlowForgeDesignerToolbar from "../components/FlowForgeDesignerToolbar";
import FlowForgeElementPalette from "../components/FlowForgeElementPalette";
import NodeInspector from "../components/NodeInspector";
import RunPanel from "../components/RunPanel";
import WorkflowCanvas from "../components/WorkflowCanvas";
import { therapistRoutingRunInspector, therapistRoutingSeed } from "../model/therapistRoutingSeed";
import type { FlowForgeNode, FlowForgeValidationResult, FlowForgeWorkflowDefinition } from "../model/types";
import type { FlowForgeElementDefinition } from "../model/workflowElements";
import "./flowforge.css";

function isPersistedWorkflowId(workflowId: string): boolean {
  return /^\d+$/.test(workflowId);
}

function toWorkflowKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `${slug || "workflow"}-${stamp}`;
}

function toNodeId(label: string, existingIds: Set<string>): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "step";
  let candidate = slug;
  let index = 2;
  while (existingIds.has(candidate)) {
    candidate = `${slug}-${index}`;
    index += 1;
  }
  return candidate;
}

function defaultNodePosition(nodeCount: number): XYPosition {
  return {
    x: 120 + (nodeCount % 4) * 240,
    y: 140 + Math.floor(nodeCount / 4) * 170,
  };
}

function blankWorkflowGraph(): FlowForgeWorkflowDefinition["graph"] {
  return {
    nodes: [
      {
        id: "start",
        type: "intake",
        label: "Start",
        position: { x: 120, y: 140 },
        data: {},
      },
    ],
    edges: [],
  };
}

export default function FlowForgeStudioPage() {
  const queryClient = useQueryClient();
  const nextCreateMessage = useRef("Persisted workflow draft created.");
  const workflowsQuery = useQuery({
    queryKey: ["flowforge", "workflows"],
    queryFn: listFlowForgeWorkflows,
    placeholderData: [therapistRoutingSeed],
  });
  const workflows = workflowsQuery.data?.length ? workflowsQuery.data : [therapistRoutingSeed];
  const [activeWorkflowId, setActiveWorkflowId] = useState(therapistRoutingSeed.id);
  const activeWorkflow: FlowForgeWorkflowDefinition = useMemo(
    () => workflows.find((workflow) => workflow.id === activeWorkflowId) ?? workflows[0] ?? therapistRoutingSeed,
    [activeWorkflowId, workflows],
  );
  const [draftGraph, setDraftGraph] = useState(activeWorkflow.graph);
  const [selectedNode, setSelectedNode] = useState<FlowForgeNode | undefined>(activeWorkflow.graph.nodes[0]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [workflowsOpen, setWorkflowsOpen] = useState(false);
  const persistedWorkflow = isPersistedWorkflowId(activeWorkflow.id);
  const persistedWorkflowDefinitionId = persistedWorkflow ? Number(activeWorkflow.id) : undefined;
  const editableWorkflow: FlowForgeWorkflowDefinition = useMemo(
    () => ({
      ...activeWorkflow,
      graph: draftGraph,
    }),
    [activeWorkflow, draftGraph],
  );

  useEffect(() => {
    if (!workflows.some((workflow) => workflow.id === activeWorkflowId)) {
      setActiveWorkflowId(workflows[0]?.id ?? therapistRoutingSeed.id);
    }
  }, [activeWorkflowId, workflows]);

  useEffect(() => {
    setDraftGraph(activeWorkflow.graph);
  }, [activeWorkflow]);

  useEffect(() => {
    setSelectedNode((current) => draftGraph.nodes.find((node) => node.id === current?.id) ?? draftGraph.nodes[0]);
  }, [draftGraph]);

  const versionsQuery = useQuery({
    queryKey: ["flowforge", "workflow-versions", persistedWorkflowDefinitionId],
    queryFn: () => listFlowForgeWorkflowVersions(persistedWorkflowDefinitionId as number),
    enabled: Boolean(persistedWorkflowDefinitionId),
    placeholderData: [],
  });
  const publishableVersion = versionsQuery.data?.find(
    (version) => version.validation_status === "valid" && version.version_status !== "published",
  );

  const createDraftMutation = useMutation({
    mutationFn: createFlowForgeWorkflowDraft,
    onSuccess: (workflow) => {
      queryClient.setQueryData<FlowForgeWorkflowDefinition[]>(["flowforge", "workflows"], (current) => {
        const existing = current?.filter((item) => item.id !== workflow.id) ?? [];
        return [workflow, ...existing];
      });
      setActiveWorkflowId(workflow.id);
      setDraftGraph(workflow.graph);
      setSaveMessage(nextCreateMessage.current);
      nextCreateMessage.current = "Persisted workflow draft created.";
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflows"] });
    },
  });

  const saveVersionMutation = useMutation({
    mutationFn: () =>
      createFlowForgeWorkflowVersion(persistedWorkflowDefinitionId as number, {
        graph: draftGraph,
      }),
    onSuccess: () => {
      setSaveMessage("Draft version saved.");
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflow-versions", persistedWorkflowDefinitionId] });
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflows"] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (versionId: number) => publishFlowForgeWorkflowVersion(persistedWorkflowDefinitionId as number, versionId),
    onSuccess: () => {
      setSaveMessage("Workflow version published.");
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflow-versions", persistedWorkflowDefinitionId] });
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflows"] });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: (workflowDefinitionId: number) => deleteFlowForgeWorkflow(workflowDefinitionId),
    onSuccess: (_result, workflowDefinitionId) => {
      const deletedId = String(workflowDefinitionId);
      queryClient.setQueryData<FlowForgeWorkflowDefinition[]>(["flowforge", "workflows"], (current) =>
        current?.filter((workflow) => workflow.id !== deletedId) ?? current,
      );
      if (activeWorkflowId === deletedId) {
        const nextWorkflow = workflows.find((workflow) => workflow.id !== deletedId) ?? therapistRoutingSeed;
        setActiveWorkflowId(nextWorkflow.id);
        setDraftGraph(nextWorkflow.graph);
      }
      setSaveMessage("Workflow deleted.");
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflows"] });
    },
  });

  const handleCreateDraft = () => {
    nextCreateMessage.current = "Persisted workflow draft created.";
    createDraftMutation.mutate({
      workflow_key: toWorkflowKey(activeWorkflow.name),
      name: persistedWorkflow ? `${activeWorkflow.name} copy` : activeWorkflow.name,
      description: activeWorkflow.description,
      graph: draftGraph,
    });
  };

  const handleCreateBlankWorkflow = () => {
    const graph = blankWorkflowGraph();
    nextCreateMessage.current = "New blank workflow created.";
    createDraftMutation.mutate({
      workflow_key: toWorkflowKey("Untitled Workflow"),
      name: "Untitled Workflow",
      description: "New FlowForge workflow.",
      graph,
    });
  };

  const handleNodeChange = (nodeId: string, patch: Partial<Pick<FlowForgeNode, "label" | "data">>) => {
    setDraftGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    }));
    setSaveMessage("Node updated locally. Save a draft version to persist it.");
  };

  const handleNodePositionChange = (nodeId: string, position: XYPosition) => {
    setDraftGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
    }));
    setSaveMessage("Canvas layout updated locally. Save a draft version to persist it.");
  };

  const handleAddElement = (element: FlowForgeElementDefinition, explicitPosition?: XYPosition) => {
    let createdNode: FlowForgeNode | null = null;
    setDraftGraph((current) => {
      const existingIds = new Set(current.nodes.map((node) => node.id));
      const id = toNodeId(element.label, existingIds);
      createdNode = {
        id,
        type: element.type,
        label: element.label,
        position: explicitPosition ?? defaultNodePosition(current.nodes.length),
        data: { ...element.defaultData },
      };
      return {
        ...current,
        nodes: [...current.nodes, createdNode],
      };
    });
    if (createdNode) setSelectedNode(createdNode);
    setSaveMessage(`${element.label} added locally. Connect and save the workflow when ready.`);
  };

  const handlePublishVersion = (versionId: number) => {
    publishMutation.mutate(versionId);
  };

  const handlePublishWorkflow = (workflow: FlowForgeWorkflowDefinition) => {
    if (workflow.id !== activeWorkflow.id || !persistedWorkflowDefinitionId || !publishableVersion) return;
    publishMutation.mutate(publishableVersion.id);
  };

  const handleDeleteWorkflow = (workflow: FlowForgeWorkflowDefinition) => {
    if (!isPersistedWorkflowId(workflow.id)) return;
    const confirmed = window.confirm(`Delete workflow "${workflow.name}"? This archives the workflow for this workspace.`);
    if (!confirmed) return;
    deleteWorkflowMutation.mutate(Number(workflow.id));
  };

  const validationQuery = useQuery<FlowForgeValidationResult>({
    queryKey: ["flowforge", "validation", activeWorkflow.id, draftGraph],
    queryFn: () => validateFlowForgeGraph(draftGraph),
    enabled: Boolean(activeWorkflow.id),
    placeholderData: {
      valid: true,
      errors: [],
      warnings: ["Graph contains a loop. FlowForge allows this, but runtime execution must use state-machine semantics."],
    },
  });

  const runInspectorQuery = useQuery({
    queryKey: ["flowforge", "run-inspector", activeWorkflow.id],
    queryFn: () => getFlowForgeRunInspector(activeWorkflow.id),
    enabled: Boolean(activeWorkflow.id),
    placeholderData: therapistRoutingRunInspector,
  });

  const validation = validationQuery.data ?? { valid: true, errors: [], warnings: [] };
  const validationTone = !validation.valid ? "is-invalid" : validation.warnings.length ? "is-warning" : "is-valid";
  const versionSaveBlocked = !persistedWorkflowDefinitionId || !validation.valid || saveVersionMutation.isPending;
  return (
    <main className="ff-page">
      <FlowForgeDesignerToolbar
        title={activeWorkflow.name}
        description={
          <>
            Visual workflow and routing studio for long-running, event-first processes. The editor is graph-oriented;
            runtime execution will support loops, wait states, human decisions, retries, and audit events.
          </>
        }
      />

      <section className="ff-designer-layout">
        <div className="ff-designer-left-cluster">
          <aside className="ff-layout-rail">
            <FlowForgeDesignerRail
              workflowsOpen={workflowsOpen}
              aiOpen={aiOpen}
              onToggleWorkflows={() => setWorkflowsOpen((current) => !current)}
              onToggleAi={() => setAiOpen((current) => !current)}
              onCreateDraft={handleCreateDraft}
              onCreateBlankWorkflow={handleCreateBlankWorkflow}
              onSaveVersion={() => saveVersionMutation.mutate()}
              createDraftDisabled={!validation.valid || createDraftMutation.isPending}
              createBlankDisabled={createDraftMutation.isPending}
              saveVersionDisabled={versionSaveBlocked}
            />
          </aside>
          <FlowForgeWorkflowPanel
            activeWorkflowId={activeWorkflow.id}
            open={workflowsOpen}
            publishableWorkflowId={publishableVersion && persistedWorkflow ? activeWorkflow.id : undefined}
            workflows={workflows}
            onOpenWorkflow={(workflowId) => {
              setSaveMessage(null);
              setActiveWorkflowId(workflowId);
            }}
            onCopyWorkflow={(workflow) => {
              createDraftMutation.mutate({
                workflow_key: toWorkflowKey(workflow.name),
                name: `${workflow.name} copy`,
                description: workflow.description,
                graph: workflow.graph,
              });
            }}
            onDeleteWorkflow={handleDeleteWorkflow}
            onPublishWorkflow={handlePublishWorkflow}
          />
        </div>
        <FlowForgeElementPalette onAddElement={handleAddElement} />
        <div className="ff-canvas-panel" aria-label="FlowForge workflow canvas">
          <WorkflowCanvas
            workflow={editableWorkflow}
            selectedNodeId={selectedNode?.id}
            onSelectNode={setSelectedNode}
            onDropElement={handleAddElement}
            onNodePositionChange={handleNodePositionChange}
          />
        </div>
        <div className="ff-right-rail">
          <FlowForgeAiAssistantPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            onAddElement={handleAddElement}
          />
          <section className="ff-validation-panel" aria-label="Graph validation">
            <div className={`ff-validation-chip ${validationTone}`}>
              {!validation.valid ? "Invalid graph" : validation.warnings.length ? "Valid with warnings" : "Valid graph"}
            </div>
            {validation.errors.map((error) => (
              <div key={error} className="text-danger small">
                {error}
              </div>
            ))}
            {validation.warnings.map((warning) => (
              <div key={warning} className="text-warning-emphasis small">
                {warning}
              </div>
            ))}
            {workflowsQuery.isError ? (
              <div className="small ff-muted">Using local seed because the FlowForge API is unavailable.</div>
            ) : null}
            {saveMessage ? <div className="small ff-save-message">{saveMessage}</div> : null}
            {createDraftMutation.isError || saveVersionMutation.isError || publishMutation.isError ? (
              <div className="text-danger small">Workflow authoring request failed. Check your FlowForge permissions and API logs.</div>
            ) : null}
            {deleteWorkflowMutation.isError ? (
              <div className="text-danger small">Workflow delete failed. Check your FlowForge permissions and API logs.</div>
            ) : null}
          </section>
          <NodeInspector node={selectedNode} editable onNodeChange={handleNodeChange} />
          <section className="ff-version-panel" aria-label="Workflow version history">
            <div>
              <div className="ff-eyebrow">Version history</div>
              <h2>Drafts and publishes</h2>
            </div>
            {!persistedWorkflowDefinitionId ? (
              <p className="ff-muted">Create a persisted draft before saving versions or publishing.</p>
            ) : versionsQuery.data?.length ? (
              <div className="ff-version-list">
                {versionsQuery.data.map((version) => (
                  <article key={version.id} className="ff-version-card">
                    <div>
                      <strong>Version {version.version_number}</strong>
                      <span>{version.version_status}</span>
                    </div>
                    <small>{version.validation_status}</small>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      disabled={version.version_status === "published" || version.validation_status !== "valid" || publishMutation.isPending}
                      onClick={() => handlePublishVersion(version.id)}
                    >
                      Publish
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="ff-muted">No saved versions yet.</p>
            )}
          </section>
          <RunPanel inspector={runInspectorQuery.data ?? therapistRoutingRunInspector} />
        </div>
      </section>
    </main>
  );
}
