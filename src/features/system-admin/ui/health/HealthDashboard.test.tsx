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
          vllm: { status: "ok", latency_ms: 41, model: "qwen" },
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
              reason: "Last FlowForge worker heartbeat was 500s ago.",
              last_dispatch_at: "2026-05-05T10:00:00+00:00",
              seconds_since_dispatch: 500,
              task_name: "qf.flowforge.dispatch_notifications",
            },
            metrics: {
              pending_notification_count: 8,
              failed_notification_count: 2,
              stuck_run_count: 1,
              failed_run_count: 3,
              stuck_run_threshold_minutes: 30,
              failed_run_window_hours: 24,
            },
            issues: ["Last FlowForge worker heartbeat was 500s ago.", "1 workflow run(s) appear stuck."],
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
    expect(screen.getByText("Celery Broker")).toBeInTheDocument();
    expect(screen.getByText("MCP Server")).toBeInTheDocument();
    expect(screen.getByText("FlowForge Runtime")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:8001")).toBeInTheDocument();
    expect(screen.getByText("0.3.331")).toBeInTheDocument();
    expect(screen.getByText("localhost:6379")).toBeInTheDocument();
    expect(screen.getByText("True")).toBeInTheDocument();
    expect(screen.getByText("redis://user:***@localhost:6379/0")).toBeInTheDocument();
    expect(screen.getByText("celery@worker-1")).toBeInTheDocument();
    expect(screen.getByText(/Celery broker error: connect timeout/i)).toBeInTheDocument();
    expect(screen.getByText("qf.flowforge.dispatch_notifications")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
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
          vllm: { status: "ok", latency_ms: 41, model: "qwen" },
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
    expect(screen.queryByText("Celery Broker")).not.toBeInTheDocument();
  });
});
