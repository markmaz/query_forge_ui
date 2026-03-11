import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useSyncJob } from "../useSyncJob";
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
  columns_created: 30,
  columns_updated: 0,
  error: null,
  started_at: new Date(Date.now() - 60_000).toISOString(),
  completed_at: null,
};

const COMPLETED_JOB = {
  ...RUNNING_JOB,
  status: "completed",
  tables_done: 10,
  tables_created: 6,
  tables_updated: 4,
  columns_created: 100,
  columns_updated: 20,
  completed_at: new Date().toISOString(),
};

const statusPath =
  /^https?:\/\/[^/]+(?:\/api\/v1)?\/ingestion\/status\/[^/]+\/?$/;

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useSyncJob", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    // Clear sessionStorage between tests to prevent cross-test leakage
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it("starts polling when enabled and jobId provided", async () => {
    server.use(http.get(statusPath, () => HttpResponse.json(RUNNING_JOB)));

    const { result } = renderHook(() => useSyncJob("job-1", true), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.status).toBe("running");
    });

    expect(result.current.isPolling).toBe(true);
  });

  it("stops polling when status is completed", async () => {
    server.use(http.get(statusPath, () => HttpResponse.json(COMPLETED_JOB)));

    const { result } = renderHook(() => useSyncJob("job-1", true), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.status).toBe("completed");
    });

    expect(result.current.isPolling).toBe(false);
  });

  it("does not poll when enabled is false", async () => {
    // No handler needed — if a request fires the server will error (onUnhandledRequest: "error")
    const fetchSpy = vi.fn();
    server.use(
      http.get(statusPath, () => {
        fetchSpy();
        return HttpResponse.json(RUNNING_JOB);
      }),
    );

    const { result } = renderHook(() => useSyncJob("job-1", false), {
      wrapper: makeWrapper(),
    });

    // Give React Query a tick to attempt any fetch
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.status).toBeNull();
    expect(result.current.isPolling).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
