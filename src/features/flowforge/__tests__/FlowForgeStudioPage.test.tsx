import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { therapistRoutingStarterWorkflow } from "../model/starterWorkflows";
import type { FlowForgeCommunicationTemplate } from "../model/communicationTemplateTypes";
import type { FlowForgeWorkflowDefinition, FlowForgeWorkflowVersion } from "../model/types";
import { FLOWFORGE_ELEMENT_DND_MIME, FLOWFORGE_ELEMENTS } from "../model/workflowElements";
import FlowForgeStudioPage from "../ui/FlowForgeStudioPage";

const apiMocks = vi.hoisted(() => ({
  createFlowForgeIntegration: vi.fn(),
  createIntegrationTrigger: vi.fn(),
  createFlowForgeWorkflowAIDraft: vi.fn(),
  createFlowForgeWorkflowDraft: vi.fn(),
  createFlowForgeWorkflowVersion: vi.fn(),
  deleteFlowForgeWorkflow: vi.fn(),
  draftIntegrationWorkflowValueSchema: vi.fn(),
  getFlowForgeWorkflowPermissions: vi.fn(),
  getFlowForgeWorkflowReadiness: vi.fn(),
  getFlowForgeRunInspector: vi.fn(),
  hydrateQueryTree: vi.fn(),
  listFlowForgeIntegrations: vi.fn(),
  listIntegrationTriggers: vi.fn(),
  listFlowForgeWorkflowRunAsPrincipals: vi.fn(),
  listFlowForgeWorkflowVersions: vi.fn(),
  listFlowForgeWorkflows: vi.fn(),
  listFlowForgeMatchingPolicies: vi.fn(),
  listFlowForgeCommunicationTemplates: vi.fn(),
  listFlowForgeResourceRecords: vi.fn(),
  listFlowForgeResourceSets: vi.fn(),
  publishFlowForgeWorkflowVersion: vi.fn(),
  startFlowForgeWorkflowRun: vi.fn(),
  updateFlowForgeWorkflowMetadata: vi.fn(),
  updateFlowForgeWorkflowOwner: vi.fn(),
  updateFlowForgeWorkflowRunAs: vi.fn(),
  updateIntegrationWorkflowValueSchema: vi.fn(),
  validateFlowForgeGraph: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: toastMocks.error,
    success: toastMocks.success,
  },
}));

vi.mock("@xyflow/react", () => ({
  Background: () => <div data-testid="flow-background" />,
  Controls: () => <div data-testid="flow-controls" />,
  MarkerType: { ArrowClosed: "arrowclosed" },
  MiniMap: () => <div data-testid="flow-minimap" />,
  Position: { Left: "left", Right: "right" },
  ReactFlow: ({ nodes, edges, onNodeClick, onNodeDragStop, onEdgeClick, onNodesChange, onMoveEnd, onConnect, onDrop, onDragOver, children }: any) => (
    <div data-testid="react-flow" onDrop={onDrop} onDragOver={onDragOver}>
      {nodes.map((node: any) => (
        <div key={node.id}>
          <div role="button" tabIndex={0} aria-label={`Select ${node.data.nodeLabel}`} onClick={(event) => onNodeClick(event, node)}>
            {node.data.label}
          </div>
          <button
            type="button"
            aria-label={`Move ${node.id}`}
            onClick={() => {
              onNodesChange?.([
                {
                  id: node.id,
                  type: "position",
                  position: { x: 777, y: 333 },
                },
              ]);
              onNodeDragStop?.(undefined, node);
            }}
          >
            Move
          </button>
          <button
            type="button"
            aria-label={`Report current position ${node.id}`}
            onClick={() => {
              onNodesChange?.([
                {
                  id: node.id,
                  type: "position",
                  position: node.position,
                },
              ]);
            }}
          >
            Report current position
          </button>
        </div>
      ))}
      {edges.map((edge: any) => (
        <button
          key={edge.id}
          type="button"
          aria-label={`Select connection ${edge.id}`}
          onClick={(event) => onEdgeClick?.(event, edge)}
        >
          {edge.id}
        </button>
      ))}
      {nodes.length > 1 ? (
        <button
          type="button"
          aria-label="Connect first node to last node"
          onClick={() => onConnect?.({ source: nodes[0].id, target: nodes[nodes.length - 1].id })}
        >
          Connect first to last
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Zoom workflow canvas"
        onClick={() => onMoveEnd?.(undefined, { x: -220, y: -110, zoom: 0.62 })}
      >
        Zoom canvas
      </button>
      {children}
    </div>
  ),
}));

vi.mock("../api/workflowsApi", () => ({
  createFlowForgeWorkflowAIDraft: apiMocks.createFlowForgeWorkflowAIDraft,
  createFlowForgeWorkflowDraft: apiMocks.createFlowForgeWorkflowDraft,
  createFlowForgeWorkflowVersion: apiMocks.createFlowForgeWorkflowVersion,
  deleteFlowForgeWorkflow: apiMocks.deleteFlowForgeWorkflow,
  getFlowForgeWorkflowPermissions: apiMocks.getFlowForgeWorkflowPermissions,
  getFlowForgeWorkflowReadiness: apiMocks.getFlowForgeWorkflowReadiness,
  getFlowForgeRunInspector: apiMocks.getFlowForgeRunInspector,
  listFlowForgeWorkflowRunAsPrincipals: apiMocks.listFlowForgeWorkflowRunAsPrincipals,
  listFlowForgeWorkflowVersions: apiMocks.listFlowForgeWorkflowVersions,
  listFlowForgeWorkflows: apiMocks.listFlowForgeWorkflows,
  publishFlowForgeWorkflowVersion: apiMocks.publishFlowForgeWorkflowVersion,
  startFlowForgeWorkflowRun: apiMocks.startFlowForgeWorkflowRun,
  updateFlowForgeWorkflowMetadata: apiMocks.updateFlowForgeWorkflowMetadata,
  updateFlowForgeWorkflowOwner: apiMocks.updateFlowForgeWorkflowOwner,
  updateFlowForgeWorkflowRunAs: apiMocks.updateFlowForgeWorkflowRunAs,
  validateFlowForgeGraph: apiMocks.validateFlowForgeGraph,
}));

vi.mock("../api/adminApi", () => ({
  createFlowForgeIntegration: apiMocks.createFlowForgeIntegration,
  createIntegrationTrigger: apiMocks.createIntegrationTrigger,
  draftIntegrationWorkflowValueSchema: apiMocks.draftIntegrationWorkflowValueSchema,
  listFlowForgeIntegrations: apiMocks.listFlowForgeIntegrations,
  listIntegrationTriggers: apiMocks.listIntegrationTriggers,
  listFlowForgeMatchingPolicies: apiMocks.listFlowForgeMatchingPolicies,
  listFlowForgeResourceRecords: apiMocks.listFlowForgeResourceRecords,
  listFlowForgeResourceSets: apiMocks.listFlowForgeResourceSets,
  updateIntegrationWorkflowValueSchema: apiMocks.updateIntegrationWorkflowValueSchema,
}));

vi.mock("../api/communicationTemplatesApi", () => ({
  listFlowForgeCommunicationTemplates: apiMocks.listFlowForgeCommunicationTemplates,
}));

vi.mock("@/shared/services/queryTreeApi", () => ({
  hydrateQueryTree: apiMocks.hydrateQueryTree,
}));

const persistedWorkflow: FlowForgeWorkflowDefinition = {
  ...therapistRoutingStarterWorkflow,
  id: "42",
  name: "Persisted Therapist Routing",
  owner_user_id: "user-1",
  owner_display_name: "Taylor Jordan",
  lifecycle: "development",
  run_as_principal: { principal_type: "user", principal_id: "user-1", display_name: "Taylor Jordan" },
  effective_permissions: {
    permission: "owner",
    can_view: true,
    can_run: true,
    can_manage_runs: true,
    can_edit: true,
    can_manage: true,
    can_own: true,
  },
};

const persistedVersion: FlowForgeWorkflowVersion = {
  id: 7,
  workspace_id: "ws_test",
  workflow_definition_id: 42,
  version_number: 1,
  version_status: "draft",
  graph: persistedWorkflow.graph,
  validation_status: "valid",
  validation_result: { valid: true, errors: [], warnings: [] },
  matching_policy_refs: [],
  settings: {},
};

const publishedVersion: FlowForgeWorkflowVersion = {
  ...persistedVersion,
  id: 8,
  version_number: 2,
  version_status: "published",
  published_at: "2026-05-12T12:00:00Z",
};

function communicationTemplate(
  patch: Partial<FlowForgeCommunicationTemplate> & Pick<FlowForgeCommunicationTemplate, "id" | "template_key" | "display_name">,
): FlowForgeCommunicationTemplate {
  return {
    id: patch.id,
    workspace_id: "ws_test",
    template_key: patch.template_key,
    display_name: patch.display_name,
    description: patch.description ?? null,
    channel: patch.channel ?? "email",
    purpose: patch.purpose ?? "human_task",
    resource_set_id: patch.resource_set_id ?? null,
    subject: patch.subject ?? "Action requested",
    body_blocks: patch.body_blocks ?? [{ type: "text", content: "Please review this task." }],
    status: patch.status ?? "active",
    validation_status: patch.validation_status ?? "valid",
    validation_result: patch.validation_result ?? { valid: true, errors: [], warnings: [] },
    metadata: patch.metadata ?? {},
    created_at: patch.created_at ?? null,
    updated_at: patch.updated_at ?? null,
    activated_at: patch.activated_at ?? null,
  };
}

function workflowValueSchema(
  fields = [{ key: "values.patient.email", label: "Patient email", sourcePath: "email", type: "email" }],
) {
  const runtimeSourcePath = (path: string) => (path.startsWith("intake.") ? path : `intake.fields.${path}`);
  return {
    fields: fields.map((field) => {
      const schemaField = field as typeof field & {
        sourcePaths?: string[];
        transform?: string;
        separator?: string;
      };
      return {
        key: schemaField.key,
        label: schemaField.label,
        type: schemaField.type,
        required: false,
        sensitive: schemaField.type === "email",
        source_paths: (schemaField.sourcePaths ?? [schemaField.sourcePath]).map(runtimeSourcePath),
        transform: schemaField.transform ?? "copy",
        separator: schemaField.separator ?? " ",
        template: "",
        expose_to_templates: true,
      };
    }),
  };
}

function inputByLabel(name: RegExp) {
  const field = screen.getAllByLabelText(name).find((element) => element instanceof HTMLInputElement);
  expect(field).toBeDefined();
  return field as HTMLInputElement;
}

function selectByLabel(name: RegExp) {
  const field = screen.getAllByLabelText(name).find((element) => element instanceof HTMLSelectElement);
  expect(field).toBeDefined();
  return field as HTMLSelectElement;
}

function canvasNode(name: string): HTMLElement {
  return screen.getByRole("button", { name: `Select ${name}` });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FlowForgeStudioPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FlowForgeStudioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.hydrateQueryTree.mockResolvedValue({
      trees: {
        library: { view: "library", rootNodes: [] },
        shared: {
          view: "shared",
          rootNodes: [
            {
              nodeType: "query",
              id: "saved-shared-1",
              name: "Shared Referral Extract",
              updatedAt: "2026-05-07T12:00:00Z",
              queryType: "query_builder",
            },
          ],
        },
        my: {
          view: "my",
          rootNodes: [
            {
              nodeType: "query",
              id: "saved-1",
              name: "Therapist Intake Extract",
              updatedAt: "2026-05-07T11:00:00Z",
              queryType: "query_builder",
            },
          ],
        },
        trash: { view: "trash", rootNodes: [] },
      },
      recent: [
        {
          id: "saved-recent-1",
          title: "Recent Assignment Extract",
          updatedAt: "2026-05-07T10:00:00Z",
          queryType: "query_builder",
        },
      ],
    });
    apiMocks.createFlowForgeIntegration.mockResolvedValue({
      id: 404,
      workspace_id: "ws_test",
      provider: "file_watch",
      integration_key: "file-watch-source",
      display_name: "File Watch Source",
      external_form_id: null,
      enabled: true,
      mode: "test",
      webhook_public_id: "public-file-watch-1",
      webhook_path: null,
      webhook_url: null,
      webhook_secret: null,
      field_mapping: {},
      source_events: [{ event_key: "file_created", display_name: "File Created", description: "New file appears." }],
      source_fields: [{ path: "file.name", label: "File Name", type: "text", required: true, sensitive: false }],
      workflow_value_schema: workflowValueSchema([{ key: "values.file.name", label: "File Name", sourcePath: "file.name", type: "text" }]),
      test_recipient_overrides: [],
      settings: {},
    });
    apiMocks.listIntegrationTriggers.mockResolvedValue([]);
    apiMocks.draftIntegrationWorkflowValueSchema.mockResolvedValue(workflowValueSchema([
      { key: "values.patient.email", label: "Patient Email", sourcePath: "email", type: "email" },
      {
        key: "values.patient.full_name",
        label: "Patient Full Name",
        sourcePath: "firstName",
        sourcePaths: ["firstName", "lastName"],
        type: "text",
        transform: "concat",
        separator: " ",
      },
      { key: "values.intake.requested_service", label: "Requested Service", sourcePath: "serviceRequested", type: "text" },
    ]));
    apiMocks.updateIntegrationWorkflowValueSchema.mockImplementation(async (_integrationId: number, schema: any) => ({
      id: 401,
      workspace_id: "ws_test",
      provider: "jotform",
      integration_key: "jotform-intake",
      display_name: "Jotform Intake",
      external_form_id: "form-1",
      enabled: true,
      mode: "test",
      webhook_public_id: "public-1",
      webhook_path: "/webhooks/flowforge/public-1",
      webhook_url: "http://localhost/webhooks/flowforge/public-1",
      webhook_secret: null,
      field_mapping: {},
      source_events: [],
      source_fields: [],
      workflow_value_schema: schema,
      test_recipient_overrides: [],
      settings: {},
    }));
    apiMocks.validateFlowForgeGraph.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: ["Graph contains a loop. Workflow Studio allows this, but runtime execution must use state-machine semantics."],
    });
    apiMocks.listFlowForgeWorkflowRunAsPrincipals.mockResolvedValue({
      workspace_id: "ws_test",
      items: [
        {
          principal_type: "user",
          principal_id: "user-1",
          display_name: "Current User",
          description: "Signed-in user",
          status: "active",
          production_eligible: false,
        },
        {
          principal_type: "workspace_principal",
          principal_id: "ws_test",
          display_name: "Workspace Principal",
          description: "Workspace-managed automation identity",
          status: "active",
          production_eligible: true,
        },
      ],
    });
    apiMocks.getFlowForgeWorkflowPermissions.mockResolvedValue({
      workflow_definition_id: 42,
      items: [
        {
          id: 1,
          principal_type: "user",
          principal_id: "user-1",
          permission: "owner",
          granted_by: "system",
          granted_at: "2026-05-09T12:00:00Z",
        },
      ],
    });
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([]);
    apiMocks.listFlowForgeIntegrations.mockResolvedValue([
      {
        id: 401,
        workspace_id: "ws_test",
        provider: "jotform",
        integration_key: "jotform-intake",
        display_name: "Jotform Intake",
        external_form_id: "form-1",
        enabled: true,
        mode: "test",
        webhook_public_id: "public-1",
        webhook_path: "/webhooks/flowforge/public-1",
        webhook_url: "http://localhost/webhooks/flowforge/public-1",
        webhook_secret: null,
        field_mapping: {},
        source_events: [
          { event_key: "intake_submitted", display_name: "Intake Submitted", description: "New intake form submission." },
          { event_key: "intake_updated", display_name: "Intake Updated", description: null },
        ],
        source_fields: [
          { path: "email", label: "Email Address", type: "email", required: true, sensitive: true },
          { path: "firstName", label: "First Name", type: "text", required: true, sensitive: true },
          { path: "lastName", label: "Last Name", type: "text", required: true, sensitive: true },
          { path: "serviceRequested", label: "Requested Service", type: "text", required: true, sensitive: false },
          { path: "summary", label: "Clinical Summary", type: "text", required: false, sensitive: true },
        ],
        workflow_value_schema: workflowValueSchema([
          { key: "values.patient.email", label: "Patient Email", sourcePath: "email", type: "email" },
          { key: "values.intake.requested_service", label: "Requested Service", sourcePath: "serviceRequested", type: "text" },
          { key: "values.intake.clinical_summary", label: "Clinical Summary", sourcePath: "summary", type: "text" },
        ]),
        test_recipient_overrides: [],
        settings: {},
      },
      {
        id: 402,
        workspace_id: "ws_test",
        provider: "webhook",
        integration_key: "webhook-intake",
        display_name: "Webhook Intake",
        external_form_id: null,
        enabled: true,
        mode: "production",
        webhook_public_id: "public-webhook-1",
        webhook_path: "/webhooks/generic/public-webhook-1",
        webhook_url: "http://localhost/webhooks/generic/public-webhook-1",
        webhook_secret: null,
        field_mapping: {},
        source_events: [
          { event_key: "webhook_received", display_name: "Webhook Received", description: "Generic webhook delivery." },
          { event_key: "patient_intake_created", display_name: "Patient Intake Created", description: "New intake payload." },
        ],
        source_fields: [
          { path: "event_key", label: "Event Type", type: "text", required: true, sensitive: false },
          { path: "payload.patient_name", label: "Patient Name", type: "text", required: false, sensitive: true },
        ],
        workflow_value_schema: workflowValueSchema([{ key: "values.patient.full_name", label: "Patient Name", sourcePath: "payload.patient_name", type: "text" }]),
        test_recipient_overrides: [],
        settings: {},
      },
      {
        id: 403,
        workspace_id: "ws_test",
        provider: "file_watch",
        integration_key: "sftp-dropbox",
        display_name: "SFTP Dropbox",
        external_form_id: null,
        enabled: true,
        mode: "production",
        webhook_public_id: "public-file-watch-1",
        webhook_path: null,
        webhook_url: null,
        webhook_secret: null,
        field_mapping: {},
        source_events: [
          { event_key: "file_created", display_name: "File Created", description: "New file appears." },
          { event_key: "file_updated", display_name: "File Updated", description: "Watched file changes." },
        ],
        source_fields: [
          { path: "file.name", label: "File Name", type: "text", required: true, sensitive: false },
          { path: "file.path", label: "File Path", type: "text", required: true, sensitive: false },
        ],
        workflow_value_schema: workflowValueSchema([{ key: "values.file.name", label: "File Name", sourcePath: "file.name", type: "text" }]),
        test_recipient_overrides: [],
        settings: {},
      },
    ]);
    apiMocks.listFlowForgeMatchingPolicies.mockResolvedValue([
      {
        id: 50,
        workspace_id: "ws_test",
        policy_key: "therapist-routing",
        display_name: "Therapist Routing Policy",
        description: "Published therapist matching rules.",
        resource_set_id: 30,
        status: "active",
        current_draft_version_id: 51,
        latest_published_version_id: 52,
      },
    ]);
    apiMocks.listFlowForgeResourceSets.mockResolvedValue([
      {
        id: 30,
        workspace_id: "ws_test",
        resource_set_key: "therapists",
        display_name: "Therapist Pool",
        description: "Active therapist resources.",
        source_type: "manual",
        enabled: true,
        active_snapshot_batch_id: 300,
        settings: {},
      },
    ]);
    apiMocks.listFlowForgeResourceRecords.mockResolvedValue({
      resource_set_id: 30,
      limit: 100,
      offset: 0,
      records: [
        {
          id: 300,
          workspace_id: "ws_test",
          resource_set_id: 30,
          source_record_key: "therapist-1",
          display_name: "Dr. Lane",
          primary_email: "lane@example.com",
          primary_phone: null,
          status: "active",
          effective_status: "active",
          availability_status: "available",
          capacity_total: 10,
          capacity_used: 4,
          capacity_available: 6,
          current_load: 4,
          service_area: "north",
          timezone: "America/Chicago",
          source_missing: false,
          tags: ["anxiety", "spanish"],
          validation_status: "valid",
          validation_errors: [],
          attributes: { specialty: "anxiety", accepts_telehealth: true },
          normalized_profile: { languages: ["English", "Spanish"] },
        },
      ],
    });
    apiMocks.listFlowForgeCommunicationTemplates.mockResolvedValue([
      communicationTemplate({
        id: 901,
        template_key: "flowforge.generic-human-task",
        display_name: "Generic Human Task",
        resource_set_id: null,
      }),
      communicationTemplate({
        id: 902,
        template_key: "flowforge.therapist-human-task",
        display_name: "Therapist Human Task",
        resource_set_id: 30,
      }),
      communicationTemplate({
        id: 903,
        template_key: "flowforge.other-resource-human-task",
        display_name: "Other Resource Human Task",
        resource_set_id: 31,
      }),
      communicationTemplate({
        id: 904,
        template_key: "flowforge.ops-alert",
        display_name: "Operations Alert",
        purpose: "notification",
        resource_set_id: null,
      }),
    ]);
    apiMocks.createFlowForgeWorkflowDraft.mockResolvedValue({
      ...therapistRoutingStarterWorkflow,
      id: "42",
      status: "draft",
    });
    apiMocks.createFlowForgeWorkflowAIDraft.mockImplementation(async ({ prompt, graph }: { prompt: string; graph: FlowForgeWorkflowDefinition["graph"] }) => {
      const lowerPrompt = prompt.toLowerCase();
      const nextNode =
        lowerPrompt.includes("schedule")
          ? {
              id: "schedule-ai",
              type: "schedule_trigger",
              label: "Schedule Trigger",
              position: { x: 1120, y: 120 },
              data: { rrule: "FREQ=DAILY;INTERVAL=1", mode: "test" },
            }
          : {
              id: "approval-ai",
              type: "approval",
              label: "Approval Gate",
              position: { x: 1120, y: 120 },
              data: { approver_role: "flowforge:operator", timeout_minutes: 1440 },
            };
      return {
        prompt,
        graph: {
          nodes: [...graph.nodes, nextNode],
          edges: [...graph.edges, { id: `${graph.nodes.at(-1)?.id ?? "start"}-${nextNode.id}`, source: graph.nodes.at(-1)?.id ?? "start", target: nextNode.id }],
        },
        plain_language_summary: `FlowForge AI added ${nextNode.label} to the workflow graph.`,
        validation_status: "valid",
        validation_result: { valid: true, errors: [], warnings: [] },
        model_provider: "openai",
        model_name: "workflow-drafter",
        draft_source: "llm",
      };
    });
    apiMocks.createFlowForgeWorkflowVersion.mockResolvedValue(persistedVersion);
    apiMocks.deleteFlowForgeWorkflow.mockResolvedValue({ deleted: true, workflow_definition_id: 42 });
    apiMocks.getFlowForgeWorkflowReadiness.mockResolvedValue({
      workflow_definition_id: 42,
      status: "needs_publish",
      can_publish: true,
      can_run: false,
      latest_valid_draft_version_id: 7,
      latest_published_version_id: null,
      blockers: [],
      warnings: [
        {
          code: "published_version_required",
          message: "Publish a valid workflow version before runtime execution.",
          severity: "warning",
        },
      ],
      steps: [
        {
          id: "draft_saved",
          label: "Draft saved",
          state: "complete",
          detail: "Valid draft version 1 is saved.",
        },
        {
          id: "graph_validated",
          label: "Graph validated",
          state: "complete",
          detail: "Validation passed for the persisted graph.",
        },
        {
          id: "version_published",
          label: "Version published",
          state: "current",
          detail: "Publish a valid version to make runtime deterministic.",
        },
        {
          id: "run_started",
          label: "Run started",
          state: "blocked",
          detail: "A published version is required before runtime.",
        },
        {
          id: "inspect_report",
          label: "Inspect and report",
          state: "blocked",
          detail: "Run inspection and reporting are available after a run starts.",
        },
      ],
    });
    apiMocks.publishFlowForgeWorkflowVersion.mockResolvedValue({
      ...persistedVersion,
      version_status: "published",
    });
    apiMocks.updateFlowForgeWorkflowOwner.mockImplementation(async (_workflowId: number, ownerUserId: string) => ({
      ...persistedWorkflow,
      owner_user_id: ownerUserId,
    }));
    apiMocks.updateFlowForgeWorkflowMetadata.mockImplementation(
      async (_workflowId: number, payload: { name: string; description?: string }) => ({
        ...persistedWorkflow,
        name: payload.name,
        description: payload.description ?? persistedWorkflow.description,
      }),
    );
    apiMocks.updateFlowForgeWorkflowRunAs.mockImplementation(async (_workflowId: number, principal: { principal_type: string; principal_id: string }) => ({
      ...persistedWorkflow,
      run_as_principal: principal,
    }));
    apiMocks.startFlowForgeWorkflowRun.mockResolvedValue({
      run_id: 901,
      workflow_definition_id: 42,
      workflow_version_id: 7,
      status: "queued",
      mode: "test",
      current_node_id: "intake",
      idempotency_key: "manual-901",
      created: true,
    });
  });

  it("renders a saved workflow and loop warning", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Persisted Therapist Routing" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Workflow Studio designer tools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft version" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open workflows" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Workflow element palette" })).toBeInTheDocument();
    expect(screen.getAllByText("Manual Start").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Patient Intake").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("flow-minimap")).not.toBeInTheDocument();
    expect(apiMocks.getFlowForgeRunInspector).not.toHaveBeenCalled();
    const intakeCanvasNode = canvasNode("Patient Intake");
    expect(intakeCanvasNode.querySelector(".ff-node-icon .fa-inbox")).not.toBeNull();
    expect(screen.getByText("Request Response")).toBeInTheDocument();
    expect(screen.getByText(/valid with warnings/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime execution must use state-machine semantics/i)).toBeInTheDocument();
  });

  it("opens plain-language Manual Start guidance from the workflow palette", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Open Manual Start guide" }));

    const guide = screen.getByRole("complementary", { name: "Manual Start guide" });
    expect(within(guide).getByRole("heading", { name: "Manual Start" })).toBeInTheDocument();
    expect(within(guide).getByText(/begin only after a person decides it is time to run it/i)).toBeInTheDocument();
    expect(within(guide).getByRole("heading", { name: "What It Needs" })).toBeInTheDocument();
    expect(within(guide).getByText("A person clicks Run now")).toBeInTheDocument();
    expect(within(guide).getByRole("heading", { name: "What It Passes On" })).toBeInTheDocument();
    expect(within(guide).getByText("A new workflow run")).toBeInTheDocument();
    expect(within(guide).getByText("Try a new workflow safely")).toBeInTheDocument();

    await userEvent.click(within(guide).getByRole("button", { name: "Close workflow guide" }));
    expect(screen.queryByRole("complementary", { name: "Manual Start guide" })).not.toBeInTheDocument();
  });

  it("opens workflow governance settings and updates owner and run-as identity", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Persisted Therapist Routing" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));

    const dialog = await screen.findByRole("dialog", { name: "Workflow settings" });
    expect(within(dialog).getByText("development")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Taylor Jordan (user)").length).toBeGreaterThan(0);
    await waitFor(() => expect(within(dialog).getAllByText("owner").length).toBeGreaterThan(0));

    const nameInput = within(dialog).getByLabelText("Workflow name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Renamed Therapist Routing");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save details" }));

    await waitFor(() => {
      expect(apiMocks.updateFlowForgeWorkflowMetadata).toHaveBeenCalledWith(42, {
        name: "Renamed Therapist Routing",
        description: persistedWorkflow.description,
      });
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Workflow details updated.");

    const ownerInput = within(dialog).getByLabelText("Owner user id");
    await userEvent.clear(ownerInput);
    await userEvent.type(ownerInput, "user-2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save owner" }));

    await waitFor(() => {
      expect(apiMocks.updateFlowForgeWorkflowOwner).toHaveBeenCalledWith(42, "user-2");
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Workflow owner updated.");

    await userEvent.selectOptions(within(dialog).getByLabelText("Principal"), "workspace_principal:ws_test");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save run as" }));

    await waitFor(() => {
      expect(apiMocks.updateFlowForgeWorkflowRunAs).toHaveBeenCalledWith(42, {
        principal_type: "workspace_principal",
        principal_id: "ws_test",
      });
    });
  });

  it("starts a manual run from the workflow toolbar", async () => {
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([publishedVersion]);
    apiMocks.getFlowForgeWorkflowReadiness.mockResolvedValue({
      workflow_definition_id: 42,
      status: "ready",
      can_publish: false,
      can_run: true,
      latest_valid_draft_version_id: null,
      latest_published_version_id: 8,
      blockers: [],
      warnings: [],
      steps: [
        { id: "draft_saved", label: "Draft saved", state: "complete", detail: "A published version is persisted." },
        { id: "graph_validated", label: "Graph validated", state: "complete", detail: "Validation passed for the persisted graph." },
        { id: "version_published", label: "Version published", state: "complete", detail: "Published version 2 is available for runtime." },
        { id: "run_started", label: "Run started", state: "current", detail: "Start a run from the latest published version." },
        { id: "inspect_report", label: "Inspect and report", state: "blocked", detail: "Run inspection and reporting are available after a run starts." },
      ],
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Persisted Therapist Routing" })).toBeInTheDocument();
    expect(screen.getByText("Runnable")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Run now" }));

    await waitFor(() => {
      expect(apiMocks.startFlowForgeWorkflowRun).toHaveBeenCalledWith(42, { mode: "test" });
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Workflow run 901 started.");
    expect(await screen.findByText("Run 901 started from the published workflow.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inspect run" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open reports" })).toBeEnabled();
  });

  it("does not mark a saved workflow unsaved for no-op canvas viewport events", async () => {
    const graphWithSavedViewport = {
      ...persistedWorkflow.graph,
      viewport: { x: -220, y: -110, zoom: 0.62 },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([{ ...persistedWorkflow, graph: graphWithSavedViewport }]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...publishedVersion, graph: graphWithSavedViewport }]);
    apiMocks.getFlowForgeWorkflowReadiness.mockResolvedValue({
      workflow_definition_id: 42,
      status: "ready",
      can_publish: false,
      can_run: true,
      latest_valid_draft_version_id: null,
      latest_published_version_id: 8,
      blockers: [],
      warnings: [],
      steps: [
        { id: "draft_saved", label: "Draft saved", state: "complete", detail: "A published version is persisted." },
        { id: "graph_validated", label: "Graph validated", state: "complete", detail: "Validation passed for the persisted graph." },
        { id: "version_published", label: "Version published", state: "complete", detail: "Published version 2 is available for runtime." },
        { id: "run_started", label: "Run started", state: "current", detail: "Start a run from the latest published version." },
        { id: "inspect_report", label: "Inspect and report", state: "blocked", detail: "Run inspection and reporting are available after a run starts." },
      ],
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Persisted Therapist Routing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Zoom workflow canvas" }));

    expect(screen.queryByText("Save or discard local changes before running; runtime uses the latest published version.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeEnabled();
  });

  it("keeps a saved workflow runnable after canvas viewport changes", async () => {
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([publishedVersion]);
    apiMocks.getFlowForgeWorkflowReadiness.mockResolvedValue({
      workflow_definition_id: 42,
      status: "ready",
      can_publish: false,
      can_run: true,
      latest_valid_draft_version_id: null,
      latest_published_version_id: 8,
      blockers: [],
      warnings: [],
      steps: [
        { id: "draft_saved", label: "Draft saved", state: "complete", detail: "A published version is persisted." },
        { id: "graph_validated", label: "Graph validated", state: "complete", detail: "Validation passed for the persisted graph." },
        { id: "version_published", label: "Version published", state: "complete", detail: "Published version 2 is available for runtime." },
        { id: "run_started", label: "Run started", state: "current", detail: "Start a run from the latest published version." },
        { id: "inspect_report", label: "Inspect and report", state: "blocked", detail: "Run inspection and reporting are available after a run starts." },
      ],
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Persisted Therapist Routing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Zoom workflow canvas" }));

    expect(screen.queryByText("Save or discard local changes before running; runtime uses the latest published version.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Run now" }));

    await waitFor(() => {
      expect(apiMocks.startFlowForgeWorkflowRun).toHaveBeenCalledWith(42, { mode: "test" });
    });
  });

  it("does not mark a saved workflow unsaved for no-op node position events", async () => {
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([publishedVersion]);
    apiMocks.getFlowForgeWorkflowReadiness.mockResolvedValue({
      workflow_definition_id: 42,
      status: "ready",
      can_publish: false,
      can_run: true,
      latest_valid_draft_version_id: null,
      latest_published_version_id: 8,
      blockers: [],
      warnings: [],
      steps: [
        { id: "draft_saved", label: "Draft saved", state: "complete", detail: "A published version is persisted." },
        { id: "graph_validated", label: "Graph validated", state: "complete", detail: "Validation passed for the persisted graph." },
        { id: "version_published", label: "Version published", state: "complete", detail: "Published version 2 is available for runtime." },
        { id: "run_started", label: "Run started", state: "current", detail: "Start a run from the latest published version." },
        { id: "inspect_report", label: "Inspect and report", state: "blocked", detail: "Run inspection and reporting are available after a run starts." },
      ],
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Persisted Therapist Routing" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Report current position intake" }));

    expect(screen.queryByText("Save or discard local changes before running; runtime uses the latest published version.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeEnabled();
  });

  it("keeps run inspection available from backend readiness after reload", async () => {
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([publishedVersion]);
    apiMocks.getFlowForgeWorkflowReadiness.mockResolvedValue({
      workflow_definition_id: 42,
      status: "ready",
      can_publish: false,
      can_run: true,
      latest_valid_draft_version_id: null,
      latest_published_version_id: 8,
      latest_run_id: 90,
      latest_run_status: "waiting",
      latest_run_mode: "test",
      blockers: [],
      warnings: [],
      steps: [
        { id: "draft_saved", label: "Draft saved", state: "complete", detail: "A published version is persisted." },
        { id: "graph_validated", label: "Graph validated", state: "complete", detail: "Validation passed for the persisted graph." },
        { id: "version_published", label: "Version published", state: "complete", detail: "Published version 2 is available for runtime." },
        { id: "run_started", label: "Run started", state: "complete", detail: "Run 90 started from the published workflow." },
        { id: "inspect_report", label: "Inspect and report", state: "current", detail: "Run 90 is available for inspection and reporting." },
      ],
    });
    renderPage();

    expect(await screen.findByText("Run 90 started from the published workflow.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inspect run" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open reports" })).toBeEnabled();
  });

  it("blocks manual runs when local draft changes are unsaved", async () => {
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([publishedVersion]);
    apiMocks.getFlowForgeWorkflowReadiness.mockResolvedValue({
      workflow_definition_id: 42,
      status: "ready",
      can_publish: false,
      can_run: true,
      latest_valid_draft_version_id: null,
      latest_published_version_id: 8,
      blockers: [],
      warnings: [],
      steps: [
        { id: "draft_saved", label: "Draft saved", state: "complete", detail: "A published version is persisted." },
        { id: "graph_validated", label: "Graph validated", state: "complete", detail: "Validation passed for the persisted graph." },
        { id: "version_published", label: "Version published", state: "complete", detail: "Published version 2 is available for runtime." },
        { id: "run_started", label: "Run started", state: "current", detail: "Start a run from the latest published version." },
        { id: "inspect_report", label: "Inspect and report", state: "blocked", detail: "Run inspection and reporting are available after a run starts." },
      ],
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Persisted Therapist Routing" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", {
      name: /Decision\. Branches the workflow based on response or state\./i,
    }));

    expect(screen.getByText("Save or discard local changes before running; runtime uses the latest published version.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run now" })).toBeDisabled();
  });

  it("gates workflow editing controls from effective permissions", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([
      {
        ...persistedWorkflow,
        effective_permissions: {
          permission: "view",
          can_view: true,
          can_run: false,
          can_manage_runs: false,
          can_edit: false,
          can_manage: false,
          can_own: false,
        },
      },
    ]);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Persisted Therapist Routing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run now" })).toBeDisabled();
    expect(screen.getByText("You can view this workflow, but editing controls are disabled.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", {
      name: /Decision\. Branches the workflow based on response or state\./i,
    }));
    expect(toastMocks.error).toHaveBeenCalledWith("You do not have permission to edit this workflow.");
  });

  it("blocks production publish when run-as is not a service or workspace principal", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([
      {
        ...persistedWorkflow,
        lifecycle: "production",
        run_as_principal: { principal_type: "user", principal_id: "user-1" },
      },
    ]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Open workflows" }));

    expect(screen.getByText("Production workflows must run as a workspace or service principal before publishing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Workflow options" }));
    expect(screen.getByRole("button", { name: "Publish workflow" })).toBeDisabled();
    expect(apiMocks.publishFlowForgeWorkflowVersion).not.toHaveBeenCalled();
  });

  it("starts with a local draft when there are no saved workflows", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("heading", { name: "New workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New from scratch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New from template" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open workflows" }));
    expect(screen.getByText(/No saved workflows yet/i)).toBeInTheDocument();
  });

  it("saves a local invalid workflow as the first persisted draft", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([]);
    apiMocks.validateFlowForgeGraph.mockResolvedValue({
      valid: false,
      errors: ["Graph must contain at least one node."],
      warnings: [],
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "New workflow" })).toBeInTheDocument();
    expect(await screen.findByText("Invalid graph")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft version" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowDraft).toHaveBeenCalled();
    });
    const [payload] = apiMocks.createFlowForgeWorkflowDraft.mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({
        name: "New workflow",
        graph: expect.objectContaining({
          nodes: [expect.objectContaining({ id: "start", type: "manual_start" })],
          edges: [],
        }),
      }),
    );
    expect(payload.workflow_key).toMatch(/^new-workflow-/);
    expect(apiMocks.createFlowForgeWorkflowVersion).not.toHaveBeenCalled();
  });

  it("marks canvas nodes and inspector details when catalog validation fails", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    apiMocks.validateFlowForgeGraph.mockResolvedValue({
      valid: false,
      errors: ["Intake node 'intake' references unknown source integration 'legacy-jotform'."],
      warnings: [],
    });
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    expect(await screen.findByText("Invalid graph")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft version" })).toBeEnabled();
    expect(screen.getByText("Invalid designs can be saved as draft versions, but only valid versions can be published.")).toBeInTheDocument();
    expect(screen.getByLabelText("Patient Intake has validation errors")).toBeInTheDocument();

    await userEvent.click(canvasNode("Patient Intake"));

    expect(screen.getByRole("complementary", { name: "Node inspector" })).toBeInTheDocument();
    expect(screen.getByLabelText("Selected node validation")).toHaveTextContent(
      "Intake node 'intake' references unknown source integration 'legacy-jotform'.",
    );

    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));
    await waitFor(() => expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(42, expect.any(Object)));
  });

  it("opens workflow selection from the vertical designer rail", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    expect(screen.getByRole("complementary", { name: "Workflow Studio designer tools" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open workflows" }));

    expect(screen.getByRole("heading", { name: "Open Workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Persisted Therapist Routing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workflow options" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Workflow options" }));
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("adds workflow elements from the left palette", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    expect(
      screen.getByRole("button", {
        name: /Matching\. Runs a published matching policy against a resource pool and branches on matched or no match\./i,
      }),
    ).toBeInTheDocument();
    const decisionElement = screen.getByRole("button", {
      name: /Decision\. Branches the workflow based on response or state\./i,
    });
    expect(decisionElement).toHaveAttribute(
      "title",
      "Decision: Branches the workflow based on response or state.",
    );
    await userEvent.click(decisionElement);

    expect(await screen.findByRole("heading", { name: "Decision" })).toBeInTheDocument();
    expect(screen.getAllByText("decision").length).toBeGreaterThan(0);
    expect(screen.getByText(/Decision added locally/i)).toBeInTheDocument();
  });

  it("adds and configures notification workflow elements", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    const notificationElement = screen.getByRole("button", {
      name: /Notification\. Queues an email notification from an active communication template\./i,
    });
    expect(notificationElement).toHaveAttribute(
      "title",
      "Notification: Queues an email notification from an active communication template.",
    );
    await userEvent.click(notificationElement);
    await userEvent.click(await screen.findByRole("button", { name: "Select Notification" }));

    expect(await screen.findByRole("heading", { name: "Notification" })).toBeInTheDocument();
    expect(screen.getAllByText("notification").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^Recipients/i)).toHaveValue("");
    expect(screen.getByText(/one or more email recipients/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Notification reason/i)).toHaveValue("");
    expect(screen.getByRole("option", { name: /Operations Alert \(generic\)/i })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^Recipients/i), "ops@example.com, lead@example.com");
    await userEvent.type(screen.getByLabelText(/^Notification reason/i), "Route needs operator review.");
    await userEvent.selectOptions(selectByLabel(/Communication template/i), "flowforge.ops-alert");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                type: "notification",
                data: expect.objectContaining({
                  recipients: ["ops@example.com", "lead@example.com"],
                  reason: "Route needs operator review.",
                  communication_template_key: "flowforge.ops-alert",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("adds data movement workflow elements from the palette", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    const extractElement = screen.getByRole("button", {
      name: /Query Extract\. Runs a governed saved query or semantic plan and produces a dataset artifact\./i,
    });
    expect(extractElement).toHaveAttribute(
      "title",
      "Query Extract: Runs a governed saved query or semantic plan and produces a dataset artifact.",
    );
    await userEvent.click(extractElement);

    expect(await screen.findByRole("heading", { name: "Query Extract" })).toBeInTheDocument();
    expect(screen.getAllByText("query extract").length).toBeGreaterThan(0);
    expect(await screen.findByRole("option", { name: /Therapist Intake Extract \(Mine\)/i })).toBeInTheDocument();
    expect(selectByLabel(/^Saved query/i)).toHaveValue("");
    expect(selectByLabel(/^Row limit mode/i)).toHaveValue("default");
    expect(screen.getByText(/Leave blank to use the default/i)).toBeInTheDocument();

    const importElement = screen.getByRole("button", {
      name: /Import\. Stages inbound data for validation before activation or publish\./i,
    });
    await userEvent.click(importElement);
    expect(await screen.findByRole("heading", { name: "Import" })).toBeInTheDocument();
    expect(inputByLabel(/^source key/i)).toHaveValue("");
    expect(inputByLabel(/^filename/i)).toHaveValue("");
    expect(inputByLabel(/^Resource set id/i)).toHaveValue(null);
    expect(inputByLabel(/^Activate after validation/i)).not.toBeChecked();

    const mapElement = screen.getByRole("button", {
      name: /Map \/ Transform\. Maps fields, validates rows, and normalizes values before side effects\./i,
    });
    await userEvent.click(mapElement);
    expect(await screen.findByRole("heading", { name: "Map / Transform" })).toBeInTheDocument();
    expect(screen.getByText("Workflow Value Mapper")).toBeInTheDocument();
    expect(screen.getByText(/No workflow value schema yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add mapping/i })).toBeDisabled();
    expect(screen.getByText(/Select an intake integration with source fields before mapping workflow data/i)).toBeInTheDocument();
  });

  it("adds workflow elements by dropping palette payloads onto the canvas", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    const element = FLOWFORGE_ELEMENTS.find((item) => item.type === "matching");
    expect(element).toBeDefined();
    const matchingElement = screen.getByRole("button", {
      name: /Matching\. Runs a published matching policy against a resource pool and branches on matched or no match\./i,
    });
    const canvas = screen.getByTestId("react-flow");
    const dragData = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => dragData.set(type, value),
      getData: (type: string) => dragData.get(type) ?? "",
      dropEffect: "copy",
      effectAllowed: "copy",
    };
    fireEvent.dragStart(matchingElement, { dataTransfer });
    expect(dragData.get(FLOWFORGE_ELEMENT_DND_MIME)).toContain("Matching");
    fireEvent.dragOver(canvas, { dataTransfer });
    const dropEvent = createEvent.drop(canvas, {
      clientX: 240,
      clientY: 180,
    });
    Object.defineProperty(dropEvent, "dataTransfer", { value: dataTransfer });
    fireEvent(canvas, dropEvent);

    await userEvent.click(await screen.findByRole("button", { name: "Select Matching" }));
    expect(await screen.findByRole("heading", { name: "Matching" })).toBeInTheDocument();
    expect(screen.getByText(/Matching added locally/i)).toBeInTheDocument();
  });

  it("opens the AI assistant and drafts a workflow step from natural language", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    expect(screen.getByRole("region", { name: "Workflow AI assistant" })).toBeInTheDocument();
    expect(screen.getByText("What do you want to build today?")).toBeInTheDocument();
    const suggestionButtons = screen.getAllByRole("button", { name: /Use prompt suggestion:/i });
    expect(suggestionButtons).toHaveLength(3);
    await userEvent.click(suggestionButtons[0]);
    expect((screen.getByLabelText("Workflow prompt") as HTMLTextAreaElement).value).toMatch(/\w+/);

    await userEvent.clear(screen.getByLabelText("Workflow prompt"));
    await userEvent.type(
      screen.getByLabelText("Workflow prompt"),
      "Add a human approval step before completion.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Draft workflow graph" }));

    expect(await screen.findByRole("heading", { name: "Approval Gate" })).toBeInTheDocument();
    expect(screen.getByText(/Workflow AI added Approval Gate to the workflow graph/i)).toBeInTheDocument();
    expect(screen.queryByText(/FlowForge AI added Approval Gate to the workflow graph/i)).not.toBeInTheDocument();
    expect(apiMocks.createFlowForgeWorkflowAIDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Add a human approval step before completion.",
        use_llm: true,
        context: expect.objectContaining({
          integrations: expect.arrayContaining([
            expect.objectContaining({
              integration_key: "jotform-intake",
              source_events: expect.arrayContaining([expect.objectContaining({ event_key: "intake_submitted" })]),
            }),
          ]),
          matching_policies: expect.arrayContaining([expect.objectContaining({ id: 50, display_name: "Therapist Routing Policy" })]),
          resource_sets: expect.arrayContaining([expect.objectContaining({ id: 30, display_name: "Therapist Pool" })]),
          communication_templates: expect.arrayContaining([expect.objectContaining({ template_key: "flowforge.generic-human-task" })]),
          saved_queries: expect.arrayContaining([expect.objectContaining({ id: "saved-1", name: "Therapist Intake Extract" })]),
        }),
      }),
    );
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Workflow AI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refine generated workflow" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear chat" }));
    expect(screen.queryByText(/Workflow AI added Approval Gate to the workflow graph/i)).not.toBeInTheDocument();
  });

  it("uses AI hints for scheduled exports from governed queries", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.type(screen.getByLabelText("Workflow prompt"), "Schedule a daily export from a saved query.");
    await userEvent.click(screen.getByRole("button", { name: "Draft workflow graph" }));

    expect(await screen.findByRole("heading", { name: "Schedule Trigger" })).toBeInTheDocument();
    expect(screen.getByText(/Workflow AI added Schedule Trigger to the workflow graph/i)).toBeInTheDocument();
  });

  it("updates the node inspector when a canvas node is selected", async () => {
    renderPage();

    await screen.findByText("Request Response");
    await userEvent.click(canvasNode("Request Response"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Request Response" })).toBeInTheDocument();
      expect(screen.getByText("Response timeout")).toBeInTheDocument();
      expect(screen.getByDisplayValue("120")).toBeInTheDocument();
    });
  });

  it("creates a new workflow from a template", async () => {
    apiMocks.createFlowForgeWorkflowDraft.mockResolvedValue({
      ...therapistRoutingStarterWorkflow,
      id: "88",
      name: "Therapist Intake Routing",
      status: "draft",
    });
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: /new from template/i }));
    expect(await screen.findByRole("dialog", { name: "Workflow templates" })).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Use Therapist Intake Routing template/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Therapist Intake Routing",
          description: therapistRoutingStarterWorkflow.description,
          graph: therapistRoutingStarterWorkflow.graph,
        }),
        expect.anything(),
      );
    });
    expect(await screen.findByText("Workflow created from template.")).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.listFlowForgeWorkflows).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: "Therapist Intake Routing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Patient Intake" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Persisted Therapist Routing" })).not.toBeInTheDocument();
  });

  it("starts a local blank workflow from the designer rail", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: "New from scratch" }));

    expect(apiMocks.createFlowForgeWorkflowDraft).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "New workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Manual Start" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select Patient Intake" })).not.toBeInTheDocument();
    expect(screen.getByText("New blank workflow started locally. Save a draft version to persist it.")).toBeInTheDocument();
  });

  it("applies node config changes and saves a new persisted draft version", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Request Response"));

    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.change(screen.getByLabelText("Node configuration JSON"), {
      target: { value: JSON.stringify({ timeout_minutes: 45, task_mode: "sequential" }, null, 2) },
    });
    await userEvent.click(screen.getByRole("button", { name: /apply node config/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "offer",
                data: { timeout_minutes: 45, task_mode: "sequential" },
              }),
            ]),
          }),
        }),
      );
    });
    expect(await screen.findByText("Draft version saved.")).toBeInTheDocument();
  });

  it("keeps raw JSON editing behind the Advanced inspector tab", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Request Response"));

    expect(screen.queryByLabelText("Node configuration JSON")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByLabelText("Node configuration JSON")).toBeInTheDocument();
  });

  it("keeps the configuration drawer open and shows an error toast when advanced JSON is invalid", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Request Response"));
    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.change(screen.getByLabelText("Node configuration JSON"), {
      target: { value: "{invalid" },
    });
    await userEvent.click(screen.getByRole("button", { name: /apply node config/i }));

    expect(toastMocks.error).toHaveBeenCalledWith("Node configuration is not valid JSON.");
    expect(screen.getByRole("dialog", { name: "Action configuration" })).toBeInTheDocument();
    expect(screen.getAllByText("Node configuration is not valid JSON.").length).toBeGreaterThan(0);
  });

  it("applies friendly inspector details without opening advanced JSON", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Request Response"));

    await userEvent.clear(screen.getByLabelText(/Response timeout/i));
    await userEvent.type(screen.getByLabelText(/Response timeout/i), "45");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));

    expect(toastMocks.success).toHaveBeenCalledWith("Action details applied. Save a draft version to persist it.");
    expect(screen.queryByRole("dialog", { name: "Action configuration" })).not.toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByText("Save a draft version to persist the current design.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "offer",
                data: { timeout_minutes: 45, task_mode: "sequential", communication_template_key: "flowforge.human_task" },
              }),
            ]),
          }),
        }),
      );
    });
    expect(await screen.findByText("Draft version saved.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
  });

  it("selects intake sources from configured integrations", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Patient Intake"));

    const sourceSelect = selectByLabel(/Source integration/i);
    expect(sourceSelect).toHaveValue("");
    expect(await screen.findByRole("option", { name: /Jotform Intake \(test\)/i })).toBeInTheDocument();
    await userEvent.selectOptions(sourceSelect, "jotform-intake");
    const eventSelect = selectByLabel(/^Event/i);
    expect(eventSelect).toHaveValue("");
    expect(screen.getByRole("option", { name: "Intake Submitted" })).toBeInTheDocument();
    await userEvent.selectOptions(eventSelect, "intake_submitted");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "intake",
                data: expect.objectContaining({ source: "jotform-intake", event: "intake_submitted" }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("configures loop target and stop condition from dropdowns", async () => {
    const workflowWithBlankLoop: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        ...persistedWorkflow.graph,
        nodes: persistedWorkflow.graph.nodes.map((node) =>
          node.id === "next"
            ? {
                ...node,
                data: { loop_target: "", stop_when: "" },
              }
            : node,
        ),
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([workflowWithBlankLoop]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: workflowWithBlankLoop.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Next Therapist"));

    const targetSelect = selectByLabel(/Loop target/i);
    expect(targetSelect).toHaveValue("");
    expect(screen.getByRole("option", { name: /Request Response \(human task\)/i })).toBeInTheDocument();
    await userEvent.selectOptions(targetSelect, "offer");

    const stopWhenSelect = selectByLabel(/Stop when/i);
    expect(screen.getByRole("option", { name: "No candidates remain" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Response accepted" })).toBeInTheDocument();
    await userEvent.selectOptions(stopWhenSelect, "accepted");

    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "next",
                data: expect.objectContaining({ loop_target: "offer", stop_when: "accepted" }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("creates a Jotform integration from the intake inspector and selects it", async () => {
    apiMocks.listFlowForgeIntegrations.mockResolvedValue([]);
    apiMocks.createFlowForgeIntegration.mockResolvedValue({
      id: 405,
      workspace_id: "ws_test",
      provider: "jotform",
      integration_key: "jotform-intake",
      display_name: "Jotform Intake",
      external_form_id: null,
      enabled: true,
      mode: "test",
      webhook_public_id: "public-jotform-2",
      webhook_path: "/webhooks/jotform/public-jotform-2",
      webhook_url: "http://localhost/webhooks/jotform/public-jotform-2",
      webhook_secret: "ffjot_secret",
      field_mapping: {},
      source_events: [{ event_key: "intake_submitted", display_name: "Intake Submitted", description: "New intake submission." }],
      source_fields: [{ path: "serviceRequested", label: "Requested Service", type: "text", required: false, sensitive: false }],
      workflow_value_schema: workflowValueSchema([{ key: "values.intake.requested_service", label: "Requested Service", sourcePath: "serviceRequested", type: "text" }]),
      test_recipient_overrides: [],
      settings: {},
    });
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Patient Intake"));
    const configDrawer = await screen.findByRole("dialog", { name: "Action configuration" });
    await userEvent.click(within(configDrawer).getByRole("button", { name: /create jotform integration/i }));

    const integrationDrawer = await screen.findByRole("dialog", { name: "Add integration" });
    expect(within(integrationDrawer).getByRole("combobox", { name: "Provider" })).toHaveValue("jotform");
    expect(within(integrationDrawer).queryByRole("option", { name: /Webhook/i })).not.toBeInTheDocument();
    await userEvent.click(within(integrationDrawer).getByRole("button", { name: /create integration/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeIntegration).toHaveBeenCalledWith(
        "jotform",
        expect.objectContaining({
          integration_key: "jotform-intake",
          display_name: "Jotform Intake",
          source_events: expect.arrayContaining([
            expect.objectContaining({ event_key: "intake_submitted", display_name: "Intake Submitted" }),
          ]),
        }),
      );
    });

    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));
    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "intake",
                data: expect.objectContaining({
                  source: "jotform-intake",
                  event: "intake_submitted",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("selects webhook trigger source and action from configured webhook integrations", async () => {
    const webhookWorkflow: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          {
            id: "webhook",
            type: "webhook_trigger",
            label: "Webhook Trigger",
            position: { x: 80, y: 120 },
            data: { source_key: "", event: "", mode: "test" },
          },
        ],
        edges: [],
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([webhookWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: webhookWorkflow.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Webhook Trigger"));
    const drawer = await screen.findByRole("dialog", { name: "Action configuration" });
    expect(drawer).toBeInTheDocument();

    await userEvent.selectOptions(within(drawer).getByRole("combobox", { name: /^Webhook source/i }), "webhook-intake");
    await userEvent.selectOptions(within(drawer).getByRole("combobox", { name: /^Action/i }), "patient_intake_created");
    await userEvent.selectOptions(within(drawer).getByLabelText("mode"), "production");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "webhook",
                data: expect.objectContaining({
                  source_key: "webhook-intake",
                  event: "patient_intake_created",
                  mode: "production",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("selects file watch trigger source and action from configured file watch integrations", async () => {
    const fileWatchWorkflow: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          {
            id: "file-watch",
            type: "file_watch_trigger",
            label: "File Watch Trigger",
            position: { x: 80, y: 120 },
            data: { source_key: "", event: "", pattern: "*.csv", mode: "test" },
          },
        ],
        edges: [],
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([fileWatchWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: fileWatchWorkflow.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("File Watch Trigger"));
    const drawer = await screen.findByRole("dialog", { name: "Action configuration" });
    expect(drawer).toBeInTheDocument();

    await userEvent.selectOptions(within(drawer).getByRole("combobox", { name: /^File watch source/i }), "sftp-dropbox");
    await userEvent.selectOptions(within(drawer).getByRole("combobox", { name: /^Action/i }), "file_updated");
    await userEvent.selectOptions(within(drawer).getByLabelText("mode"), "production");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "file-watch",
                data: expect.objectContaining({
                  source_key: "sftp-dropbox",
                  event: "file_updated",
                  mode: "production",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("creates a file watch integration from the trigger inspector and selects it", async () => {
    apiMocks.listFlowForgeIntegrations.mockResolvedValue([]);
    const fileWatchWorkflow: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          {
            id: "file-watch",
            type: "file_watch_trigger",
            label: "File Watch Trigger",
            position: { x: 80, y: 120 },
            data: { source_key: "", event: "", pattern: "*.csv", mode: "test" },
          },
        ],
        edges: [],
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([fileWatchWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: fileWatchWorkflow.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("File Watch Trigger"));
    const configDrawer = await screen.findByRole("dialog", { name: "Action configuration" });
    await userEvent.click(within(configDrawer).getByRole("button", { name: /create file watch integration/i }));

    const integrationDrawer = await screen.findByRole("dialog", { name: "Add integration" });
    expect(within(integrationDrawer).getByRole("combobox", { name: "Provider" })).toHaveValue("file_watch");
    await userEvent.click(within(integrationDrawer).getByRole("button", { name: /create integration/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeIntegration).toHaveBeenCalledWith(
        "file_watch",
        expect.objectContaining({
          integration_key: "file-watch-source",
          display_name: "File Watch Source",
          source_events: expect.arrayContaining([
            expect.objectContaining({ event_key: "file_created", display_name: "File Created" }),
          ]),
        }),
      );
    });

    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));
    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "file-watch",
                data: expect.objectContaining({
                  source_key: "file-watch-source",
                  event: "file_created",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("maps intake fields from the selected integration source catalog", async () => {
    const workflowWithIntakeMapping: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          {
            id: "intake",
            type: "intake",
            label: "Patient Intake",
            position: { x: 40, y: 120 },
            data: { source: "jotform-intake", event: "intake_submitted" },
          },
          {
            id: "normalize",
            type: "map_transform",
            label: "Normalize Intake",
            position: { x: 280, y: 120 },
            data: {
              mode: "run_context",
              field_mapping: [
                { target: "intake.requested_service", source: "intake.fields.serviceRequested", expose_to_templates: true },
              ],
              template_fields: ["intake.requested_service"],
            },
          },
        ],
        edges: [{ id: "intake-normalize", source: "intake", target: "normalize" }],
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([workflowWithIntakeMapping]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: workflowWithIntakeMapping.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Normalize Intake"));

    const sourceSelects = screen
      .getAllByLabelText(/^Source$/i)
      .filter((element): element is HTMLSelectElement => element instanceof HTMLSelectElement && element.value === "intake.fields.serviceRequested");
    const sourceSelect = sourceSelects[sourceSelects.length - 1];
    expect(sourceSelect).toBeDefined();
    expect(sourceSelect).toHaveDisplayValue(/Requested Service \(text\)/i);
    expect(Array.from(sourceSelect.options).some((option) => /Clinical Summary \(text\) sensitive/i.test(option.textContent ?? ""))).toBe(true);
    await userEvent.selectOptions(sourceSelect, "intake.fields.summary");
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "normalize",
                data: expect.objectContaining({
                  field_mapping: [
                    {
                      target: "intake.requested_service",
                      source: "intake.fields.summary",
                      expose_to_templates: true,
                    },
                  ],
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("loads persisted workflow value schema fields into the map transform builder", async () => {
    const workflowWithIntakeMapping: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          {
            id: "intake",
            type: "intake",
            label: "Patient Intake",
            position: { x: 40, y: 120 },
            data: { source: "jotform-intake", event: "intake_submitted" },
          },
          {
            id: "normalize",
            type: "map_transform",
            label: "Normalize Intake",
            position: { x: 280, y: 120 },
            data: { mode: "run_context", field_mapping: [], template_fields: [] },
          },
        ],
        edges: [{ id: "intake-normalize", source: "intake", target: "normalize" }],
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([workflowWithIntakeMapping]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: workflowWithIntakeMapping.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Normalize Intake"));

    expect(await screen.findByDisplayValue("Patient Email")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Requested Service")).toBeInTheDocument();
    expect(screen.queryByText(/No workflow value schema yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add mapping/i })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /add mapping/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "normalize",
                data: expect.objectContaining({
                  field_mapping: expect.arrayContaining([
                    expect.objectContaining({
                      target: "values.patient.email",
                      source: "intake.fields.email",
                    }),
                  ]),
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("generates and saves workflow value schema from the selected intake integration", async () => {
    const workflowWithIntakeMapping: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          {
            id: "intake",
            type: "intake",
            label: "Patient Intake",
            position: { x: 40, y: 120 },
            data: { source: "jotform-intake", event: "intake_submitted" },
          },
          {
            id: "normalize",
            type: "map_transform",
            label: "Normalize Intake",
            position: { x: 280, y: 120 },
            data: { mode: "run_context", field_mapping: [], template_fields: [] },
          },
        ],
        edges: [{ id: "intake-normalize", source: "intake", target: "normalize" }],
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([workflowWithIntakeMapping]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: workflowWithIntakeMapping.graph }]);
    apiMocks.listFlowForgeIntegrations.mockResolvedValue([
      {
        id: 401,
        workspace_id: "ws_test",
        provider: "jotform",
        integration_key: "jotform-intake",
        display_name: "Jotform Intake",
        external_form_id: "form-1",
        enabled: true,
        mode: "test",
        webhook_public_id: "public-1",
        webhook_path: "/webhooks/flowforge/public-1",
        webhook_url: "http://localhost/webhooks/flowforge/public-1",
        webhook_secret: null,
        field_mapping: {},
        source_events: [
          { event_key: "intake_submitted", display_name: "Intake Submitted", description: "New intake form submission." },
        ],
        source_fields: [
          { path: "email", label: "Email Address", type: "email", required: true, sensitive: true },
          { path: "firstName", label: "First Name", type: "text", required: true, sensitive: true },
          { path: "lastName", label: "Last Name", type: "text", required: true, sensitive: true },
          { path: "serviceRequested", label: "Requested Service", type: "text", required: true, sensitive: false },
          { path: "summary", label: "Clinical Summary", type: "text", required: false, sensitive: true },
        ],
        workflow_value_schema: { fields: [] },
        test_recipient_overrides: [],
        settings: {},
      },
    ]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Normalize Intake"));
    expect(screen.getByText(/No workflow value schema yet/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Patient Email")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add mapping/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /generate from source fields/i }));

    await waitFor(() => {
      expect(apiMocks.draftIntegrationWorkflowValueSchema).toHaveBeenCalledWith(401);
    });
    expect(await screen.findByDisplayValue("Patient Email")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Schema label 1"));
    await userEvent.type(screen.getByLabelText("Schema label 1"), "Patient Contact Email");
    expect(screen.getByDisplayValue("Patient Full Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Schema builder 2")).toHaveValue("concat");
    expect(screen.getByLabelText("Source 1")).toHaveValue("intake.fields.firstName");
    expect(screen.getByLabelText("Source 2")).toHaveValue("intake.fields.lastName");
    await userEvent.click(screen.getByRole("button", { name: /^add source$/i }));
    await userEvent.selectOptions(screen.getByLabelText("Source 3"), "intake.fields.serviceRequested");
    await userEvent.click(screen.getByRole("button", { name: /^save schema$/i }));

    await waitFor(() => {
      expect(apiMocks.updateIntegrationWorkflowValueSchema).toHaveBeenCalledWith(
        401,
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              key: "values.patient.email",
              label: "Patient Contact Email",
            }),
            expect.objectContaining({
              key: "values.patient.full_name",
              transform: "concat",
              source_paths: ["intake.fields.firstName", "intake.fields.lastName", "intake.fields.serviceRequested"],
            }),
          ]),
        }),
      );
    });
  });

  it("uses mapped workflow values as notification recipients", async () => {
    const workflowWithMappedRecipient: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          {
            id: "intake",
            type: "intake",
            label: "Patient Intake",
            position: { x: 40, y: 120 },
            data: { source: "jotform-intake", event: "intake_submitted" },
          },
          {
            id: "normalize",
            type: "map_transform",
            label: "Normalize Intake",
            position: { x: 280, y: 120 },
            data: {
              mode: "run_context",
              field_mapping: [
                { target: "values.patient.email", source: "intake.fields.email", expose_to_templates: true },
              ],
              template_fields: ["values.patient.email"],
            },
          },
          {
            id: "notify-patient",
            type: "notification",
            label: "Notify Patient",
            position: { x: 520, y: 120 },
            data: { recipients: [], reason: "Notify intake user.", communication_template_key: "flowforge.notification" },
          },
        ],
        edges: [
          { id: "intake-normalize", source: "intake", target: "normalize" },
          { id: "normalize-notify", source: "normalize", target: "notify-patient" },
        ],
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([workflowWithMappedRecipient]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: workflowWithMappedRecipient.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Notify Patient"));

    await userEvent.selectOptions(selectByLabel(/^Recipient source/i), "workflow_value");
    await userEvent.selectOptions(selectByLabel(/^Workflow value/i), "values.patient.email");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "notify-patient",
                data: expect.objectContaining({
                  recipient_source: "workflow_value",
                  recipient_field: "values.patient.email",
                  recipients: [],
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("adds a canvas connection and saves it with the workflow graph", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: /connect first node to last node/i }));
    expect(await screen.findByText(/Connection added locally/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            edges: expect.arrayContaining([
              expect.objectContaining({
                id: "edge-intake-to-next",
                source: "intake",
                target: "next",
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("deletes a selected canvas connection without deleting nodes", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: /select connection match-offer/i }));
    expect(await screen.findByText(/Connection selected/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /delete connection/i }));
    expect(await screen.findByText(/Connection deleted locally/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: "match" }),
              expect.objectContaining({ id: "offer" }),
            ]),
            edges: expect.not.arrayContaining([
              expect.objectContaining({
                id: "match-offer",
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("configures multiple decision outcomes on one connection", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: /select connection decision-decline/i }));
    const drawer = await screen.findByRole("dialog", { name: "Connection configuration" });
    await userEvent.click(within(drawer).getByLabelText("Declined"));
    await userEvent.click(within(drawer).getByLabelText("Timed Out"));
    expect(await screen.findByText(/Connection route updated locally/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            edges: expect.arrayContaining([
              expect.objectContaining({
                id: "decision-decline",
                branch: null,
                branches: ["declined", "timed_out"],
                label: "Declined / Timed Out",
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("configures the executable matching action from published matching policies", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Find Matching Therapist"));

    await screen.findByText(/policy controls eligibility, scoring, ranking, and the resource pool/i);
    const matchingPolicySelect = selectByLabel(/Matching policy/i);
    expect(matchingPolicySelect).toBeInTheDocument();
    expect(screen.getByText(/policy controls eligibility, scoring, ranking, and the resource pool/i)).toBeInTheDocument();
    await userEvent.selectOptions(matchingPolicySelect, "50");
    expect(matchingPolicySelect).toHaveValue("50");
    expect(screen.queryByLabelText(/Response timeout/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "match",
                data: expect.objectContaining({
                  matching_policy_id: 50,
                  resource_set_id: 30,
                }),
              }),
              expect.objectContaining({
                id: "offer",
                data: expect.objectContaining({
                  timeout_minutes: 120,
                  communication_template_key: "flowforge.human_task",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("chooses active compatible communication templates from the upstream matching resource pool", async () => {
    const workflowWithConfiguredMatching: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        ...persistedWorkflow.graph,
        nodes: persistedWorkflow.graph.nodes.map((node) =>
          node.id === "match"
            ? { ...node, data: { matching_policy_id: 50, resource_set_id: 30 } }
            : node,
        ),
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([workflowWithConfiguredMatching]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([
      { ...persistedVersion, graph: workflowWithConfiguredMatching.graph },
    ]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Request Response"));

    await screen.findByRole("option", { name: /Therapist Human Task \(resource pool\)/i });
    const templateSelect = selectByLabel(/Communication template/i);
    expect(templateSelect).toBeInstanceOf(HTMLSelectElement);
    await waitFor(() => {
      expect(apiMocks.listFlowForgeCommunicationTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          purpose: "human_task",
          channel: "email",
        }),
      );
    });
    expect(apiMocks.listFlowForgeCommunicationTemplates.mock.calls.some(([params]) => "resource_set_id" in params)).toBe(false);
    expect(screen.getByRole("option", { name: /Generic Human Task \(generic\)/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Therapist Human Task \(resource pool\)/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Other Resource Human Task/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create template/i }).getAttribute("href")).toContain("resource_set_id=30");

    await userEvent.selectOptions(templateSelect, "flowforge.therapist-human-task");
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "offer",
                data: expect.objectContaining({
                  communication_template_key: "flowforge.therapist-human-task",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("saves query extract row limit from the friendly inspector", async () => {
    const queryExtractWorkflow: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          ...persistedWorkflow.graph.nodes,
          {
            id: "extract",
            type: "query_extract",
            label: "Query Extract",
            position: { x: 720, y: 220 },
            data: { saved_query_id: "", preview_limit: "", artifact_key: "extract-results" },
          },
        ],
        edges: persistedWorkflow.graph.edges,
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([queryExtractWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: queryExtractWorkflow.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Query Extract"));

    expect(await screen.findByRole("heading", { name: "Query Extract" })).toBeInTheDocument();
    await screen.findByRole("option", { name: /Therapist Intake Extract \(Mine\)/i });
    await userEvent.selectOptions(selectByLabel(/^Saved query/i), "saved-1");
    await userEvent.selectOptions(selectByLabel(/^Row limit mode/i), "custom");
    await userEvent.type(screen.getByLabelText(/^Row limit$/i), "1000");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                type: "query_extract",
                data: expect.objectContaining({ saved_query_id: "saved-1", preview_limit: 1000 }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("saves maximum configured query extract row limit from the friendly inspector", async () => {
    const queryExtractWorkflow: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          ...persistedWorkflow.graph.nodes,
          {
            id: "extract",
            type: "query_extract",
            label: "Query Extract",
            position: { x: 720, y: 220 },
            data: { saved_query_id: "", preview_limit: "", artifact_key: "extract-results" },
          },
        ],
        edges: persistedWorkflow.graph.edges,
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([queryExtractWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: queryExtractWorkflow.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Query Extract"));

    expect(await screen.findByRole("heading", { name: "Query Extract" })).toBeInTheDocument();
    await screen.findByRole("option", { name: /Therapist Intake Extract \(Mine\)/i });
    await userEvent.selectOptions(selectByLabel(/^Saved query/i), "saved-1");
    await userEvent.selectOptions(selectByLabel(/^Row limit mode/i), "max");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                type: "query_extract",
                data: expect.objectContaining({ saved_query_id: "saved-1", preview_limit: "max" }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("saves scheduled export and import settings from the friendly inspector", async () => {
    const dataMovementWorkflow: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        nodes: [
          {
            id: "schedule",
            type: "schedule_trigger",
            label: "Schedule Trigger",
            position: { x: 80, y: 120 },
            data: { rrule: "FREQ=DAILY;INTERVAL=1", mode: "test" },
          },
          {
            id: "export",
            type: "export",
            label: "Export",
            position: { x: 360, y: 120 },
            data: { destination_key: "local-export", format: "csv", include_header: true },
          },
          {
            id: "import",
            type: "import",
            label: "Import",
            position: { x: 640, y: 120 },
            data: { source_key: "local-import", filename: "resources.csv", resource_set_id: "", activate: false },
          },
        ],
        edges: [],
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([dataMovementWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([{ ...persistedVersion, graph: dataMovementWorkflow.graph }]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Schedule Trigger"));
    await userEvent.selectOptions(screen.getByLabelText("Repeat"), "WEEKLY");
    fireEvent.change(inputByLabel(/^Every/i), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Starts on"), { target: { value: "2026-06-01" } });
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "08:30" } });
    fireEvent.change(screen.getByLabelText("Ends on"), { target: { value: "2026-06-30" } });
    await userEvent.click(screen.getByLabelText("Mon"));
    await userEvent.click(screen.getByLabelText("Wed"));
    await userEvent.selectOptions(screen.getByLabelText("mode"), "production");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));

    await userEvent.click(canvasNode("Export"));
    await userEvent.clear(inputByLabel(/^destination key/i));
    await userEvent.type(inputByLabel(/^destination key/i), "ops-export");
    await userEvent.selectOptions(screen.getByLabelText("format"), "json");
    await userEvent.click(inputByLabel(/^Include header/i));
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));

    await userEvent.click(canvasNode("Import"));
    await userEvent.clear(inputByLabel(/^Resource set id/i));
    await userEvent.type(inputByLabel(/^Resource set id/i), "20");
    await userEvent.click(inputByLabel(/^Activate after validation/i));
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "schedule",
                data: expect.objectContaining({
                  mode: "production",
                  rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20260630T235959Z",
                  run_time: "08:30",
                  start_date: "2026-06-01",
                  end_date: "2026-06-30",
                }),
              }),
              expect.objectContaining({
                id: "export",
                data: expect.objectContaining({ destination_key: "ops-export", format: "json", include_header: false }),
              }),
              expect.objectContaining({
                id: "import",
                data: expect.objectContaining({ resource_set_id: 20, activate: true }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("persists dragged canvas node positions into saved workflow versions", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Move offer" }));
    expect(screen.getByText(/Canvas layout updated locally/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "offer",
                position: { x: 777, y: 333 },
              }),
            ]),
          }),
        }),
      );
    });
  });

  it("persists canvas viewport into saved workflow versions", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Zoom workflow canvas" }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            viewport: { x: -220, y: -110, zoom: 0.62 },
          }),
        }),
      );
    });
  });

  it("remembers canvas viewport across designer remounts before the workflow is saved", async () => {
    const workflowWithStaleSavedViewport: FlowForgeWorkflowDefinition = {
      ...persistedWorkflow,
      graph: {
        ...persistedWorkflow.graph,
        viewport: { x: 0, y: 0, zoom: 0.85 },
      },
    };
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([workflowWithStaleSavedViewport]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([
      {
        ...persistedVersion,
        graph: workflowWithStaleSavedViewport.graph,
      },
    ]);
    const firstRender = renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Zoom workflow canvas" }));
    firstRender.unmount();

    renderPage();
    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            viewport: { x: -220, y: -110, zoom: 0.62 },
          }),
        }),
      );
    });
  });

  it("reopens action configuration after a canvas node is moved", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Patient Intake"));
    expect(await screen.findByRole("dialog", { name: "Action configuration" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close action configuration" }));
    expect(screen.queryByRole("dialog", { name: "Action configuration" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Move intake" }));

    expect(await screen.findByRole("dialog", { name: "Action configuration" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Configure Patient Intake" })).toBeInTheDocument();
  });

  it("deletes the selected canvas node with the Delete key", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Request Response"));
    fireEvent.keyDown(window, { key: "Delete" });

    expect(screen.getByText(/Request Response deleted locally/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.not.arrayContaining([expect.objectContaining({ id: "offer" })]),
            edges: expect.not.arrayContaining([
              expect.objectContaining({ source: "offer" }),
              expect.objectContaining({ target: "offer" }),
            ]),
          }),
        }),
      );
    });
  });

  it("deletes a canvas node from the node corner action", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Delete Request Response" }));

    expect(screen.getByText(/Request Response deleted locally/i)).toBeInTheDocument();
  });

  it("publishes a valid saved workflow version from version history", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Open workflows" }));
    expect(await screen.findByText("Version 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(apiMocks.publishFlowForgeWorkflowVersion).toHaveBeenCalledWith(42, 7);
    });
    expect(await screen.findByText("Workflow version published.")).toBeInTheDocument();
  });

  it("publishes the latest valid active workflow version from the workflow card menu", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Open workflows" }));
    await userEvent.click(screen.getByRole("button", { name: "Workflow options" }));
    await userEvent.click(screen.getByRole("button", { name: "Publish workflow" }));

    await waitFor(() => {
      expect(apiMocks.publishFlowForgeWorkflowVersion).toHaveBeenCalledWith(42, 7);
    });
    expect(await screen.findByText("Workflow version published.")).toBeInTheDocument();
  });

  it("deletes a persisted workflow from the workflow card menu", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Open workflows" }));
    await userEvent.click(screen.getByRole("button", { name: "Workflow options" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete workflow" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete workflow" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete workflow" }));

    await waitFor(() => {
      expect(apiMocks.deleteFlowForgeWorkflow).toHaveBeenCalledWith(42);
    });
    expect(await screen.findByText("Workflow deleted.")).toBeInTheDocument();
  });
});
