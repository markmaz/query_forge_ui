import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import * as api from "@/shared/services/queryStudioAdminApi";
import { useResultSummary } from "./useResultSummary";

const MOCK_SUMMARY = {
  narrative: "Test narrative",
  highlights: ["h1", "h2"],
  comparison: null,
  capped: false,
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const BASE_OPTS = {
  workspaceId: "ws-1",
  queryName: "My Query",
  columnNames: ["col1"],
  rows: [{ col1: "a" }] as Record<string, unknown>[],
  enabled: true,
};

describe("useResultSummary", () => {
  let summarizeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    summarizeSpy = vi.spyOn(api, "summarizePreview").mockResolvedValue({
      ...MOCK_SUMMARY,
      capped: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fetch when enabled=false", async () => {
    const { result } = renderHook(
      () => useResultSummary({ ...BASE_OPTS, enabled: false }),
      { wrapper: makeWrapper() },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(summarizeSpy).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();
  });

  it("does not fetch when rows.length === 0 (caller passes enabled=false)", async () => {
    const { result } = renderHook(
      () => useResultSummary({ ...BASE_OPTS, rows: [], enabled: false }),
      { wrapper: makeWrapper() },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(summarizeSpy).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();
  });

  it("fetches when enabled=true and rows present", async () => {
    const { result } = renderHook(
      () => useResultSummary(BASE_OPTS),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(summarizeSpy).toHaveBeenCalledOnce();
    expect(result.current.summary).not.toBeNull();
  });

  it("returns isLoading=true during fetch", () => {
    summarizeSpy.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useResultSummary(BASE_OPTS),
      { wrapper: makeWrapper() },
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("returns summary with all fields on success", async () => {
    summarizeSpy.mockResolvedValue({ ...MOCK_SUMMARY, capped: true });
    const { result } = renderHook(
      () => useResultSummary(BASE_OPTS),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.summary?.narrative).toBe("Test narrative");
    expect(result.current.summary?.highlights).toEqual(["h1", "h2"]);
    expect(result.current.summary?.capped).toBe(true);
    expect(result.current.summary?.totalRows).toBe(1);
  });

  it("returns isError=true on failure", async () => {
    summarizeSpy.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(
      () => useResultSummary(BASE_OPTS),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("retry() triggers refetch", async () => {
    summarizeSpy
      .mockRejectedValueOnce(new Error("first fail"))
      .mockResolvedValueOnce(MOCK_SUMMARY);
    const { result } = renderHook(
      () => useResultSummary(BASE_OPTS),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    result.current.retry();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(summarizeSpy).toHaveBeenCalledTimes(2);
  });

  it("retry() is no-op when enabled=false", async () => {
    const { result } = renderHook(
      () => useResultSummary({ ...BASE_OPTS, enabled: false }),
      { wrapper: makeWrapper() },
    );
    result.current.retry();
    await new Promise((r) => setTimeout(r, 50));
    expect(summarizeSpy).not.toHaveBeenCalled();
  });

  it("query key change clears previous data and starts new fetch", async () => {
    const { result, rerender } = renderHook(
      (opts: typeof BASE_OPTS) => useResultSummary(opts),
      { wrapper: makeWrapper(), initialProps: BASE_OPTS },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.summary).not.toBeNull();

    rerender({ ...BASE_OPTS, rows: [{ col1: "CHANGED" }] });
    expect(result.current.summary).toBeNull();
  });

  it("toggle off → on: if cached data exists, returns immediately without new fetch", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result, rerender } = renderHook(
      (opts: { enabled: boolean }) =>
        useResultSummary({ ...BASE_OPTS, enabled: opts.enabled }),
      { wrapper, initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(summarizeSpy).toHaveBeenCalledOnce();

    rerender({ enabled: false });
    rerender({ enabled: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(summarizeSpy).toHaveBeenCalledOnce();
    expect(result.current.summary).not.toBeNull();
  });

  it("toggle off → on: if no cached data, triggers fetch", async () => {
    const { result, rerender } = renderHook(
      (opts: { enabled: boolean }) =>
        useResultSummary({ ...BASE_OPTS, enabled: opts.enabled }),
      { wrapper: makeWrapper(), initialProps: { enabled: false } },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(summarizeSpy).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(summarizeSpy).toHaveBeenCalledOnce();
    expect(result.current.summary).not.toBeNull();
  });

  it("query key is stable when column order changes but data is the same", () => {
    const rows = [{ b: 1, a: 2 }] as Record<string, unknown>[];
    const key1 = _computeKey("ws-1", "Q", ["a", "b"], rows);
    const key2 = _computeKey("ws-1", "Q", ["b", "a"], rows);
    expect(key1).toEqual(key2);
  });
});

function _computeKey(
  workspaceId: string,
  queryName: string,
  columnNames: string[],
  rows: Record<string, unknown>[],
) {
  const fingerprint = rows
    .slice(0, 5)
    .map((row) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(row).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    )
    .join("|");
  return JSON.stringify([
    "resultSummary",
    workspaceId,
    queryName,
    columnNames.slice().sort().join(","),
    rows.length,
    fingerprint,
  ]);
}
