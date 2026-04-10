import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import SyncProgressMonitor from "../components/SyncProgressMonitor";
import { server } from "../../../../qa/msw/server";

const RUNNING_JOB = {
  id: "job-1",
  datasource: "primary",
  catalog: null,
  schema_name: "asset",
  table_names: null,
  run_profiling: false,
  run_enrichment: false,
  status: "running",
  tables_total: 10,
  tables_done: 3,
  tables_failed: 0,
  tables_created: 2,
  tables_updated: 1,
  columns_total: 100,
  columns_done: 30,
  columns_failed: 0,
  columns_created: 30,
  columns_updated: 0,
  current_phase: "upserting_columns",
  current_table: "asset",
  current_column: "customer_id",
  error: null,
  started_at: new Date(Date.now() - 60_000).toISOString(),
  completed_at: null,
};

const COMPLETED_JOB = {
  ...RUNNING_JOB,
  status: "completed",
  tables_done: 10,
  tables_created: 6,
  tables_updated: 2,
  columns_created: 100,
  columns_updated: 5,
  current_phase: "completed",
  current_table: null,
  current_column: null,
  completed_at: new Date().toISOString(),
};

const FAILED_JOB = {
  ...RUNNING_JOB,
  status: "failed",
  error: "Connection refused",
};

const statusPath =
  /^https?:\/\/[^/]+(?:\/api\/v1)?\/ingestion\/status\/[^/]+\/?$/;

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderMonitor = (
  jobId: string,
  onNewSync = vi.fn(),
  onBackToSyncSetup = vi.fn(),
) => {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SyncProgressMonitor
        jobId={jobId}
        onNewSync={onNewSync}
        onBackToSyncSetup={onBackToSyncSetup}
      />
    </QueryClientProvider>,
  );
};

describe("SyncProgressMonitor", () => {

  afterEach(() => {
    server.resetHandlers();
  });

  it("renders progress bar and counts while running", async () => {
    server.use(http.get(statusPath, () => HttpResponse.json(RUNNING_JOB)));

    renderMonitor("job-1");

    // 3/10 * 100 = 30
    const progressBars = await screen.findAllByRole("progressbar");
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "30");
    expect(progressBars[1]).toHaveAttribute("aria-valuenow", "30");

    expect(screen.getByText("3 / 10 tables")).toBeInTheDocument();
    expect(screen.getByText("30 / 100 columns")).toBeInTheDocument();
    expect(screen.getByText("70 remaining")).toBeInTheDocument();
    expect(screen.getByText("Phase: upserting columns")).toBeInTheDocument();
    expect(screen.getByText(/asset\.customer_id/i)).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("renders success summary when completed", async () => {
    server.use(http.get(statusPath, () => HttpResponse.json(COMPLETED_JOB)));

    renderMonitor("job-1");

    expect(await screen.findByText(/sync complete\./i)).toBeInTheDocument();
    expect(screen.getByText(/profiled 2 table\(s\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/ai-enriched 5 column description\(s\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start new sync/i }),
    ).toBeInTheDocument();
  });

  it("renders warning details when completed with warnings", async () => {
    server.use(
      http.get(statusPath, () =>
        HttpResponse.json({
          ...COMPLETED_JOB,
          error: "Completed with warnings: profiling_errors=1, enrichment_errors=2",
        }),
      ),
    );

    renderMonitor("job-1");

    expect(
      await screen.findByText(/completed with warnings: profiling_errors=1/i),
    ).toBeInTheDocument();
  });

  it("renders error when job failed", async () => {
    server.use(http.get(statusPath, () => HttpResponse.json(FAILED_JOB)));

    renderMonitor("job-1");

    expect(await screen.findByText("Connection refused")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start new sync/i }),
    ).toBeInTheDocument();
  });

  it("calls onNewSync when Start New Sync clicked", async () => {
    server.use(http.get(statusPath, () => HttpResponse.json(COMPLETED_JOB)));

    const onNewSync = vi.fn();
    const user = userEvent.setup();
    renderMonitor("job-1", onNewSync);

    await screen.findByText(/sync complete\./i);
    await user.click(screen.getByRole("button", { name: /start new sync/i }));

    expect(onNewSync).toHaveBeenCalledOnce();
  });

  it("calls onBackToSyncSetup when Back to Sync Setup clicked", async () => {
    server.use(http.get(statusPath, () => HttpResponse.json(RUNNING_JOB)));

    const onBackToSyncSetup = vi.fn();
    const user = userEvent.setup();
    renderMonitor("job-1", vi.fn(), onBackToSyncSetup);

    await screen.findByText("running");
    await user.click(
      screen.getByRole("button", { name: /back to sync setup/i }),
    );

    expect(onBackToSyncSetup).toHaveBeenCalledOnce();
  });
});
