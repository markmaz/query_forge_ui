import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
  type XYPosition,
} from "@xyflow/react";
import { useState, type DragEvent, type MouseEvent } from "react";
import "@xyflow/react/dist/style.css";

import Icon from "@/shared/components/Icon";

import type { FlowForgeNode, FlowForgeWorkflowDefinition } from "../model/types";
import { validationIssueTone, type FlowForgeNodeValidationIssues } from "../model/workflowValidation";
import {
  FLOWFORGE_ELEMENT_DND_MIME,
  getFlowForgeElementIcon,
  type FlowForgeElementDefinition,
} from "../model/workflowElements";
import "../ui/flowforge.css";

type WorkflowCanvasProps = {
  workflow: FlowForgeWorkflowDefinition;
  selectedNodeId?: string;
  selectedEdgeId?: string | null;
  onSelectNode: (node: FlowForgeNode) => void;
  onSelectEdge?: (edgeId: string) => void;
  onClearSelection?: () => void;
  onDeleteNode?: (nodeId: string) => void;
  onDropElement?: (element: FlowForgeElementDefinition, position: XYPosition) => void;
  onNodePositionChange?: (nodeId: string, position: XYPosition) => void;
  onConnectNodes?: (connection: Connection) => void;
  nodeValidationIssues?: FlowForgeNodeValidationIssues;
};

const nodeTone: Record<string, { background: string; border: string }> = {
  schedule_trigger: { background: "#eaf4f4", border: "#79a6a6" },
  webhook_trigger: { background: "#eaf4f4", border: "#79a6a6" },
  file_watch_trigger: { background: "#eaf4f4", border: "#79a6a6" },
  intake: { background: "#eaf4f4", border: "#79a6a6" },
  scoring: { background: "#eaf7ef", border: "#8bc7a0" },
  filter: { background: "#fff5d9", border: "#e3bd57" },
  ranking: { background: "#fff2e8", border: "#d69064" },
  matching: { background: "#fff2e8", border: "#d69064" },
  human_task: { background: "#fde8df", border: "#d27d5b" },
  approval: { background: "#fde8df", border: "#d27d5b" },
  decision: { background: "#f9dddd", border: "#c87878" },
  assignment: { background: "#e3f4dc", border: "#8fbf7a" },
  notification: { background: "#e3f4dc", border: "#8fbf7a" },
  wait: { background: "#efe1dd", border: "#bb9187" },
  end: { background: "#e3f4dc", border: "#8fbf7a" },
  event_capture: { background: "#f8edc8", border: "#d6b74f" },
  iterator: { background: "#efe1dd", border: "#bb9187" },
  query_extract: { background: "#e7f0fb", border: "#7aa6d8" },
  map_transform: { background: "#f8edc8", border: "#d6b74f" },
  export: { background: "#e7f0fb", border: "#7aa6d8" },
  import: { background: "#e7f0fb", border: "#7aa6d8" },
};

function toReactFlowNode(
  node: FlowForgeNode,
  selectedNodeId?: string,
  onDeleteNode?: (nodeId: string) => void,
  nodeValidationIssues?: FlowForgeNodeValidationIssues,
): Node {
  const tone = nodeTone[node.type] ?? { background: "#ffffff", border: "#cbd5e1" };
  const issues = nodeValidationIssues?.[node.id] ?? [];
  const issueTone = validationIssueTone(issues);
  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onDeleteNode?.(node.id);
  };

  return {
    id: node.id,
    type: "default",
    position: node.position,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      nodeLabel: node.label,
      label: (
        <div className="ff-node-label">
          {onDeleteNode ? (
            <button
              type="button"
              className="ff-node-delete"
              aria-label={`Delete ${node.label}`}
              title={`Delete ${node.label}`}
              onClick={handleDelete}
            >
              <Icon provider="fa" name="times" />
            </button>
          ) : null}
          <span className="ff-node-icon" aria-hidden="true">
            <Icon provider="fa" name={getFlowForgeElementIcon(node.type)} />
          </span>
          <span className="ff-node-label-text">
            <span>{node.label}</span>
            <small>{node.type.replace("_", " ")}</small>
          </span>
          {issueTone ? (
            <span
              className={`ff-node-issue-badge is-${issueTone}`}
              title={issues.map((issue) => issue.message).join("\n")}
              aria-label={`${node.label} has ${issueTone === "error" ? "validation errors" : "validation warnings"}`}
            >
              {issueTone === "error" ? "!" : "?"}
            </span>
          ) : null}
        </div>
      ),
    },
    style: {
      width: 190,
      borderRadius: 12,
      border:
        selectedNodeId === node.id
          ? "2px solid #2b5f60"
          : issueTone === "error"
            ? "2px solid #b42318"
            : issueTone === "warning"
              ? "2px solid #b54708"
              : `1px solid ${tone.border}`,
      background: tone.background,
      color: "#14201d",
      boxShadow:
        selectedNodeId === node.id
          ? "0 0 0 5px rgba(43, 95, 96, 0.14)"
          : issueTone === "error"
            ? "0 0 0 4px rgba(180, 35, 24, 0.12)"
            : issueTone === "warning"
              ? "0 0 0 4px rgba(181, 71, 8, 0.12)"
              : "0 12px 28px rgba(15, 23, 42, 0.08)",
      fontSize: 14,
      fontWeight: 700,
    },
  };
}

function toReactFlowEdge(edge: FlowForgeWorkflowDefinition["graph"]["edges"][number], selectedEdgeId?: string | null): Edge {
  const selected = selectedEdgeId === edge.id;
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label ?? undefined,
    selected,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: selected ? "#c06240" : "#52605d",
    },
    style: {
      stroke: selected || edge.label === "Loop" ? "#c06240" : "#52605d",
      strokeWidth: selected ? 2.8 : edge.label === "Loop" ? 2.2 : 1.6,
      strokeDasharray: edge.label === "Loop" ? "6 5" : undefined,
    },
    labelStyle: {
      fill: "#2f3d3a",
      fontWeight: 750,
    },
  };
}

export default function WorkflowCanvas({
  workflow,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  onDeleteNode,
  onDropElement,
  onNodePositionChange,
  onConnectNodes,
  nodeValidationIssues,
}: WorkflowCanvasProps) {
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const nodes = workflow.graph.nodes.map((node) => toReactFlowNode(node, selectedNodeId, onDeleteNode, nodeValidationIssues));
  const edges = workflow.graph.edges.map((edge) => toReactFlowEdge(edge, selectedEdgeId));

  const handleDragOver = (event: DragEvent) => {
    if (!onDropElement) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: DragEvent) => {
    if (!onDropElement) return;
    event.preventDefault();
    const raw = event.dataTransfer.getData(FLOWFORGE_ELEMENT_DND_MIME);
    if (!raw) return;

    let element: FlowForgeElementDefinition | null = null;
    try {
      element = JSON.parse(raw) as FlowForgeElementDefinition;
    } catch {
      element = null;
    }
    if (!element) return;

    const position = flowInstance
      ? flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      : { x: event.clientX, y: event.clientY };
    onDropElement(element, position);
  };

  const handleNodesChange = (changes: NodeChange[]) => {
    if (!onNodePositionChange) return;
    changes.forEach((change) => {
      if (change.type === "position" && change.position) {
        onNodePositionChange(change.id, change.position);
      }
    });
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      minZoom={0.35}
      maxZoom={1.65}
      onInit={setFlowInstance}
      onNodesChange={handleNodesChange}
      onConnect={onConnectNodes}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onNodeClick={(_, node) => {
        const selected = workflow.graph.nodes.find((item) => item.id === node.id);
        if (selected) onSelectNode(selected);
      }}
      onEdgeClick={(_, edge) => onSelectEdge?.(edge.id)}
      onPaneClick={onClearSelection}
    >
      <Background color="#d6dfdf" gap={18} />
      <Controls position="bottom-left" />
      <MiniMap pannable zoomable position="bottom-right" />
    </ReactFlow>
  );
}
