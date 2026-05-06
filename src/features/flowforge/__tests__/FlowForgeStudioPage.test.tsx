import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { therapistRoutingRunInspector, therapistRoutingSeed } from "../model/therapistRoutingSeed";
import type { FlowForgeWorkflowDefinition, FlowForgeWorkflowVersion } from "../model/types";
import { FLOWFORGE_ELEMENT_DND_MIME, FLOWFORGE_ELEMENTS } from "../model/workflowElements";
import FlowForgeStudioPage from "../ui/FlowForgeStudioPage";

const apiMocks = vi.hoisted(() => ({
  createFlowForgeWorkflowDraft: vi.fn(),
  createFlowForgeWorkflowVersion: vi.fn(),
  deleteFlowForgeWorkflow: vi.fn(),
  getFlowForgeRunInspector: vi.fn(),
  listFlowForgeWorkflowVersions: vi.fn(),
  listFlowForgeWorkflows: vi.fn(),
  publishFlowForgeWorkflowVersion: vi.fn(),
  validateFlowForgeGraph: vi.fn(),
}));

vi.mock("@xyflow/react", () => ({
  Background: () => <div data-testid="flow-background" />,
  Controls: () => <div data-testid="flow-controls" />,
  MarkerType: { ArrowClosed: "arrowclosed" },
  MiniMap: () => <div data-testid="flow-minimap" />,
  ReactFlow: ({ nodes, onNodeClick, onNodesChange, onDrop, onDragOver, children }: any) => (
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

function inputByLabel(name: RegExp) {
  const field = screen.getAllByLabelText(name).find((element) => element instanceof HTMLInputElement);
  expect(field).toBeDefined();
  return field as HTMLInputElement;
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
  });

  it("adds workflow elements by dropping palette payloads onto the canvas", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Therapist Intake Routing" });
    const element = FLOWFORGE_ELEMENTS.find((item) => item.type === "filter");
    expect(element).toBeDefined();
    fireEvent.drop(screen.getByTestId("react-flow"), {
      clientX: 240,
      clientY: 180,
      dataTransfer: {
        getData: (type: string) =>
          type === FLOWFORGE_ELEMENT_DND_MIME ? JSON.stringify(element) : "",
      },
    });

    expect(await screen.findByRole("heading", { name: "Eligibility Filter" })).toBeInTheDocument();
    expect(screen.getByText(/Eligibility Filter added locally/i)).toBeInTheDocument();
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
      expect(screen.getByText("timeout minutes")).toBeInTheDocument();
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

    await userEvent.clear(screen.getByLabelText("timeout minutes"));
    await userEvent.type(screen.getByLabelText("timeout minutes"), "45");
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
                data: { timeout_minutes: 45, offer_mode: "sequential" },
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
