import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useForgeMatchWorkflow } from "./useForgeMatchWorkflow";

const apiMocks = vi.hoisted(() => ({
  cancelForgeMatchAnalyzeSession: vi.fn(),
  createForgeMatchDraft: vi.fn(),
  exportForgeMatchSession: vi.fn(),
  fetchForgeMatchAnalyzeStatus: vi.fn(),
  fetchForgeMatchSession: vi.fn(),
  startForgeMatchAnalyzeSession: vi.fn(),
  updateForgeMatchMappings: vi.fn(),
  uploadForgeMatchDocument: vi.fn(),
}));

vi.mock("../api", () => ({
  cancelForgeMatchAnalyzeSession: apiMocks.cancelForgeMatchAnalyzeSession,
  createForgeMatchDraft: apiMocks.createForgeMatchDraft,
  exportForgeMatchSession: apiMocks.exportForgeMatchSession,
  fetchForgeMatchAnalyzeStatus: apiMocks.fetchForgeMatchAnalyzeStatus,
  fetchForgeMatchSession: apiMocks.fetchForgeMatchSession,
  startForgeMatchAnalyzeSession: apiMocks.startForgeMatchAnalyzeSession,
  updateForgeMatchMappings: apiMocks.updateForgeMatchMappings,
  uploadForgeMatchDocument: apiMocks.uploadForgeMatchDocument,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useForgeMatchWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchForgeMatchSession.mockResolvedValue({
      session: {
        id: "session-1",
        workspace_id: "ws-1",
        uploaded_filename: "mapping.csv",
        file_type: "csv",
        created_by: "user-1",
        status: "uploaded",
        sheet_count: 1,
        source_record_count: 1,
      },
      source_records: [],
      mappings: [],
      summary: null,
    });
    apiMocks.fetchForgeMatchAnalyzeStatus.mockResolvedValue({
      job_id: "job-1",
      session_id: "session-1",
      workspace_id: "ws-1",
      status: "queued",
      source_total: 1,
      source_done: 0,
      source_skipped: 0,
      source_failed: 0,
      progress_pct: 0,
      analysis_error: null,
    });
  });

  it("ignores stale analyze completions after switching sessions", async () => {
    const deferred = createDeferred({
      job_id: "job-1",
      session_id: "session-1",
      workspace_id: "ws-1",
      status: "queued" as const,
      source_total: 1,
    });
    apiMocks.startForgeMatchAnalyzeSession.mockImplementation(() => deferred.promise);

    const { result } = renderHook(() => useForgeMatchWorkflow(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.selectSession("session-1");
    });

    let analyzePromise!: Promise<unknown>;
    act(() => {
      analyzePromise = result.current.analyze({ top_n: 8, force: false });
    });

    act(() => {
      result.current.selectSession("session-2");
    });

    await act(async () => {
      deferred.resolve({
        job_id: "job-1",
        session_id: "session-1",
        workspace_id: "ws-1",
        status: "queued",
        source_total: 1,
      });
      await analyzePromise;
    });

    expect(result.current.sessionId).toBe("session-2");
    expect(result.current.activeJobId).toBeNull();
  });

  it("does not expose a late session payload after the user switches sessions", async () => {
    const session1Payload = {
      session: {
        id: "session-1",
        workspace_id: "ws-1",
        uploaded_filename: "one.csv",
        file_type: "csv",
        created_by: "user-1",
        status: "uploaded",
        sheet_count: 1,
        source_record_count: 1,
      },
      source_records: [],
      mappings: [],
      summary: null,
    };
    const session2Payload = {
      session: {
        id: "session-2",
        workspace_id: "ws-1",
        uploaded_filename: "two.csv",
        file_type: "csv",
        created_by: "user-1",
        status: "uploaded",
        sheet_count: 1,
        source_record_count: 1,
      },
      source_records: [],
      mappings: [],
      summary: null,
    };
    const session1Deferred = createDeferred(session1Payload);
    const session2Deferred = createDeferred(session2Payload);

    apiMocks.fetchForgeMatchSession.mockImplementation((requestedSessionId: string) => {
      if (requestedSessionId === "session-1") return session1Deferred.promise;
      if (requestedSessionId === "session-2") return session2Deferred.promise;
      throw new Error(`unexpected session ${requestedSessionId}`);
    });

    const { result } = renderHook(() => useForgeMatchWorkflow(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.selectSession("session-1");
    });

    act(() => {
      result.current.selectSession("session-2");
    });

    await act(async () => {
      session1Deferred.resolve(session1Payload);
      await session1Deferred.promise;
    });

    expect(result.current.sessionId).toBe("session-2");
    expect(result.current.state.session).toBeNull();

    await act(async () => {
      session2Deferred.resolve(session2Payload);
      await session2Deferred.promise;
    });

    await waitFor(() => {
      expect(result.current.state.session?.id).toBe("session-2");
    });
  });
});
