import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Connection, Viewport, XYPosition } from "@xyflow/react";
import { toast } from "react-toastify";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { hydrateQueryTree } from "@/shared/services/queryTreeApi";
import {
  createFlowForgeIntegration,
  createIntegrationTrigger,
  listFlowForgeIntegrations,
  listIntegrationTriggers,
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
import EdgeConfigDrawer from "../components/EdgeConfigDrawer";
import FlowForgeAiAssistantPanel from "../components/FlowForgeAiAssistantPanel";
import FlowForgeDesignerRail, { FlowForgeWorkflowPanel } from "../components/FlowForgeDesignerRail";
import FlowForgeDesignerToolbar from "../components/FlowForgeDesignerToolbar";
import FlowForgeElementPalette from "../components/FlowForgeElementPalette";
import FlowForgeIntegrationDrawer, { type FlowForgeIntegrationDrawerMode, type FlowForgeIntegrationSecret } from "../components/FlowForgeIntegrationDrawer";
import NodeConfigDrawer from "../components/NodeConfigDrawer";
import type { IntakeSourceFieldOption } from "../components/NodeInspector";
import { communicationTemplatePurposeForNode } from "../components/CommunicationTemplateSelector";
import WorkflowTemplateDrawer from "../components/WorkflowTemplateDrawer";
import WorkflowCanvas from "../components/WorkflowCanvas";
import type { FlowForgeIntegrationConfig, FlowForgeMatchingPolicy } from "../model/adminTypes";
import { freshIntegrationDraft, integrationProviders, type SourceEventDraft, type SourceFieldDraft } from "../model/integrationDrafts";
import { buildFieldOptions } from "../model/matchingPolicyBuilder";
import { savedQueryOptionsFromTreeData } from "../model/savedQueryOptions";
import {
  therapistRoutingStarterWorkflow,
} from "../model/starterWorkflows";
import type { FlowForgeEdge, FlowForgeNode, FlowForgeValidationResult, FlowForgeWorkflowAIDraft, FlowForgeWorkflowDefinition } from "../model/types";
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [workflowDeleteTarget, setWorkflowDeleteTarget] = useState<FlowForgeWorkflowDefinition | null>(null);
  const [aiOpen, setAiOpen] = useState(true);
  const [workflowsOpen, setWorkflowsOpen] = useState(false);
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [integrationDrawerMode, setIntegrationDrawerMode] = useState<FlowForgeIntegrationDrawerMode | null>(null);
  const [inlineIntegrationId, setInlineIntegrationId] = useState<number | null>(null);
  const [inlineCreatedIntegration, setInlineCreatedIntegration] = useState<FlowForgeIntegrationConfig | null>(null);
  const [inlineIntegrationSecret, setInlineIntegrationSecret] = useState<FlowForgeIntegrationSecret | null>(null);
  const inlineInitialDraft = freshIntegrationDraft();
  const [inlineProvider, setInlineProvider] = useState(inlineInitialDraft.provider);
  const [inlineIntegrationKey, setInlineIntegrationKey] = useState(inlineInitialDraft.integrationKey);
  const [inlineDisplayName, setInlineDisplayName] = useState(inlineInitialDraft.displayName);
  const [inlineMode, setInlineMode] = useState(inlineInitialDraft.mode);
  const [inlineWorkflowDefinitionId, setInlineWorkflowDefinitionId] = useState("");
  const [inlineWorkflowVersionId, setInlineWorkflowVersionId] = useState("");
  const [inlineSourceEvents, setInlineSourceEvents] = useState<SourceEventDraft[]>(inlineInitialDraft.sourceEvents);
  const [inlineSourceFields, setInlineSourceFields] = useState<SourceFieldDraft[]>(inlineInitialDraft.sourceFields);
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
    setHasUnsavedChanges(false);
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
  const inlineSelectedIntegration =
    integrations.find((integration) => integration.id === inlineIntegrationId) ??
    (inlineCreatedIntegration?.id === inlineIntegrationId ? inlineCreatedIntegration : null);
  const inlineActiveIntegrationId = integrationDrawerMode === "details" ? inlineIntegrationId : null;
  const inlineTriggersQuery = useQuery({
    queryKey: ["flowforge", "admin", "integration-triggers", inlineActiveIntegrationId],
    queryFn: () => listIntegrationTriggers(inlineActiveIntegrationId as number),
    enabled: Boolean(inlineActiveIntegrationId),
  });
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
    queryKey: ["flowforge", "communication-templates", "designer", selectedNodeTemplatePurpose],
    queryFn: () =>
      listFlowForgeCommunicationTemplates({
        status: "active",
        purpose: selectedNodeTemplatePurpose ?? undefined,
        channel: "email",
      }),
    enabled: Boolean(selectedNodeTemplatePurpose),
    placeholderData: [],
  });
  const compatibleCommunicationTemplates = useMemo(
    () =>
      (communicationTemplatesQuery.data ?? []).filter((template) => {
        if (template.status !== "active" || template.channel !== "email" || template.purpose !== selectedNodeTemplatePurpose) return false;
        if (!selectedNodeResourceSetId) return true;
        return !template.resource_set_id || template.resource_set_id === selectedNodeResourceSetId;
      }),
    [communicationTemplatesQuery.data, selectedNodeResourceSetId, selectedNodeTemplatePurpose],
  );
  const savedQueriesQuery = useQuery({
    queryKey: ["flowforge", "designer", "saved-query-options"],
    queryFn: hydrateQueryTree,
    enabled: selectedNode?.type === "query_extract",
    staleTime: 30_000,
  });
  const savedQueryOptions = useMemo(
    () => savedQueryOptionsFromTreeData(savedQueriesQuery.data),
    [savedQueriesQuery.data],
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

  const createInlineIntegrationMutation = useMutation({
    mutationFn: () =>
      createFlowForgeIntegration(inlineProvider, {
        integration_key: inlineIntegrationKey,
        display_name: inlineDisplayName,
        mode: inlineMode,
        source_events: inlineSourceEvents
          .map(({ event_key, display_name, description }) => ({
            event_key: event_key.trim(),
            display_name: display_name.trim() || event_key.trim(),
            description: description.trim() || null,
          }))
          .filter((event) => event.event_key),
        source_fields: inlineSourceFields
          .map(({ path, label, type, required, sensitive }) => ({
            path: path.trim(),
            label: label.trim() || path.trim(),
            type,
            required,
            sensitive,
          }))
          .filter((field) => field.path),
      }),
    onSuccess: async (created) => {
      setInlineCreatedIntegration(created);
      setInlineIntegrationId(created.id);
      setInlineIntegrationSecret(created.webhook_secret ? { integrationId: created.id, secret: created.webhook_secret } : null);
      setIntegrationDrawerMode("details");
      queryClient.setQueryData<FlowForgeIntegrationConfig[]>(["flowforge", "admin", "integrations"], (current) => {
        const existing = current ?? [];
        return [created, ...existing.filter((integration) => integration.id !== created.id)];
      });
      if (selectedNode && selectedNode.type === "intake") {
        const nextEvent = created.source_events[0]?.event_key ?? "";
        const nextData = {
          ...selectedNode.data,
          source: created.integration_key,
          event: nextEvent,
        };
        setDraftGraph((current) => ({
          ...current,
          nodes: current.nodes.map((node) => (node.id === selectedNode.id ? { ...node, data: nextData } : node)),
        }));
        setSelectedNode((current) => (current?.id === selectedNode.id ? { ...current, data: nextData } : current));
        setHasUnsavedChanges(true);
      }
      if (selectedNode && (selectedNode.type === "webhook_trigger" || selectedNode.type === "file_watch_trigger")) {
        const nextEvent = created.source_events[0]?.event_key ?? "";
        const nextData = {
          ...selectedNode.data,
          source_key: created.integration_key,
          event: nextEvent,
        };
        setDraftGraph((current) => ({
          ...current,
          nodes: current.nodes.map((node) => (node.id === selectedNode.id ? { ...node, data: nextData } : node)),
        }));
        setSelectedNode((current) => (current?.id === selectedNode.id ? { ...current, data: nextData } : current));
        setHasUnsavedChanges(true);
      }
      setSaveMessage("Integration created and selected locally. Save a draft version to persist workflow changes.");
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "integrations"] });
    },
  });

  const createInlineTriggerMutation = useMutation({
    mutationFn: () =>
      createIntegrationTrigger(inlineActiveIntegrationId as number, {
        trigger_key: `trigger-${Date.now()}`,
        display_name: "Start workflow",
        workflow_definition_id: Number(inlineWorkflowDefinitionId),
        workflow_version_id: inlineWorkflowVersionId ? Number(inlineWorkflowVersionId) : null,
        version_strategy: inlineWorkflowVersionId ? "pinned" : "latest_published",
        priority: 100,
        trigger_mode: "always",
        trigger_policy: "all_matching",
        no_match_config: {},
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["flowforge", "admin", "integration-triggers", inlineActiveIntegrationId] });
    },
  });

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
      setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(false);
      setSaveMessage("Draft version saved.");
      toast.success("Draft version saved.");
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflow-versions", persistedWorkflowDefinitionId] });
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflows"] });
    },
    onError: () => {
      toast.error("Draft version could not be saved.");
    },
  });

  const publishMutation = useMutation({
    mutationFn: (versionId: number) => publishFlowForgeWorkflowVersion(persistedWorkflowDefinitionId as number, versionId),
    onSuccess: () => {
      setSaveMessage("Workflow version published.");
      toast.success("Workflow version published.");
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflow-versions", persistedWorkflowDefinitionId] });
      void queryClient.invalidateQueries({ queryKey: ["flowforge", "workflows"] });
    },
    onError: () => {
      toast.error("Workflow version could not be published.");
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
      setHasUnsavedChanges(true);
      setSaveMessage("Workflow AI drafted workflow graph changes locally. Review, configure, and save a draft version.");
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
      setHasUnsavedChanges(false);
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
      description: "New workflow.",
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

  const applyInlineIntegrationDraft = (provider: "jotform" | "webhook" | "file_watch") => {
    const draft = freshIntegrationDraft(provider);
    setInlineProvider(draft.provider);
    setInlineIntegrationKey(draft.integrationKey);
    setInlineDisplayName(draft.displayName);
    setInlineMode(draft.mode);
    setInlineSourceEvents(draft.sourceEvents);
    setInlineSourceFields(draft.sourceFields);
  };

  const handleOpenInlineIntegrationCreate = (provider: "jotform" | "webhook" | "file_watch") => {
    applyInlineIntegrationDraft(provider);
    setInlineIntegrationId(null);
    setInlineCreatedIntegration(null);
    setInlineIntegrationSecret(null);
    setInlineWorkflowDefinitionId(persistedWorkflowDefinitionId ? String(persistedWorkflowDefinitionId) : "");
    setInlineWorkflowVersionId("");
    setIntegrationDrawerMode("create");
  };

  const handleInlineProviderChange = (provider: string) => {
    if (provider === "jotform" || provider === "file_watch") {
      applyInlineIntegrationDraft(provider);
      return;
    }
    applyInlineIntegrationDraft("webhook");
  };

  const handleCloseInlineIntegrationDrawer = () => {
    setIntegrationDrawerMode(null);
    setInlineIntegrationId(null);
  };

  const updateInlineSourceEvent = (id: string, patch: Partial<SourceEventDraft>) => {
    setInlineSourceEvents((current) => current.map((event) => (event.id === id ? { ...event, ...patch } : event)));
  };

  const updateInlineSourceField = (id: string, patch: Partial<SourceFieldDraft>) => {
    setInlineSourceFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };

  const handleNodeChange = (nodeId: string, patch: Partial<Pick<FlowForgeNode, "label" | "data">>) => {
    setDraftGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    }));
    setHasUnsavedChanges(true);
    setSaveMessage("Node updated locally. Save a draft version to persist it.");
  };

  const handleNodePositionChange = (nodeId: string, position: XYPosition) => {
    setDraftGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
    }));
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setConfigDrawerOpen(false);
    setHasUnsavedChanges(true);
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
    setConfigDrawerOpen(true);
    setSaveMessage("Connection selected. Configure its route, press Delete, or use Delete connection to remove it.");
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedEdgeId(null);
    setConfigDrawerOpen(false);
  }, []);

  const handleEdgeChange = useCallback((edgeId: string, patch: Partial<FlowForgeEdge>) => {
    setDraftGraph((current) => ({
      ...current,
      edges: current.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)),
    }));
    setHasUnsavedChanges(true);
    setSaveMessage("Connection route updated locally. Save a draft version to persist it.");
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
    setHasUnsavedChanges(true);
    setSaveMessage(`${element.label} added locally. Connect and save the workflow when ready.`);
  };

  const handleNodeApplySuccess = (message: string) => {
    setConfigDrawerOpen(false);
    setHasUnsavedChanges(true);
    setSaveMessage(message);
    toast.success(message);
  };

  const handleNodeApplyError = (message: string) => {
    setSaveMessage(message);
    toast.error(message);
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
      warnings: ["Graph contains a loop. Workflow Studio allows this, but runtime execution must use state-machine semantics."],
    },
  });

  const validation = validationQuery.data ?? { valid: true, errors: [], warnings: [] };
  const nodeValidationIssues = useMemo(() => buildNodeValidationIssues(validation), [validation]);
  const selectedNodeValidationIssues = selectedNode ? (nodeValidationIssues[selectedNode.id] ?? []) : [];
  const selectedEdge = selectedEdgeId ? draftGraph.edges.find((edge) => edge.id === selectedEdgeId) : undefined;
  const selectedEdgeSourceNode = selectedEdge ? draftGraph.nodes.find((node) => node.id === selectedEdge.source) : undefined;
  const selectedEdgeTargetNode = selectedEdge ? draftGraph.nodes.find((node) => node.id === selectedEdge.target) : undefined;
  const validationTone = !validation.valid ? "is-invalid" : validation.warnings.length ? "is-warning" : "is-valid";
  const versionSaveBlocked = !persistedWorkflowDefinitionId || saveVersionMutation.isPending;
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
        <div className="ff-canvas-panel" aria-label="Workflow Studio canvas">
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
            {!validation.valid && persistedWorkflowDefinitionId ? (
              <div className="small ff-muted">Invalid designs can be saved as draft versions, but only valid versions can be published.</div>
            ) : null}
            {validation.warnings.map((warning) => (
              <div key={warning} className="text-warning-emphasis small">
                {warning}
              </div>
            ))}
            {workflowsQuery.isError ? (
              <div className="small ff-muted">Workflows could not be loaded. You can still draft locally and create a saved workflow.</div>
            ) : null}
            {hasUnsavedChanges ? (
              <div className="ff-unsaved-state" role="status">
                <strong>Unsaved changes</strong>
                <span>Save a draft version to persist the current design.</span>
              </div>
            ) : null}
            {saveMessage ? <div className="small ff-save-message">{saveMessage}</div> : null}
            {selectedEdgeId && !configDrawerOpen ? (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => handleDeleteEdge(selectedEdgeId)}
              >
                Delete connection
              </button>
            ) : null}
            {createDraftMutation.isError || saveVersionMutation.isError || publishMutation.isError ? (
              <div className="text-danger small">Workflow authoring request failed. Check your Workflow Studio permissions and API logs.</div>
            ) : null}
            {workflowAiDraftMutation.isError ? (
              <div className="text-danger small">Workflow AI request failed. Check the workspace workflow LLM configuration.</div>
            ) : null}
            {deleteWorkflowMutation.isError ? (
              <div className="text-danger small">Workflow delete failed. Check your Workflow Studio permissions and API logs.</div>
            ) : null}
            {createInlineIntegrationMutation.isError || createInlineTriggerMutation.isError ? (
              <div className="text-danger small">Integration setup failed. Check your Workflow Studio permissions and API logs.</div>
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
        workflowNodes={draftGraph.nodes}
        intakeSourceFieldOptions={selectedIntakeSourceFieldOptions}
        resourceFieldOptions={resourceFieldOptions}
        resourceFieldsLoading={resourceRecordsQuery.isFetching}
        savedQueries={savedQueryOptions}
        savedQueriesLoading={savedQueriesQuery.isFetching}
        communicationTemplates={compatibleCommunicationTemplates}
        communicationTemplatesLoading={communicationTemplatesQuery.isFetching}
        communicationTemplateResourceSetId={selectedNodeResourceSetId}
        validationIssues={selectedNodeValidationIssues}
        onCreateIntegration={handleOpenInlineIntegrationCreate}
        onApplyError={handleNodeApplyError}
        onApplySuccess={handleNodeApplySuccess}
        onNodeChange={handleNodeChange}
        onClose={() => setConfigDrawerOpen(false)}
      />
      <EdgeConfigDrawer
        open={configDrawerOpen && Boolean(selectedEdge)}
        edge={selectedEdge}
        sourceNode={selectedEdgeSourceNode}
        targetNode={selectedEdgeTargetNode}
        editable
        onChange={handleEdgeChange}
        onDelete={handleDeleteEdge}
        onClose={() => setConfigDrawerOpen(false)}
      />
      {integrationDrawerMode ? (
        <FlowForgeIntegrationDrawer
          mode={integrationDrawerMode}
          integration={inlineSelectedIntegration}
          lastSecret={inlineIntegrationSecret}
          provider={inlineProvider}
          providerOptions={integrationProviders.filter((provider) => {
            if (selectedNode?.type === "intake") return provider.value === "jotform";
            if (selectedNode?.type === "webhook_trigger") return provider.value === "webhook";
            if (selectedNode?.type === "file_watch_trigger") return provider.value === "file_watch";
            return provider.value === "jotform" || provider.value === "webhook" || provider.value === "file_watch";
          })}
          triggers={inlineTriggersQuery.data ?? []}
          triggersLoading={inlineTriggersQuery.isLoading}
          workflowDefinitionId={inlineWorkflowDefinitionId}
          workflowVersionId={inlineWorkflowVersionId}
          integrationKey={inlineIntegrationKey}
          displayName={inlineDisplayName}
          integrationMode={inlineMode}
          sourceEvents={inlineSourceEvents}
          sourceFields={inlineSourceFields}
          createIntegrationPending={createInlineIntegrationMutation.isPending}
          createTriggerPending={createInlineTriggerMutation.isPending}
          onClose={handleCloseInlineIntegrationDrawer}
          onCreateIntegration={() => createInlineIntegrationMutation.mutate()}
          onCreateTrigger={() => createInlineTriggerMutation.mutate()}
          onSetWorkflowDefinitionId={setInlineWorkflowDefinitionId}
          onSetWorkflowVersionId={setInlineWorkflowVersionId}
          onSetIntegrationKey={setInlineIntegrationKey}
          onSetDisplayName={setInlineDisplayName}
          onSetProvider={handleInlineProviderChange}
          onSetMode={setInlineMode}
          onUpdateSourceEvent={updateInlineSourceEvent}
          onAddSourceEvent={() =>
            setInlineSourceEvents((current) => [...current, { id: `event-${Date.now()}`, event_key: "", display_name: "", description: "" }])
          }
          onRemoveSourceEvent={(id) => setInlineSourceEvents((current) => current.filter((entry) => entry.id !== id))}
          onUpdateSourceField={updateInlineSourceField}
          onAddSourceField={() =>
            setInlineSourceFields((current) => [...current, { id: `field-${Date.now()}`, path: "", label: "", type: "text", required: false, sensitive: false }])
          }
          onRemoveSourceField={(id) => setInlineSourceFields((current) => current.filter((entry) => entry.id !== id))}
        />
      ) : null}
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
