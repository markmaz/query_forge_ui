import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getExecutionResults,
  getExecutionStatus,
} from "../../../../shared/services/executionsApi";
import { useForgeInsightsExecutionResult } from "../useForgeInsightsExecutionResult";

vi.mock("../../../../shared/services/executionsApi", async () => {
  const actual = await vi.importActual("../../../../shared/services/executionsApi");
  return {
    ...actual,
    getExecutionStatus: vi.fn(),
    getExecutionResults: vi.fn(),
  };
});

const mockGetExecutionStatus = vi.mocked(getExecutionStatus);
const mockGetExecutionResults = vi.mocked(getExecutionResults);

describe("useForgeInsightsExecutionResult", () => {
  beforeEach(() => {
    mockGetExecutionStatus.mockReset();
    mockGetExecutionResults.mockReset();
  });

  it("returns success result when execution succeeds", async () => {
    mockGetExecutionStatus.mockResolvedValueOnce({
      jobId: "job-1",
      statementId: "stmt-1",
      status: "SUCCEEDED",
    });
    mockGetExecutionResults.mockResolvedValueOnce({
      columns: [{ key: "student_name", label: "Student Name" }],
      rows: [{ student_name: "Holden Black" }],
      total: 1,
    });

    const { result } = renderHook(() => useForgeInsightsExecutionResult());

    await act(async () => {
      const outcome = await result.current.start({
        jobId: "job-1",
        workspaceId: "ws-1",
      });
      expect(outcome.status).toBe("success");
      expect(outcome.result?.rows?.[0]).toEqual({ student_name: "Holden Black" });
    });

    expect(result.current.status).toBe("success");
  });

  it("returns failed result when execution fails", async () => {
    mockGetExecutionStatus.mockResolvedValueOnce({
      jobId: "job-1",
      statementId: "stmt-1",
      status: "FAILED",
      error: "warehouse timeout",
    });

    const { result } = renderHook(() => useForgeInsightsExecutionResult());

    await act(async () => {
      const outcome = await result.current.start({
        jobId: "job-1",
        workspaceId: "ws-1",
      });
      expect(outcome.status).toBe("failed");
      expect(outcome.error).toMatch(/warehouse timeout/i);
    });

    expect(result.current.status).toBe("failed");
  });

  it("returns timeout result when execution status is timeout", async () => {
    mockGetExecutionStatus.mockResolvedValueOnce({
      jobId: "job-1",
      statementId: "stmt-1",
      status: "TIMEOUT",
    });

    const { result } = renderHook(() => useForgeInsightsExecutionResult());

    await act(async () => {
      const outcome = await result.current.start({
        jobId: "job-1",
        workspaceId: "ws-1",
      });
      expect(outcome.status).toBe("timeout");
    });

    expect(result.current.status).toBe("timeout");
  });
});

