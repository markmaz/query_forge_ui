import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { therapistRoutingRunInspector, therapistRoutingSeed } from "../model/therapistRoutingSeed";
import type { FlowForgeCommunicationTemplate } from "../model/communicationTemplateTypes";
import type { FlowForgeWorkflowDefinition, FlowForgeWorkflowVersion } from "../model/types";
import { FLOWFORGE_ELEMENT_DND_MIME, FLOWFORGE_ELEMENTS } from "../model/workflowElements";
import FlowForgeStudioPage from "../ui/FlowForgeStudioPage";

const apiMocks = vi.hoisted(() => ({
  createFlowForgeWorkflowDraft: vi.fn(),
  createFlowForgeWorkflowVersion: vi.fn(),
  deleteFlowForgeWorkflow: vi.fn(),
  getFlowForgeRunInspector: vi.fn(),
  listFlowForgeIntegrations: vi.fn(),
  listFlowForgeWorkflowVersions: vi.fn(),
  listFlowForgeWorkflows: vi.fn(),
  listFlowForgeMatchingPolicies: vi.fn(),
  listFlowForgeCommunicationTemplates: vi.fn(),
  listFlowForgeResourceRecords: vi.fn(),
  listFlowForgeResourceSets: vi.fn(),
  publishFlowForgeWorkflowVersion: vi.fn(),
  validateFlowForgeGraph: vi.fn(),
}));

vi.mock("@xyflow/react", () => ({
  Background: () => <div data-testid="flow-background" />,
  Controls: () => <div data-testid="flow-controls" />,
  MarkerType: { ArrowClosed: "arrowclosed" },
  MiniMap: () => <div data-testid="flow-minimap" />,
  Position: { Left: "left", Right: "right" },
  ReactFlow: ({ nodes, edges, onNodeClick, onEdgeClick, onNodesChange, onConnect, onDrop, onDragOver, children }: any) => (
    <div data-testid="react-flow" onDrop={onDrop} onDragOver={onDragOver}>
      {nodes.map((node: any) => (
        <div key={node.id}>
          <div role="button" tabIndex={0} aria-label={`Select ${node.data.nodeLabel}`} onClick={(event) => onNodeClick(event, node)}>
            {node.data.label}
          </div>
          <button
            type="button"
            aria-label={`Move ${node.id}`}
            onClick={() =>
              onNodesChange?.([
                {
                  id: node.id,
                  type: "position",
                  position: { x: 777, y: 333 },
                },
              ])
            }
          >
            Move
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
      {children}
    </div>
  ),
}));

vi.mock("../api/workflowsApi", () => ({
  createFlowForgeWorkflowDraft: apiMocks.createFlowForgeWorkflowDraft,
  createFlowForgeWorkflowVersion: apiMocks.createFlowForgeWorkflowVersion,
  deleteFlowForgeWorkflow: apiMocks.deleteFlowForgeWorkflow,
  getFlowForgeRunInspector: apiMocks.getFlowForgeRunInspector,
  listFlowForgeWorkflowVersions: apiMocks.listFlowForgeWorkflowVersions,
  listFlowForgeWorkflows: apiMocks.listFlowForgeWorkflows,
  publishFlowForgeWorkflowVersion: apiMocks.publishFlowForgeWorkflowVersion,
  validateFlowForgeGraph: apiMocks.validateFlowForgeGraph,
}));

vi.mock("../api/adminApi", () => ({
  listFlowForgeIntegrations: apiMocks.listFlowForgeIntegrations,
  listFlowForgeMatchingPolicies: apiMocks.listFlowForgeMatchingPolicies,
  listFlowForgeResourceRecords: apiMocks.listFlowForgeResourceRecords,
  listFlowForgeResourceSets: apiMocks.listFlowForgeResourceSets,
}));

vi.mock("../api/communicationTemplatesApi", () => ({
  listFlowForgeCommunicationTemplates: apiMocks.listFlowForgeCommunicationTemplates,
}));

const persistedWorkflow: FlowForgeWorkflowDefinition = {
  ...therapistRoutingSeed,
  id: "42",
  name: "Persisted Therapist Routing",
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
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([therapistRoutingSeed]);
    apiMocks.validateFlowForgeGraph.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: ["Graph contains a loop. FlowForge allows this, but runtime execution must use state-machine semantics."],
    });
    apiMocks.getFlowForgeRunInspector.mockResolvedValue(therapistRoutingRunInspector);
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
          { path: "serviceRequested", label: "Requested Service", type: "text", required: true, sensitive: false },
          { path: "summary", label: "Clinical Summary", type: "text", required: false, sensitive: true },
        ],
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
    ]);
    apiMocks.createFlowForgeWorkflowDraft.mockResolvedValue({
      ...therapistRoutingSeed,
      id: "42",
      status: "draft",
    });
    apiMocks.createFlowForgeWorkflowVersion.mockResolvedValue(persistedVersion);
    apiMocks.deleteFlowForgeWorkflow.mockResolvedValue({ deleted: true, workflow_definition_id: 42 });
    apiMocks.publishFlowForgeWorkflowVersion.mockResolvedValue({
      ...persistedVersion,
      version_status: "published",
    });
  });

  it("renders the therapist routing workflow and loop warning", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Therapist Intake Routing" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "FlowForge designer tools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft version" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open workflows" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Workflow element palette" })).toBeInTheDocument();
    expect(screen.getAllByText("Patient Intake").length).toBeGreaterThan(0);
    const intakeCanvasNode = canvasNode("Patient Intake");
    expect(intakeCanvasNode.querySelector(".ff-node-icon .fa-inbox")).not.toBeNull();
    expect(screen.getByText("Send Offer")).toBeInTheDocument();
    expect(screen.getByText(/valid with warnings/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime execution must use state-machine semantics/i)).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Save draft version" })).toBeDisabled();
    expect(screen.getByLabelText("Patient Intake has validation errors")).toBeInTheDocument();

    await userEvent.click(canvasNode("Patient Intake"));

    expect(screen.getByRole("complementary", { name: "Node inspector" })).toBeInTheDocument();
    expect(screen.getByLabelText("Selected node validation")).toHaveTextContent(
      "Intake node 'intake' references unknown source integration 'legacy-jotform'.",
    );
  });

  it("opens workflow selection from the vertical designer rail", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Therapist Intake Routing" });
    expect(screen.getByRole("complementary", { name: "FlowForge designer tools" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open workflows" }));

    expect(screen.getByRole("heading", { name: "Open Workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Therapist Intake Routing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workflow options" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Workflow options" }));
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("adds workflow elements from the left palette", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Therapist Intake Routing" });
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

  it("adds data movement workflow elements from the palette", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Therapist Intake Routing" });
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
    expect(screen.getByLabelText("saved query id")).toHaveValue("");
    expect(screen.getByLabelText(/^Row limit/i)).toHaveValue(null);
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
    expect(screen.getByText("Intake Field Mapper")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: "Source" })[0]).toHaveValue("");
    expect(screen.getByText(/Select an intake integration with source fields before mapping intake data/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText("Email field")[0]).toBeChecked();
  });

  it("adds workflow elements by dropping palette payloads onto the canvas", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Therapist Intake Routing" });
    const element = FLOWFORGE_ELEMENTS.find((item) => item.type === "matching");
    expect(element).toBeDefined();
    fireEvent.drop(screen.getByTestId("react-flow"), {
      clientX: 240,
      clientY: 180,
      dataTransfer: {
        getData: (type: string) =>
          type === FLOWFORGE_ELEMENT_DND_MIME ? JSON.stringify(element) : "",
      },
    });

    expect(await screen.findByRole("heading", { name: "Matching" })).toBeInTheDocument();
    expect(screen.getByText(/Matching added locally/i)).toBeInTheDocument();
  });

  it("opens the AI assistant and drafts a workflow step from natural language", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Therapist Intake Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Open AI" }));
    expect(screen.getByRole("region", { name: "FlowForge AI assistant" })).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Workflow prompt"),
      "Add a human approval step before assignment.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Draft next step" }));

    expect(await screen.findByRole("heading", { name: "Approval Gate" })).toBeInTheDocument();
    expect(screen.getByText(/I added a Approval Gate as a draft step/i)).toBeInTheDocument();
  });

  it("uses AI hints for scheduled exports from governed queries", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Therapist Intake Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Open AI" }));
    await userEvent.type(screen.getByLabelText("Workflow prompt"), "Schedule a daily export from a saved query.");
    await userEvent.click(screen.getByRole("button", { name: "Draft next step" }));

    expect(await screen.findByRole("heading", { name: "Schedule Trigger" })).toBeInTheDocument();
    expect(screen.getByText(/I added a Schedule Trigger as a draft step/i)).toBeInTheDocument();
  });

  it("updates the node inspector when a canvas node is selected", async () => {
    renderPage();

    await screen.findByText("Send Offer");
    await userEvent.click(canvasNode("Send Offer"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Send Offer" })).toBeInTheDocument();
      expect(screen.getByText("Response timeout")).toBeInTheDocument();
      expect(screen.getByDisplayValue("120")).toBeInTheDocument();
    });
  });

  it("creates a persisted draft from the active seeded workflow", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Therapist Intake Routing" });
    await userEvent.click(screen.getByRole("button", { name: /create persisted draft/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Therapist Intake Routing",
          description: therapistRoutingSeed.description,
          graph: therapistRoutingSeed.graph,
        }),
        expect.anything(),
      );
    });
    expect(await screen.findByText("Persisted workflow draft created.")).toBeInTheDocument();
  });

  it("creates a new blank workflow from the designer rail", async () => {
    apiMocks.createFlowForgeWorkflowDraft.mockResolvedValue({
      ...persistedWorkflow,
      id: "77",
      name: "Untitled Workflow",
      graph: {
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
      },
    });
    renderPage();

    await screen.findByRole("heading", { name: "Therapist Intake Routing" });
    await userEvent.click(screen.getByRole("button", { name: "New blank workflow" }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Untitled Workflow",
          description: "New FlowForge workflow.",
          graph: {
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
          },
        }),
        expect.anything(),
      );
    });
    expect(await screen.findByText("New blank workflow created.")).toBeInTheDocument();
  });

  it("applies node config changes and saves a new persisted draft version", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Send Offer"));

    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.change(screen.getByLabelText("Node configuration JSON"), {
      target: { value: JSON.stringify({ timeout_minutes: 45, offer_mode: "sequential" }, null, 2) },
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
                data: { timeout_minutes: 45, offer_mode: "sequential" },
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
    await userEvent.click(canvasNode("Send Offer"));

    expect(screen.queryByLabelText("Node configuration JSON")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByLabelText("Node configuration JSON")).toBeInTheDocument();
  });

  it("applies friendly inspector details without opening advanced JSON", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Send Offer"));

    await userEvent.clear(screen.getByLabelText(/Response timeout/i));
    await userEvent.type(screen.getByLabelText(/Response timeout/i), "45");
    await userEvent.click(screen.getByRole("button", { name: /apply details/i }));
    await userEvent.click(screen.getByRole("button", { name: /save draft version/i }));

    await waitFor(() => {
      expect(apiMocks.createFlowForgeWorkflowVersion).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "offer",
                data: { timeout_minutes: 45, offer_mode: "sequential", communication_template_key: "flowforge.human_task" },
              }),
            ]),
          }),
        }),
      );
    });
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

    const sourceSelect = selectByLabel(/^Source$/i);
    expect(sourceSelect).toHaveDisplayValue(/Requested Service \(text\)/i);
    expect(screen.getByRole("option", { name: /Clinical Summary \(text\) sensitive/i })).toBeInTheDocument();
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
    await userEvent.click(canvasNode("Send Offer"));

    const templateSelect = await screen.findByLabelText(/Communication template/i);
    expect(templateSelect).toBeInstanceOf(HTMLSelectElement);
    await waitFor(() => {
      expect(apiMocks.listFlowForgeCommunicationTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          purpose: "human_task",
          channel: "email",
          resource_set_id: 30,
        }),
      );
    });
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
            data: { saved_query_id: "saved-1", preview_limit: "", artifact_key: "extract-results" },
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
    await userEvent.type(screen.getByLabelText(/^Row limit/i), "1000");
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
                data: expect.objectContaining({ preview_limit: 1000 }),
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
    await userEvent.clear(inputByLabel(/^Schedule/i));
    await userEvent.type(inputByLabel(/^Schedule/i), "FREQ=HOURLY;INTERVAL=6");
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
                data: expect.objectContaining({ mode: "production", rrule: "FREQ=HOURLY;INTERVAL=6" }),
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

  it("deletes the selected canvas node with the Delete key", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(canvasNode("Send Offer"));
    fireEvent.keyDown(window, { key: "Delete" });

    expect(screen.getByText(/Send Offer deleted locally/i)).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Delete Send Offer" }));

    expect(screen.getByText(/Send Offer deleted locally/i)).toBeInTheDocument();
  });

  it("publishes a valid saved workflow version from version history", async () => {
    apiMocks.listFlowForgeWorkflows.mockResolvedValue([persistedWorkflow]);
    apiMocks.listFlowForgeWorkflowVersions.mockResolvedValue([persistedVersion]);
    renderPage();

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
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByRole("heading", { name: "Persisted Therapist Routing" });
    await userEvent.click(screen.getByRole("button", { name: "Open workflows" }));
    await userEvent.click(screen.getByRole("button", { name: "Workflow options" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete workflow" }));

    await waitFor(() => {
      expect(apiMocks.deleteFlowForgeWorkflow).toHaveBeenCalledWith(42);
    });
    expect(await screen.findByText("Workflow deleted.")).toBeInTheDocument();
  });
});
