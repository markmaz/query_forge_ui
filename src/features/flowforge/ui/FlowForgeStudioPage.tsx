import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Connection, Viewport, XYPosition } from "@xyflow/react";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import {
  listFlowForgeIntegrations,
  listFlowForgeMatchingPolicies,
  listFlowForgeResourceRecords,
  listFlowForgeResourceSets,
} from "../api/adminApi";
import { listFlowForgeCommunicationTemplates } from "../api/communicationTemplatesApi";
import {
  createFlowForgeWorkflowAIDraft,
  createFlowForgeWorkflowDraft,
  createFlowForgeWorkflowVersion,
  deleteFlowForgeWorkflow,
  listFlowForgeWorkflows,
  listFlowForgeWorkflowVersions,
  publishFlowForgeWorkflowVersion,
  validateFlowForgeGraph,
} from "../api/workflowsApi";
import FlowForgeAiAssistantPanel from "../components/FlowForgeAiAssistantPanel";
import FlowForgeDesignerRail, { FlowForgeWorkflowPanel } from "../components/FlowForgeDesignerRail";
import FlowForgeDesignerToolbar from "../components/FlowForgeDesignerToolbar";
import FlowForgeElementPalette from "../components/FlowForgeElementPalette";
import NodeConfigDrawer from "../components/NodeConfigDrawer";
import type { IntakeSourceFieldOption } from "../components/NodeInspector";
import { communicationTemplatePurposeForNode } from "../components/CommunicationTemplateSelector";
import WorkflowTemplateDrawer from "../components/WorkflowTemplateDrawer";
import WorkflowCanvas from "../components/WorkflowCanvas";
import type { FlowForgeIntegrationConfig, FlowForgeMatchingPolicy } from "../model/adminTypes";
import { buildFieldOptions } from "../model/matchingPolicyBuilder";
import {
  therapistRoutingStarterWorkflow,
} from "../model/starterWorkflows";
import type { FlowForgeNode, FlowForgeValidationResult, FlowForgeWorkflowAIDraft, FlowForgeWorkflowDefinition } from "../model/types";
import { buildNodeValidationIssues } from "../model/workflowValidation";
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

function toEdgeId(source: string, target: string, existingIds: Set<string>): string {
  const base = `edge-${source}-to-${target}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  let candidate = base || "edge";
  let index = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base || "edge"}-${index}`;
    index += 1;
  }
  return candidate;
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

const CANVAS_VIEWPORT_STORAGE_KEY = "flowforge.designer.canvasViewport.v1";

function normalizeViewport(viewport: Viewport): Viewport | null {
  const x = Number(viewport.x);
  const y = Number(viewport.y);
  const zoom = Number(viewport.zoom);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    zoom: Math.max(0.35, Math.min(1.65, Number(zoom.toFixed(3)))),
  };
}

function viewportStorageKey(workflowId: string): string {
  return `${CANVAS_VIEWPORT_STORAGE_KEY}:${workflowId}`;
}

function readStoredViewport(workflowId: string): Viewport | null {
  try {
    const raw = window.localStorage.getItem(viewportStorageKey(workflowId));
    if (!raw) return null;
    return normalizeViewport(JSON.parse(raw) as Viewport);
  } catch {
    return null;
  }
}

function storeViewport(workflowId: string, viewport: Viewport): void {
  const normalized = normalizeViewport(viewport);
  if (!normalized) return;
  try {
    window.localStorage.setItem(viewportStorageKey(workflowId), JSON.stringify(normalized));
  } catch {
    // Local storage can be disabled; persisted graph viewport still covers saved workflows.
  }
}

function withRememberedViewport(
  workflowId: string,
  graph: FlowForgeWorkflowDefinition["graph"],
): FlowForgeWorkflowDefinition["graph"] {
  return {
    ...graph,
    viewport: graph.viewport ?? readStoredViewport(workflowId) ?? undefined,
  };
}

const localWorkflowDraft: FlowForgeWorkflowDefinition = {
  id: "local-workflow",
  name: "New workflow",
  description: "Start from scratch or choose a template to create a saved workflow.",
  status: "draft",
  graph: blankWorkflowGraph(),
};

const workflowTemplates: FlowForgeWorkflowDefinition[] = [therapistRoutingStarterWorkflow];

function nodeResourceSetId(node?: FlowForgeNode): number | null {
  const raw = node?.data?.resource_set_id;
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nodeMatchingPolicyId(node?: FlowForgeNode): number | null {
  const raw = node?.data?.matching_policy_id;
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nodeIntegrationKey(node?: FlowForgeNode): string | null {
  const value = strValue(node?.data?.source);
  return value || null;
}

function strValue(value: unknown): string {
  return String(value ?? "").trim();
}

function upstreamIntakeIntegrationKey(
  node: FlowForgeNode | undefined,
  graph: FlowForgeWorkflowDefinition["graph"],
): string | null {
  const direct = nodeIntegrationKey(node);
  if (direct) return direct;
  if (!node) return null;

  const nodesById = new Map(graph.nodes.map((entry) => [entry.id, entry]));
  const queue = graph.edges.filter((edge) => edge.target === node.id).map((edge) => edge.source);
  const visited = new Set<string>([node.id]);

  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);

    const upstreamNode = nodesById.get(nodeId);
    if (upstreamNode?.type === "intake") {
      const integrationKey = nodeIntegrationKey(upstreamNode);
      if (integrationKey) return integrationKey;
    }
    queue.push(...graph.edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source));
  }

  return null;
}

function intakeFieldPath(path: string): string {
  const cleanPath = strValue(path).replace(/^\.+|\.+$/g, "");
  if (!cleanPath) return "";
  return cleanPath.startsWith("intake.") ? cleanPath : `intake.fields.${cleanPath}`;
}

function intakeSourceFieldOptions(
  integrationKey: string | null,
  integrations: FlowForgeIntegrationConfig[],
): IntakeSourceFieldOption[] {
  if (!integrationKey) return [];
  const integration = integrations.find((item) => item.integration_key === integrationKey);
  return (integration?.source_fields ?? [])
    .map((field) => ({
      value: intakeFieldPath(field.path),
      label: field.label || field.path,
      type: field.type || "unknown",
      required: field.required,
      sensitive: field.sensitive,
    }))
    .filter((field) => field.value);
}

function policyResourceSetId(policyId: number | null, matchingPolicies: FlowForgeMatchingPolicy[]): number | null {
  if (!policyId) return null;
  return matchingPolicies.find((policy) => policy.id === policyId)?.resource_set_id ?? null;
}

function nodeGraphResourceSetId(
  node: FlowForgeNode | undefined,
  graph: FlowForgeWorkflowDefinition["graph"],
  matchingPolicies: FlowForgeMatchingPolicy[],
): number | null {
  const directResourceSetId = nodeResourceSetId(node);
  if (directResourceSetId) return directResourceSetId;

  const directPolicyResourceSetId = policyResourceSetId(nodeMatchingPolicyId(node), matchingPolicies);
  if (directPolicyResourceSetId) return directPolicyResourceSetId;
  if (!node) return null;

  const nodesById = new Map(graph.nodes.map((entry) => [entry.id, entry]));
  const queue = graph.edges.filter((edge) => edge.target === node.id).map((edge) => edge.source);
  const visited = new Set<string>([node.id]);

  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);

    const upstreamNode = nodesById.get(nodeId);
    const upstreamResourceSetId =
      nodeResourceSetId(upstreamNode) ?? policyResourceSetId(nodeMatchingPolicyId(upstreamNode), matchingPolicies);
    if (upstreamResourceSetId) return upstreamResourceSetId;

    queue.push(...graph.edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source));
  }

  return null;
}

export default function FlowForgeStudioPage() {
  const queryClient = useQueryClient();
  const nextCreateMessage = useRef("Persisted workflow draft created.");
  const workflowsQuery = useQuery({
    queryKey: ["flowforge", "workflows"],
    queryFn: listFlowForgeWorkflows,
    placeholderData: [],
  });
  const workflows = workflowsQuery.data ?? [];
  const [activeWorkflowId, setActiveWorkflowId] = useState(localWorkflowDraft.id);
  const [activeCreatedWorkflow, setActiveCreatedWorkflow] = useState<FlowForgeWorkflowDefinition | null>(null);
  const activeWorkflow: FlowForgeWorkflowDefinition = useMemo(
    () =>
      workflows.find((workflow) => workflow.id === activeWorkflowId) ??
      (activeCreatedWorkflow?.id === activeWorkflowId ? activeCreatedWorkflow : null) ??
      workflows[0] ??
      localWorkflowDraft,
    [activeCreatedWorkflow, activeWorkflowId, workflows],
  );
  const [draftGraph, setDraftGraph] = useState(() => withRememberedViewport(activeWorkflow.id, activeWorkflow.graph));
  const [selectedNode, setSelectedNode] = useState<FlowForgeNode | undefined>(activeWorkflow.graph.nodes[0]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [workflowDeleteTarget, setWorkflowDeleteTarget] = useState<FlowForgeWorkflowDefinition | null>(null);
  const [aiOpen, setAiOpen] = useState(true);
  const [workflowsOpen, setWorkflowsOpen] = useState(false);
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
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
    const activeWorkflowStillAvailable =
      workflows.some((workflow) => workflow.id === activeWorkflowId) || activeCreatedWorkflow?.id === activeWorkflowId;
    if (!activeWorkflowStillAvailable) {
      setActiveWorkflowId(workflows[0]?.id ?? localWorkflowDraft.id);
    }
  }, [activeCreatedWorkflow, activeWorkflowId, workflows]);

  useEffect(() => {
    if (activeCreatedWorkflow && workflows.some((workflow) => workflow.id === activeCreatedWorkflow.id)) {
      setActiveCreatedWorkflow(null);
    }
  }, [activeCreatedWorkflow, workflows]);

  useEffect(() => {
    setDraftGraph(withRememberedViewport(activeWorkflow.id, activeWorkflow.graph));
    setSelectedEdgeId(null);
    setConfigDrawerOpen(false);
  }, [activeWorkflow]);

  useEffect(() => {
    setSelectedNode((current) =>
      selectedEdgeId ? undefined : draftGraph.nodes.find((node) => node.id === current?.id) ?? draftGraph.nodes[0],
    );
    if (selectedEdgeId && !draftGraph.edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [draftGraph, selectedEdgeId]);

  const versionsQuery = useQuery({
    queryKey: ["flowforge", "workflow-versions", persistedWorkflowDefinitionId],
    queryFn: () => listFlowForgeWorkflowVersions(persistedWorkflowDefinitionId as number),
    enabled: Boolean(persistedWorkflowDefinitionId),
    placeholderData: [],
  });
  const publishableVersion = versionsQuery.data?.find(
    (version) => version.validation_status === "valid" && version.version_status !== "published",
  );
  const resourceSetsQuery = useQuery({
    queryKey: ["flowforge", "admin", "resource-sets"],
    queryFn: listFlowForgeResourceSets,
    placeholderData: [],
  });
  const integrationsQuery = useQuery({
    queryKey: ["flowforge", "admin", "integrations"],
    queryFn: listFlowForgeIntegrations,
    placeholderData: [],
  });
  const matchingPoliciesQuery = useQuery({
    queryKey: ["flowforge", "admin", "matching-policies"],
    queryFn: listFlowForgeMatchingPolicies,
    placeholderData: [],
  });
  const integrations = integrationsQuery.data ?? [];
  const selectedNodeIntegrationKey = useMemo(
    () => upstreamIntakeIntegrationKey(selectedNode, draftGraph),
    [draftGraph, selectedNode],
  );
  const selectedIntakeSourceFieldOptions = useMemo(
    () => intakeSourceFieldOptions(selectedNodeIntegrationKey, integrations),
    [integrations, selectedNodeIntegrationKey],
  );
  const matchingPolicies = matchingPoliciesQuery.data ?? [];
  const selectedNodeResourceSetId = useMemo(
    () => nodeGraphResourceSetId(selectedNode, draftGraph, matchingPolicies),
    [draftGraph, matchingPolicies, selectedNode],
  );
  const selectedNodeTemplatePurpose = communicationTemplatePurposeForNode(selectedNode);
  const communicationTemplatesQuery = useQuery({
    queryKey: ["flowforge", "communication-templates", "designer", selectedNodeTemplatePurpose, selectedNodeResourceSetId],
    queryFn: () =>
      listFlowForgeCommunicationTemplates({
        status: "active",
        purpose: selectedNodeTemplatePurpose ?? undefined,
        channel: "email",
        ...(selectedNodeResourceSetId ? { resource_set_id: selectedNodeResourceSetId } : {}),
      }),
    enabled: Boolean(selectedNodeTemplatePurpose),
    placeholderData: [],
  });
  const compatibleCommunicationTemplates = useMemo(
    () =>
      (communicationTemplatesQuery.data ?? []).filter((template) => {
        if (template.status !== "active" || template.channel !== "email" || template.purpose !== selectedNodeTemplatePurpose) return false;
        if (!selectedNodeResourceSetId) return !template.resource_set_id;
        return !template.resource_set_id || template.resource_set_id === selectedNodeResourceSetId;
      }),
    [communicationTemplatesQuery.data, selectedNodeResourceSetId, selectedNodeTemplatePurpose],
  );
  const resourceRecordsQuery = useQuery({
    queryKey: ["flowforge", "admin", "resource-records", selectedNodeResourceSetId],
    queryFn: () => listFlowForgeResourceRecords(selectedNodeResourceSetId as number, { limit: 100, offset: 0 }),
    enabled: Boolean(selectedNodeResourceSetId),
    placeholderData: selectedNodeResourceSetId
      ? {
          resource_set_id: selectedNodeResourceSetId,
          limit: 100,
          offset: 0,
          records: [],
        }
      : undefined,
  });
  const resourceFieldOptions = useMemo(
    () => (selectedNodeResourceSetId ? buildFieldOptions(resourceRecordsQuery.data?.records ?? []) : []),
    [resourceRecordsQuery.data?.records, selectedNodeResourceSetId],
  );

  const createDraftMutation = useMutation({
    mutationFn: createFlowForgeWorkflowDraft,
    onSuccess: (workflow) => {
      queryClient.setQueryData<FlowForgeWorkflowDefinition[]>(["flowforge", "workflows"], (current) => {
        const existing = current?.filter((item) => item.id !== workflow.id) ?? [];
        return [workflow, ...existing];
      });
      setActiveCreatedWorkflow(workflow);
      setActiveWorkflowId(workflow.id);
      setDraftGraph(withRememberedViewport(workflow.id, workflow.graph));
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

  const workflowAiDraftMutation = useMutation({
    mutationFn: (prompt: string) =>
      createFlowForgeWorkflowAIDraft({
        prompt,
        graph: draftGraph,
        use_llm: true,
      }),
    onSuccess: (draft) => {
      setDraftGraph(draft.graph);
      setSelectedEdgeId(null);
      const lastNode = draft.graph.nodes[draft.graph.nodes.length - 1];
      setSelectedNode(lastNode);
      setConfigDrawerOpen(Boolean(lastNode));
      setSaveMessage("FlowForge AI drafted workflow graph changes locally. Review, configure, and save a draft version.");
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
        const nextWorkflow = workflows.find((workflow) => workflow.id !== deletedId) ?? localWorkflowDraft;
        setActiveWorkflowId(nextWorkflow.id);
        setDraftGraph(withRememberedViewport(nextWorkflow.id, nextWorkflow.graph));
      }
      setSaveMessage("Workflow deleted.");
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflows"] });
    },
  });

  const handleCreateBlankWorkflow = () => {
    const graph = blankWorkflowGraph();
    nextCreateMessage.current = "New blank workflow created.";
    setTemplateDrawerOpen(false);
    createDraftMutation.mutate({
      workflow_key: toWorkflowKey("Untitled Workflow"),
      name: "Untitled Workflow",
      description: "New FlowForge workflow.",
      graph,
    });
  };

  const handleOpenTemplateDrawer = () => {
    setTemplateDrawerOpen(true);
  };

  const handleCreateTemplateWorkflow = (template: FlowForgeWorkflowDefinition) => {
    nextCreateMessage.current = "Workflow created from template.";
    setTemplateDrawerOpen(false);
    createDraftMutation.mutate({
      workflow_key: toWorkflowKey(template.name),
      name: template.name,
      description: template.description,
      graph: template.graph,
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

  const handleCanvasViewportChange = useCallback((viewport: Viewport) => {
    const normalized = normalizeViewport(viewport);
    if (!normalized) return;
    storeViewport(activeWorkflow.id, normalized);
    setDraftGraph((current) => {
      const currentViewport = current.viewport ? normalizeViewport(current.viewport) : null;
      if (
        currentViewport &&
        currentViewport.x === normalized.x &&
        currentViewport.y === normalized.y &&
        currentViewport.zoom === normalized.zoom
      ) {
        return current;
      }
      return {
        ...current,
        viewport: normalized,
      };
    });
  }, [activeWorkflow.id]);

  const handleConnectNodes = useCallback((connection: Connection) => {
    const source = String(connection.source || "").trim();
    const target = String(connection.target || "").trim();
    if (!source || !target || source === target) return;

    setDraftGraph((current) => {
      const sourceExists = current.nodes.some((node) => node.id === source);
      const targetExists = current.nodes.some((node) => node.id === target);
      const duplicate = current.edges.some((edge) => edge.source === source && edge.target === target);
      if (!sourceExists || !targetExists || duplicate) return current;
      return {
        ...current,
        edges: [
          ...current.edges,
          {
            id: toEdgeId(source, target, new Set(current.edges.map((edge) => edge.id))),
            source,
            target,
          },
        ],
      };
    });
    setSaveMessage("Connection added locally. Save a draft version to persist it.");
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    const target = draftGraph.nodes.find((node) => node.id === nodeId);
    if (!target) return;

    setDraftGraph((current) => {
      return {
        ...current,
        nodes: current.nodes.filter((node) => node.id !== nodeId),
        edges: current.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      };
    });
    setSelectedEdgeId(null);
    setConfigDrawerOpen(false);
    setSaveMessage(`${target.label} deleted locally. Save a draft version to persist it.`);
  }, [draftGraph.nodes]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    const target = draftGraph.edges.find((edge) => edge.id === edgeId);
    if (!target) return;

    setDraftGraph((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.id !== edgeId),
    }));
    setSelectedEdgeId(null);
    setSaveMessage("Connection deleted locally. Save a draft version to persist it.");
  }, [draftGraph.edges]);

  const handleSelectNode = useCallback((node: FlowForgeNode) => {
    setSelectedEdgeId(null);
    setSelectedNode(node);
    setConfigDrawerOpen(true);
  }, []);

  const handleSelectEdge = useCallback((edgeId: string) => {
    setSelectedNode(undefined);
    setSelectedEdgeId(edgeId);
    setConfigDrawerOpen(false);
    setSaveMessage("Connection selected. Press Delete or use Delete connection to remove it.");
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!selectedNode?.id && !selectedEdgeId) return;

      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();
      const isEditing =
        target?.isContentEditable ||
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select";
      if (isEditing) return;

      event.preventDefault();
      if (selectedEdgeId) {
        handleDeleteEdge(selectedEdgeId);
        return;
      }
      if (selectedNode?.id) handleDeleteNode(selectedNode.id);
    };

    window.addEventListener("keydown", handleDeleteKey);
    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [handleDeleteEdge, handleDeleteNode, selectedEdgeId, selectedNode?.id]);

  const handleAddElement = (element: FlowForgeElementDefinition, explicitPosition?: XYPosition) => {
    const existingIds = new Set(draftGraph.nodes.map((node) => node.id));
    const createdNode: FlowForgeNode = {
      id: toNodeId(element.label, existingIds),
      type: element.type,
      label: element.label,
      position: explicitPosition ?? defaultNodePosition(draftGraph.nodes.length),
      data: { ...element.defaultData },
    };
    setDraftGraph((current) => {
      return {
        ...current,
        nodes: [...current.nodes, createdNode],
      };
    });
    setSelectedEdgeId(null);
    setSelectedNode(createdNode);
    setConfigDrawerOpen(true);
    setSaveMessage(`${element.label} added locally. Connect and save the workflow when ready.`);
  };

  const handlePublishVersion = (versionId: number) => {
    publishMutation.mutate(versionId);
  };

  const handlePublishWorkflow = (workflow: FlowForgeWorkflowDefinition) => {
    if (workflow.id !== activeWorkflow.id || !persistedWorkflowDefinitionId || !publishableVersion) return;
    publishMutation.mutate(publishableVersion.id);
  };

  const handleWorkflowAIDraft = async (prompt: string): Promise<FlowForgeWorkflowAIDraft> => {
    return workflowAiDraftMutation.mutateAsync(prompt);
  };

  const handleDeleteWorkflow = (workflow: FlowForgeWorkflowDefinition) => {
    if (!isPersistedWorkflowId(workflow.id)) return;
    setWorkflowDeleteTarget(workflow);
  };

  const handleConfirmDeleteWorkflow = () => {
    if (!workflowDeleteTarget || !isPersistedWorkflowId(workflowDeleteTarget.id)) return;
    deleteWorkflowMutation.mutate(Number(workflowDeleteTarget.id), {
      onSettled: () => setWorkflowDeleteTarget(null),
    });
  };

  const validationGraph = useMemo(
    () => ({
      nodes: draftGraph.nodes,
      edges: draftGraph.edges,
    }),
    [draftGraph.edges, draftGraph.nodes],
  );

  const validationQuery = useQuery<FlowForgeValidationResult>({
    queryKey: ["flowforge", "validation", activeWorkflow.id, validationGraph],
    queryFn: () => validateFlowForgeGraph(validationGraph),
    enabled: Boolean(activeWorkflow.id),
    placeholderData: {
      valid: true,
      errors: [],
      warnings: ["Graph contains a loop. FlowForge allows this, but runtime execution must use state-machine semantics."],
    },
  });

  const validation = validationQuery.data ?? { valid: true, errors: [], warnings: [] };
  const nodeValidationIssues = useMemo(() => buildNodeValidationIssues(validation), [validation]);
  const selectedNodeValidationIssues = selectedNode ? (nodeValidationIssues[selectedNode.id] ?? []) : [];
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
              onCreateBlankWorkflow={handleCreateBlankWorkflow}
              onCreateTemplateWorkflow={handleOpenTemplateDrawer}
              onSaveVersion={() => saveVersionMutation.mutate()}
              createBlankDisabled={createDraftMutation.isPending}
              createTemplateDisabled={createDraftMutation.isPending}
              saveVersionDisabled={versionSaveBlocked}
            />
          </aside>
          <FlowForgeWorkflowPanel
            activeWorkflowId={activeWorkflow.id}
            activeWorkflowPersisted={Boolean(persistedWorkflowDefinitionId)}
            activeWorkflowVersions={versionsQuery.data ?? []}
            open={workflowsOpen}
            publishableWorkflowId={publishableVersion && persistedWorkflow ? activeWorkflow.id : undefined}
            publishVersionPending={publishMutation.isPending}
            workflows={workflows}
            onOpenWorkflow={(workflowId) => {
              setSaveMessage(null);
              setActiveCreatedWorkflow(null);
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
            onPublishVersion={handlePublishVersion}
          />
        </div>
        <FlowForgeElementPalette onAddElement={handleAddElement} />
        <div className="ff-canvas-panel" aria-label="FlowForge workflow canvas">
          <WorkflowCanvas
            workflow={editableWorkflow}
            selectedNodeId={selectedNode?.id}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            onClearSelection={handleClearSelection}
            onDeleteNode={handleDeleteNode}
            onDropElement={handleAddElement}
            onNodePositionChange={handleNodePositionChange}
            onViewportChange={handleCanvasViewportChange}
            onConnectNodes={handleConnectNodes}
            nodeValidationIssues={nodeValidationIssues}
          />
        </div>
        <div className="ff-right-rail">
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
              <div className="small ff-muted">FlowForge workflows could not be loaded. You can still draft locally and create a saved workflow.</div>
            ) : null}
            {saveMessage ? <div className="small ff-save-message">{saveMessage}</div> : null}
            {selectedEdgeId ? (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => handleDeleteEdge(selectedEdgeId)}
              >
                Delete connection
              </button>
            ) : null}
            {createDraftMutation.isError || saveVersionMutation.isError || publishMutation.isError ? (
              <div className="text-danger small">Workflow authoring request failed. Check your FlowForge permissions and API logs.</div>
            ) : null}
            {workflowAiDraftMutation.isError ? (
              <div className="text-danger small">FlowForge AI request failed. Check the workspace FlowForge LLM configuration.</div>
            ) : null}
            {deleteWorkflowMutation.isError ? (
              <div className="text-danger small">Workflow delete failed. Check your FlowForge permissions and API logs.</div>
            ) : null}
          </section>
          <FlowForgeAiAssistantPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            onDraftWorkflow={handleWorkflowAIDraft}
          />
        </div>
      </section>
      <NodeConfigDrawer
        open={configDrawerOpen && Boolean(selectedNode)}
        node={selectedNode}
        editable
        integrations={integrations}
        integrationsLoading={integrationsQuery.isFetching}
        matchingPolicies={matchingPoliciesQuery.data ?? []}
        resourceSets={resourceSetsQuery.data ?? []}
        intakeSourceFieldOptions={selectedIntakeSourceFieldOptions}
        resourceFieldOptions={resourceFieldOptions}
        resourceFieldsLoading={resourceRecordsQuery.isFetching}
        communicationTemplates={compatibleCommunicationTemplates}
        communicationTemplatesLoading={communicationTemplatesQuery.isFetching}
        communicationTemplateResourceSetId={selectedNodeResourceSetId}
        validationIssues={selectedNodeValidationIssues}
        onNodeChange={handleNodeChange}
        onClose={() => setConfigDrawerOpen(false)}
      />
      <WorkflowTemplateDrawer
        open={templateDrawerOpen}
        templates={workflowTemplates}
        createPending={createDraftMutation.isPending}
        onClose={() => setTemplateDrawerOpen(false)}
        onUseTemplate={handleCreateTemplateWorkflow}
      />
      <ConfirmDialog
        open={Boolean(workflowDeleteTarget)}
        title="Delete workflow"
        message={
          <>
            Delete <strong>{workflowDeleteTarget?.name}</strong>? This archives the workflow for this workspace.
          </>
        }
        confirmLabel="Delete workflow"
        busy={deleteWorkflowMutation.isPending}
        onClose={() => setWorkflowDeleteTarget(null)}
        onConfirm={handleConfirmDeleteWorkflow}
      />
    </main>
  );
}
