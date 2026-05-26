import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HealthDashboard from "./HealthDashboard";

const mocks = vi.hoisted(() => ({
  useHealthCheck: vi.fn(),
  refreshNow: vi.fn(),
}));

vi.mock("@/features/system-admin/hooks", () => ({
  useHealthCheck: mocks.useHealthCheck,
}));

vi.mock("./LatencyChart", () => ({
  default: () => <div data-testid="latency-chart" />,
}));

describe("HealthDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useHealthCheck.mockReturnValue({
      data: {
        overall: "degraded",
        checks: {
          app: { status: "ok" },
          mysql: { status: "ok", latency_ms: 8 },
          llms: {
            status: "degraded",
            workspace_id: "ws-1",
            total_count: 2,
            active_count: 2,
            healthy_count: 1,
            failed_count: 1,
            active_failed_count: 1,
            latency_ms: 41,
            llms: [
              {
                id: 11,
                name: "Planner GPT",
                provider: "openai",
                model: "gpt-4o",
                role: "planner",
                endpoint: "https://api.openai.com/v1",
                active: true,
                status: "ok",
                latency_ms: 32,
                message: "Connected",
              },
              {
                id: 12,
                name: "Local NER",
                provider: "ollama",
                model: "llama3.1",
                role: "ner",
                endpoint: "http://localhost:11434",
                active: true,
                status: "error",
                latency_ms: 50,
                message: "connection refused",
              },
            ],
            issues: ["1 workspace LLM configuration(s) failed health checks."],
          },
          qdrant: { status: "ok", latency_ms: 18 },
          mcp: { status: "ok", latency_ms: 12, url: "http://localhost:8001", version: "0.3.331" },
          broker: {
            status: "error",
            ok: false,
            broker_url: "redis://user:***@localhost:6379/0",
            valkey: {
              address: "localhost",
              port: 6379,
              ping_ok: true,
              ping_response: "True",
              error: null,
            },
            celery: {
              broker_connect_ok: false,
              broker_error: "connect timeout",
              worker_ping_ok: true,
              workers: ["celery@worker-1"],
              worker_error: null,
            },
          },
          flowforge: {
            status: "degraded",
            worker: {
              healthy: false,
              reason: "Last workflow worker heartbeat was 500s ago.",
              last_dispatch_at: "2026-05-05T10:00:00+00:00",
              seconds_since_dispatch: 500,
              task_name: "qf.flowforge.dispatch_notifications",
            },
            metrics: {
              pending_notification_count: 8,
              failed_notification_count: 2,
              stuck_run_count: 1,
              failed_run_count: 3,
              schedule_backlog_count: 4,
              failed_import_count: 5,
              failed_export_count: 6,
              stuck_approval_count: 7,
              invalid_production_run_as_count: 10,
              expired_artifact_count: 8,
              artifact_retention_pending_count: 9,
              workflow_intelligence_domain_drift_count: 1,
              stuck_run_threshold_minutes: 30,
              failed_run_window_hours: 24,
              schedule_backlog_threshold_minutes: 5,
              approval_stale_threshold_hours: 24,
            },
            workflow_intelligence_domains: [
              {
                domain_key: "flowforge_workflow_runs",
                read_model: "v_flowforge_report_workflow_runs",
                registration_status: "validated",
                registration_issues: [],
              },
              {
                domain_key: "flowforge_offer_outcomes",
                read_model: "v_flowforge_report_offer_outcomes",
                registration_status: "read_model_missing",
                registration_issues: ["read model missing from migration SQL"],
              },
            ],
            issues: [
              "Last workflow worker heartbeat was 500s ago.",
              "1 workflow run(s) appear stuck.",
              "1 Workflow Intelligence domain(s) have registration drift.",
            ],
          },
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      history: [],
      lastChecked: Date.now() - 5_000,
      refreshNow: mocks.refreshNow,
    });
  });

  it("renders celery broker diagnostics from detailed health payload", async () => {
    render(<HealthDashboard />);

    expect(screen.getByText("Valkey")).toBeInTheDocument();
    expect(screen.getByText("Broker")).toBeInTheDocument();
    expect(screen.getByText("MCP Server")).toBeInTheDocument();
    expect(screen.getByText("Workspace LLMs")).toBeInTheDocument();
    expect(screen.getByText("LLM Details")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText(/workspace LLM configuration\(s\) failed/i)).toBeInTheDocument();
    expect(screen.getByText("Planner GPT")).toBeInTheDocument();
    expect(screen.getByText("Local NER")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("connection refused")).toBeInTheDocument();
    expect(screen.getByText("Workflow Runtime")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:8001")).toBeInTheDocument();
    expect(screen.getByText("0.3.331")).toBeInTheDocument();
    expect(screen.getByText("localhost:6379")).toBeInTheDocument();
    expect(screen.getByText("True")).toBeInTheDocument();
    expect(screen.getByText("redis://user:***@localhost:6379/0")).toBeInTheDocument();
    expect(screen.getByText("celery@worker-1")).toBeInTheDocument();
    expect(screen.getByText(/Celery broker error: connect timeout/i)).toBeInTheDocument();
    expect(screen.getByText("qf.flowforge.dispatch_notifications")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(screen.getAllByText("8").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getByText("Schedule Backlog")).toBeInTheDocument();
    expect(screen.getByText("Failed Imports")).toBeInTheDocument();
    expect(screen.getByText("Failed Exports")).toBeInTheDocument();
    expect(screen.getByText("Stuck Approvals")).toBeInTheDocument();
    expect(screen.getByText("Invalid Run-As")).toBeInTheDocument();
    expect(screen.getByText("Retention Pending")).toBeInTheDocument();
    expect(screen.getByText("Domain Drift")).toBeInTheDocument();
    expect(screen.getByText("flowforge_offer_outcomes")).toBeInTheDocument();
    expect(screen.getByText(/read_model_missing/i)).toBeInTheDocument();
    expect(screen.getByText(/registration drift/i)).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("9").length).toBeGreaterThan(0);
    expect(screen.getByText(/workflow run\(s\) appear stuck/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show details/i })).not.toBeInTheDocument();
  });

  it("does not render broker card when broker check is absent", () => {
    mocks.useHealthCheck.mockReturnValue({
      data: {
        overall: "healthy",
        checks: {
          app: { status: "ok" },
          mysql: { status: "ok", latency_ms: 8 },
          llms: {
            status: "ok",
            total_count: 1,
            active_count: 1,
            healthy_count: 1,
            failed_count: 0,
            latency_ms: 41,
            llms: [],
          },
          qdrant: { status: "ok", latency_ms: 18 },
          mcp: { status: "ok", latency_ms: 12 },
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      history: [],
      lastChecked: Date.now(),
      refreshNow: mocks.refreshNow,
    });

    render(<HealthDashboard />);

    expect(screen.queryByText("Valkey")).not.toBeInTheDocument();
    expect(screen.queryByText("Broker")).not.toBeInTheDocument();
  });

  it("renders degraded placeholders instead of crashing when core checks are missing", () => {
    mocks.useHealthCheck.mockReturnValue({
      data: {
        overall: "degraded",
        checks: {
          app: { status: "ok" },
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      history: [
        {
          timestamp: Date.now() - 30_000,
          data: {
            overall: "degraded",
            checks: {
              app: { status: "ok" },
            },
          },
        },
      ],
      lastChecked: Date.now(),
      refreshNow: mocks.refreshNow,
    });

    render(<HealthDashboard />);

    expect(screen.getByText("App")).toBeInTheDocument();
    expect(screen.getByText("MySQL")).toBeInTheDocument();
    expect(screen.getByText("Qdrant")).toBeInTheDocument();
    expect(screen.getAllByText("Degraded")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /show error/i })).toHaveLength(2);
  });
});
