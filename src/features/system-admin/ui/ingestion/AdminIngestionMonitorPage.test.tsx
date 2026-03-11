import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminIngestionMonitorPage from "./AdminIngestionMonitorPage";

const mocks = vi.hoisted(() => ({
  getIngestionHistory: vi.fn(),
  getIngestionStatus: vi.fn(),
  getIngestionDiagnostics: vi.fn(),
  cancelIngestionRun: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@/shared/services/ingestion", () => ({
  getIngestionHistory: mocks.getIngestionHistory,
  getIngestionStatus: mocks.getIngestionStatus,
  getIngestionDiagnostics: mocks.getIngestionDiagnostics,
  cancelIngestionRun: mocks.cancelIngestionRun,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

function buildRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    datasource: "warehouse",
    catalog: null,
    schema_name: "public",
    table_names: null,
    run_profiling: false,
    run_enrichment: false,
    status: "running",
    tables_total: 10,
    tables_done: 4,
    tables_failed: 0,
    tables_created: 2,
    tables_updated: 2,
    columns_total: 20,
    columns_done: 10,
    columns_failed: 0,
    columns_created: 8,
    columns_updated: 2,
    current_phase: "upserting_columns",
    current_table: "students",
    current_column: "student_id",
    error: null,
    started_at: "2026-03-10T10:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
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
        <AdminIngestionMonitorPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function sleep(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe("AdminIngestionMonitorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIngestionHistory.mockResolvedValue([buildRun()]);
    mocks.getIngestionStatus.mockResolvedValue(buildRun());
    mocks.getIngestionDiagnostics.mockResolvedValue({
      celery_state: "STARTED",
      in_worker_queues: ["ingestion"],
      age_seconds: 120,
      stale_candidate: true,
      stale_threshold_seconds: 300,
    });
    mocks.cancelIngestionRun.mockResolvedValue({
      canceled: true,
      message: "Cancel request submitted.",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders diagnostics fields", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: /ingestion monitor/i })).toBeInTheDocument();
    expect(await screen.findByText("STARTED")).toBeInTheDocument();
    expect(screen.getByText("ingestion")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("stale candidate")).toBeInTheDocument();
  });

  it("hides cancel button for terminal statuses", async () => {
    mocks.getIngestionHistory.mockResolvedValue([buildRun({ status: "completed", completed_at: "2026-03-10T10:20:00.000Z" })]);
    mocks.getIngestionStatus.mockResolvedValue(buildRun({ status: "completed", completed_at: "2026-03-10T10:20:00.000Z" }));

    renderPage();

    await screen.findByText("completed");
    expect(screen.queryByRole("button", { name: /cancel run/i })).not.toBeInTheDocument();
  });

  it("cancels a run and refreshes history, status, and diagnostics", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("running");

    await user.click(screen.getByRole("button", { name: /cancel run/i }));
    const dialog = await screen.findByRole("dialog", { name: /cancel ingestion run/i });
    await user.click(within(dialog).getByRole("button", { name: /^cancel run$/i }));

    await waitFor(() => {
      expect(mocks.cancelIngestionRun).toHaveBeenCalledWith("job-1");
    });
    await waitFor(() => {
      expect(mocks.getIngestionHistory.mock.calls.length).toBeGreaterThan(1);
      expect(mocks.getIngestionStatus.mock.calls.length).toBeGreaterThan(1);
      expect(mocks.getIngestionDiagnostics.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("stops polling when auto-poll is turned off", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("running");
    const initialCalls = mocks.getIngestionStatus.mock.calls.length;

    await sleep(5_200);

    expect(mocks.getIngestionStatus.mock.calls.length).toBeGreaterThan(initialCalls);

    await user.click(screen.getByLabelText(/auto poll/i));
    await sleep(150);

    const callsAfterToggleOff = mocks.getIngestionStatus.mock.calls.length;

    await sleep(5_500);

    expect(mocks.getIngestionStatus.mock.calls.length).toBe(callsAfterToggleOff);
  }, 20_000);
});
