import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { routes } from "@/app/navigation/routes";
import {
  getFlowForgeDatasetArtifact,
  listFlowForgeDataMovementAudit,
  listFlowForgeDatasetArtifacts,
} from "../api/dataMovementApi";
import { getFlowForgeReportDashboard } from "../api/reportsApi";
import {
  addFlowForgeRunNote,
  approveFlowForgeHumanTask,
  declineFlowForgeHumanTask,
  getFlowForgeRun,
  listFlowForgeHumanTasks,
  listFlowForgeRunEvents,
  listFlowForgeRunHumanTasks,
  listFlowForgeRunNotifications,
  listFlowForgeRuns,
} from "../api/runsApi";
import {
  completeFlowForgePublicSignedAction,
  getFlowForgePublicSignedActionDetails,
} from "../api/publicActionsApi";
import FlowForgeNeedsAttentionPage from "../ui/FlowForgeNeedsAttentionPage";
import FlowForgePublicActionPage from "../ui/FlowForgePublicActionPage";
import FlowForgeReportsPage from "../ui/FlowForgeReportsPage";
import FlowForgeRunDetailPage from "../ui/FlowForgeRunDetailPage";
import FlowForgeRunsPage from "../ui/FlowForgeRunsPage";

vi.mock("../api/reportsApi", () => ({
  getFlowForgeReportDashboard: vi.fn(),
}));

vi.mock("../api/dataMovementApi", () => ({
  getFlowForgeDatasetArtifact: vi.fn(),
  listFlowForgeDataMovementAudit: vi.fn(),
  listFlowForgeDatasetArtifacts: vi.fn(),
}));

vi.mock("../api/runsApi", () => ({
  addFlowForgeRunNote: vi.fn(),
  approveFlowForgeHumanTask: vi.fn(),
  declineFlowForgeHumanTask: vi.fn(),
  getFlowForgeRun: vi.fn(),
  listFlowForgeHumanTasks: vi.fn(),
  listFlowForgeRunEvents: vi.fn(),
  listFlowForgeRunHumanTasks: vi.fn(),
  listFlowForgeRunNotifications: vi.fn(),
  listFlowForgeRuns: vi.fn(),
}));

vi.mock("../api/publicActionsApi", () => ({
  completeFlowForgePublicSignedAction: vi.fn(),
  getFlowForgePublicSignedActionDetails: vi.fn(),
}));

vi.mock("@/shared/runtime/useCan", () => ({
  useCan: () => ({
    hasRole: (feature: string, role: string) =>
      feature === "flowforge" && ["admin", "operator"].includes(role),
  }),
}));

const run = {
  id: 90,
  workspace_id: "ws-1",
  workflow_definition_id: 12,
  workflow_version_id: 13,
  intake_event_id: 501,
  mode: "test",
  status: "waiting",
  current_node_id: "offer",
  idempotency_key: "run-90",
  run_context: { trigger_key: "intake-routing", candidate_count: 2 },
  created_at: "2026-05-05T10:00:00Z",
  updated_at: "2026-05-05T10:05:00Z",
};

const needsAttentionRun = {
  ...run,
  id: 91,
  status: "needs_attention",
  current_node_id: "no_match",
  run_context: { no_match_reason: "No eligible resources." },
};

function renderWithClient(ui: ReactElement, initialEntries = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FlowForge runtime pages", () => {
  beforeEach(() => {
    vi.mocked(listFlowForgeRuns).mockResolvedValue({
      workspace_id: "ws-1",
      status: null,
      mode: null,
      limit: 100,
      offset: 0,
      runs: [run],
    });
    vi.mocked(listFlowForgeHumanTasks).mockResolvedValue({
      workspace_id: "ws-1",
      task_type: "approval",
      status: "pending,waiting",
      limit: 100,
      offset: 0,
      tasks: [],
    });
    vi.mocked(approveFlowForgeHumanTask).mockResolvedValue({
      human_task_id: 401,
      run_id: 90,
      action: "approve",
      status: "approved",
      runtime: { status: "advanced", to_node_id: "export" },
    });
    vi.mocked(declineFlowForgeHumanTask).mockResolvedValue({
      human_task_id: 401,
      run_id: 90,
      action: "decline",
      status: "declined",
      runtime: { status: "failed", reason: "approval_declined" },
    });
    vi.mocked(getFlowForgeRun).mockResolvedValue(run);
    vi.mocked(listFlowForgeRunEvents).mockResolvedValue({
      workspace_id: "ws-1",
      run_id: 90,
      limit: 200,
      events: [
        {
          id: 801,
          workspace_id: "ws-1",
          run_id: 90,
          event_type: "workflow.run.created",
          node_id: "intake",
          message: "Workflow run created from integration trigger.",
          event_payload: { trigger_key: "intake-routing" },
          actor_type: "system",
          actor_id: "flowforge",
          created_at: "2026-05-05T10:00:00Z",
        },
        {
          id: 802,
          workspace_id: "ws-1",
          run_id: 90,
          event_type: "workflow.matching.candidates_selected",
          node_id: "match",
          message: "Candidate queue created.",
          event_payload: { candidate_count: 2 },
          actor_type: "system",
          actor_id: "flowforge",
          created_at: "2026-05-05T10:01:00Z",
        },
      ],
    });
    vi.mocked(listFlowForgeRunHumanTasks).mockResolvedValue({
      workspace_id: "ws-1",
      run_id: 90,
      limit: 100,
      tasks: [
        {
          id: 301,
          workspace_id: "ws-1",
          run_id: 90,
          task_type: "offer",
          resource_set_id: 20,
          source_record_key: "therapist-1",
          status: "pending",
          assigned_to_principal_type: "resource",
          assigned_to_principal_id: "therapist-1",
          due_at: "2026-05-05T12:00:00Z",
          completed_at: null,
          response: { allowed_actions: ["accept", "decline"] },
          created_at: "2026-05-05T10:02:00Z",
        },
      ],
    });
    vi.mocked(listFlowForgeRunNotifications).mockResolvedValue({
      workspace_id: "ws-1",
      run_id: 90,
      limit: 100,
      notifications: [
        {
          id: 701,
          workspace_id: "ws-1",
          run_id: 90,
          human_task_id: 301,
          channel: "email",
          recipient: "therapist@example.com",
          template_key: "flowforge.human_task",
          status: "pending",
          payload_summary: { source_record_key: "therapist-1" },
          created_at: "2026-05-05T10:02:00Z",
        },
      ],
    });
    vi.mocked(addFlowForgeRunNote).mockResolvedValue({
      id: 803,
      workspace_id: "ws-1",
      run_id: 90,
      event_type: "workflow.operator.note",
      node_id: null,
      message: "Operator note added.",
      event_payload: { note: "Called coordinator." },
      actor_type: "user",
      actor_id: "user-1",
      created_at: "2026-05-05T10:10:00Z",
    });
    vi.mocked(listFlowForgeDatasetArtifacts).mockResolvedValue({
      run_id: 90,
      limit: 50,
      offset: 0,
      artifacts: [
        {
          id: 701,
          workspace_id: "ws-1",
          run_id: 90,
          node_id: "import",
          artifact_key: "run:90:node:import",
          artifact_type: "import",
          storage_kind: "preview_metadata",
          storage_ref: { rows: [{ display_name: "Missing Key" }] },
          schema: { validation: { invalid_row_count: 1, invalid_rows: [{ row_number: 1, error: "Missing source_record_key" }] } },
          row_count: 1,
          byte_count: 22,
          checksum: "def",
          status: "validation_failed",
          created_at: "2026-05-05T10:04:00Z",
        },
      ],
    });
    vi.mocked(getFlowForgeDatasetArtifact).mockResolvedValue({
      id: 701,
      workspace_id: "ws-1",
      run_id: 90,
      node_id: "import",
      artifact_key: "run:90:node:import",
      artifact_type: "import",
      storage_kind: "preview_metadata",
      storage_ref: { rows: [{ display_name: "Missing Key" }] },
      schema: { validation: { invalid_row_count: 1, invalid_rows: [{ row_number: 1, error: "Missing source_record_key" }] } },
      row_count: 1,
      byte_count: 22,
      checksum: "def",
      status: "validation_failed",
      created_at: "2026-05-05T10:04:00Z",
    });
    vi.mocked(listFlowForgeDataMovementAudit).mockResolvedValue({
      run_id: 90,
      limit: 50,
      offset: 0,
      audit: [
        {
          id: 901,
          workspace_id: "ws-1",
          run_id: 90,
          node_id: "import",
          action_type: "import",
          status: "failed",
          source_key: "local-import",
          destination_key: null,
          dataset_artifact_id: 701,
          resource_set_id: 20,
          actor_type: "system",
          actor_id: "flowforge",
          request: { filename: "resources.csv" },
          result: { artifact_id: 701 },
          error_message: "Import contains invalid rows.",
        },
      ],
    });
    vi.mocked(getFlowForgeReportDashboard).mockResolvedValue({
      workspace_id: "ws-1",
      mode: "production",
      default_filters: [{ field: "mode", operator: "equals", value: "production" }],
      metrics: {
        run_count: 8,
        completed_run_count: 4,
        needs_attention_count: 1,
        assignment_count: 3,
        no_match_outcome_count: 2,
        failed_notification_count: 1,
      },
      domains: [
        {
          workspace_id: "ws-1",
          domain_key: "flowforge_workflow_runs",
          display_name: "FlowForge Workflow Runs",
          description: "Workspace-scoped workflow run status and outcomes.",
          read_model: "v_flowforge_report_workflow_runs",
          semantic_registered: true,
          default_filters: [{ field: "mode", operator: "equals", value: "production" }],
          sensitive_excluded_fields: ["run_context_json", "idempotency_key"],
          query_studio_prompts: ["How many FlowForge runs completed this week?"],
          metrics: [{ key: "run_count", label: "Run Count" }],
          dimensions: [{ key: "status", label: "Run Status" }],
        },
        {
          workspace_id: "ws-1",
          domain_key: "flowforge_intake_events",
          display_name: "FlowForge Intake Events",
          description: "Safe intake metadata without raw payloads.",
          read_model: "v_flowforge_report_intake_events",
          semantic_registered: true,
          default_filters: [{ field: "mode", operator: "equals", value: "production" }],
          sensitive_excluded_fields: ["raw_payload_json", "normalized_payload_json"],
          query_studio_prompts: ["How many intakes were received?"],
          metrics: [{ key: "intake_event_count", label: "Intake Event Count" }],
          dimensions: [{ key: "provider", label: "Provider" }],
        },
      ],
    });
    vi.mocked(getFlowForgePublicSignedActionDetails).mockResolvedValue({
      valid: true,
      allowed_actions: ["accept", "decline"],
      expires_at: "2026-05-06T18:00:00Z",
      task: {
        task_type: "offer",
        status: "pending",
        source_record_key: "therapist-1",
      },
    });
    vi.mocked(completeFlowForgePublicSignedAction).mockResolvedValue({
      accepted: true,
      action: "accept",
      task: {
        task_type: "offer",
        status: "accepted",
        source_record_key: "therapist-1",
      },
    });
  });

  it("renders the run list with filters and links", async () => {
    renderWithClient(<FlowForgeRunsPage />);

    expect(await screen.findByRole("heading", { name: "Workflow Runs" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Run 90" })).toHaveAttribute(
      "href",
      routes.FlowForgeRunDetail.replace(":runId", "90"),
    );
    expect(screen.getAllByText("waiting").length).toBeGreaterThan(0);
    expect(screen.getByText(/trigger_key: intake-routing/i)).toBeInTheDocument();
  });

  it("filters the needs-attention page to needs_attention runs", async () => {
    vi.mocked(listFlowForgeRuns).mockResolvedValueOnce({
      workspace_id: "ws-1",
      status: "needs_attention",
      mode: null,
      limit: 100,
      offset: 0,
      runs: [needsAttentionRun],
    });

    renderWithClient(<FlowForgeNeedsAttentionPage />);

    expect(await screen.findByRole("heading", { name: "Needs Attention" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Run 91" })).toBeInTheDocument();
    await waitFor(() => {
      expect(listFlowForgeRuns).toHaveBeenCalledWith({ status: "needs_attention", limit: 100, offset: 0 });
    });
    expect(listFlowForgeHumanTasks).toHaveBeenCalledWith({
      task_type: "approval",
      status: "pending,waiting",
      limit: 100,
      offset: 0,
    });
  });

  it("shows approval gates in needs-attention and approves them", async () => {
    vi.mocked(listFlowForgeRuns).mockResolvedValueOnce({
      workspace_id: "ws-1",
      status: "needs_attention",
      mode: null,
      limit: 100,
      offset: 0,
      runs: [],
    });
    vi.mocked(listFlowForgeHumanTasks).mockResolvedValueOnce({
      workspace_id: "ws-1",
      task_type: "approval",
      status: "pending,waiting",
      limit: 100,
      offset: 0,
      tasks: [
        {
          id: 401,
          workspace_id: "ws-1",
          run_id: 90,
          task_type: "approval",
          resource_set_id: null,
          source_record_key: null,
          status: "waiting",
          assigned_to_principal_type: "group",
          assigned_to_principal_id: "flowforge:operator",
          due_at: "2026-05-05T12:00:00Z",
          completed_at: null,
          response: {
            allowed_actions: ["approve", "decline"],
            approval: {
              approval_reason: "Review export before delivery.",
              destination_key: "ops-export",
              artifact: { artifact_key: "run:90:node:query_extract", artifact_type: "query_extract" },
            },
          },
          created_at: "2026-05-05T10:02:00Z",
        },
      ],
    });

    renderWithClient(
      <Routes>
        <Route path={routes.FlowForgeNeedsAttention} element={<FlowForgeNeedsAttentionPage />} />
        <Route path={routes.FlowForgeRunDetail} element={<FlowForgeRunDetailPage />} />
      </Routes>,
      [routes.FlowForgeNeedsAttention],
    );

    expect(await screen.findByRole("heading", { name: "Needs Attention" })).toBeInTheDocument();
    expect(await screen.findByText("Review export before delivery.")).toBeInTheDocument();
    expect(screen.getByText("ops-export")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run 90" })).toHaveAttribute("href", routes.FlowForgeRunDetail.replace(":runId", "90"));

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog", { name: "Approve Gate" });
    expect(dialog).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Decision note"), "Reviewed artifact.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(approveFlowForgeHumanTask).toHaveBeenCalledWith(401, {
        decision_note: "Reviewed artifact.",
      });
    });
  });

  it("shows run timeline, human tasks, notifications, matching explanation, and saves notes", async () => {
    renderWithClient(
      <Routes>
        <Route path={routes.FlowForgeRunDetail} element={<FlowForgeRunDetailPage />} />
      </Routes>,
      [routes.FlowForgeRunDetail.replace(":runId", "90")],
    );

    expect(await screen.findByRole("heading", { name: "Run 90" })).toBeInTheDocument();
    expect(await screen.findByText("workflow.run.created")).toBeInTheDocument();
    expect(screen.getAllByText("therapist-1").length).toBeGreaterThan(0);
    expect(screen.getByText("flowforge.human_task")).toBeInTheDocument();
    expect(screen.getByText("1 matching/runtime events")).toBeInTheDocument();
    expect(await screen.findByText("run:90:node:import")).toBeInTheDocument();
    expect(screen.getByText("Data Movement Audit")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Add operator note"), "Called coordinator.");
    await userEvent.click(screen.getByRole("button", { name: "Save Note" }));

    await waitFor(() => {
      expect(addFlowForgeRunNote).toHaveBeenCalledWith(
        90,
        expect.objectContaining({ note: "Called coordinator." }),
      );
    });
  });

  it("renders reporting metrics, semantic domains, sensitive exclusions, and Query Studio links", async () => {
    renderWithClient(<FlowForgeReportsPage />);

    expect(await screen.findByRole("heading", { name: "Operational Outcomes" })).toBeInTheDocument();
    expect((await screen.findAllByText("FlowForge Workflow Runs")).length).toBeGreaterThan(0);
    expect(screen.getByText("v_flowforge_report_workflow_runs")).toBeInTheDocument();
    expect(screen.getByText(/run_context_json/i)).toBeInTheDocument();
    expect(screen.getByText(/raw_payload_json/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How many FlowForge runs completed this week?" })).toHaveAttribute(
      "href",
      expect.stringContaining(routes.NoCodeQueryBuilder),
    );
    await waitFor(() => {
      expect(getFlowForgeReportDashboard).toHaveBeenCalledWith("production");
    });
  });

  it("confirms a public signed action from the email action link", async () => {
    renderWithClient(
      <Routes>
        <Route path="/flowforge/actions/:token" element={<FlowForgePublicActionPage />} />
      </Routes>,
      ["/flowforge/actions/ffact_123?action=accept"],
    );

    expect(await screen.findByRole("heading", { name: "Accept task" })).toBeInTheDocument();
    expect(screen.getByText("therapist-1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirm Accept" }));

    await waitFor(() => {
      expect(completeFlowForgePublicSignedAction).toHaveBeenCalledWith({
        token: "ffact_123",
        action: "accept",
        payload: {},
      });
    });
    expect(await screen.findByRole("heading", { name: "Accept recorded" })).toBeInTheDocument();
  });
});
