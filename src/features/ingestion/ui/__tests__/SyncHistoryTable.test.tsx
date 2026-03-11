import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import SyncHistoryTable from "../components/SyncHistoryTable";
import { server } from "../../../../qa/msw/server";

const BASE_JOB = {
  id: "job-1",
  datasource: "primary",
  catalog: null,
  schema_name: "asset",
  table_names: null,
  run_profiling: false,
  run_enrichment: false,
  status: "running" as const,
  tables_total: 10,
  tables_done: 3,
  tables_failed: 0,
  tables_created: 2,
  tables_updated: 1,
  columns_created: 30,
  columns_updated: 0,
  error: null,
  started_at: new Date(Date.now() - 60_000).toISOString(),
  completed_at: null,
};

const COMPLETED_JOB = {
  ...BASE_JOB,
  id: "job-1",
  status: "completed" as const,
  tables_done: 10,
  tables_created: 6,
  tables_updated: 4,
  columns_created: 100,
  columns_updated: 20,
  completed_at: new Date().toISOString(),
};

const RUNNING_JOB = {
  ...BASE_JOB,
  id: "job-2",
};

const historyPath = /^https?:\/\/[^/]+(?:\/api\/v1)?\/ingestion\/history\/?$/;

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderTable = (onSelectRun = vi.fn()) => {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SyncHistoryTable onSelectRun={onSelectRun} />
    </QueryClientProvider>,
  );
};

describe("SyncHistoryTable", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("renders history rows", async () => {
    server.use(
      http.get(historyPath, () =>
        HttpResponse.json([COMPLETED_JOB, RUNNING_JOB]),
      ),
    );

    renderTable();

    // datasource column value
    const primaryCells = await screen.findAllByText("primary");
    expect(primaryCells.length).toBeGreaterThan(0);

    // completed badge
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("renders empty state when no history", async () => {
    server.use(http.get(historyPath, () => HttpResponse.json([])));

    renderTable();

    expect(await screen.findByText("No sync runs yet.")).toBeInTheDocument();
  });

  it("calls onSelectRun when row is clicked", async () => {
    server.use(http.get(historyPath, () => HttpResponse.json([COMPLETED_JOB])));

    const onSelectRun = vi.fn();
    const user = userEvent.setup();
    renderTable(onSelectRun);

    // Wait for row to appear
    await screen.findByText("primary");

    const row = screen.getAllByRole("row")[1]; // index 0 is thead tr
    await user.click(row);

    await waitFor(() => {
      expect(onSelectRun).toHaveBeenCalledWith(COMPLETED_JOB.id);
    });
  });
});
