import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePlannerConversation } from "../usePlannerConversation";

const mockRequestQueryStudioSuggestions = vi.fn();

vi.mock("../aiCopilotApi", () => ({
  requestQueryStudioSuggestions: (...args: unknown[]) => mockRequestQueryStudioSuggestions(...args),
  toAiSuggestUserMessage: (error: unknown) =>
    error instanceof Error && error.message.trim() ? error.message : "Unable to get suggestions right now.",
}));

function plannerRawResponse(conversationId: string | null) {
  return {
    ...(conversationId ? { conversation_id: conversationId } : {}),
    plan_json_v2: {
      schema_version: 2,
      trace_id: "trace-1",
      workspace_id: "ws-1",
      vertical_norm: "education",
      base_domain_id: 6,
      domain_name: "Enrollment",
      selects: { dimensions: [], metrics: [] },
      filters: [],
      time: null,
      grouping: null,
      debug: null,
    },
    sql_json: {
      version: 1,
      domainId: 6,
      columns: [],
      filters: null,
      aggs: { enabled: false, metrics: [], groupBy: [] },
      sorting: [],
      dataPrep: null,
      distinct: false,
      meta: { tool: "planner_domain_v2" },
    },
    validation: {
      is_valid: true,
      errors: [],
      repairs_applied: [],
    },
    trace_id: "trace-1",
    timings_ms: { total: 12 },
  };
}

describe("usePlannerConversation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRequestQueryStudioSuggestions.mockReset();
  });

  it("stores conversationId from first successful request", async () => {
    mockRequestQueryStudioSuggestions.mockResolvedValueOnce({
      message: "First response",
      suggestions: [],
      conversationId: "conv-1",
      rawResponse: plannerRawResponse("conv-1"),
    });

    const { result } = renderHook(() =>
      usePlannerConversation({
        workspaceId: "ws-1",
        userId: "user-1",
        activeSection: "AI First",
      })
    );

    await act(async () => {
      await result.current.sendPrompt("First prompt");
    });

    expect(mockRequestQueryStudioSuggestions).toHaveBeenCalledTimes(1);
    const [firstPayload] = mockRequestQueryStudioSuggestions.mock.calls[0] as [Record<string, unknown>, AbortSignal?];
    expect(firstPayload).not.toHaveProperty("conversationId");
    expect(result.current.state.conversationId).toBe("conv-1");
    expect(result.current.state.latestPlanResult?.conversation_id).toBe("conv-1");
  });

  it("includes conversationId on follow-up requests", async () => {
    mockRequestQueryStudioSuggestions
      .mockResolvedValueOnce({
        message: "First response",
        suggestions: [],
        conversationId: "conv-1",
        rawResponse: plannerRawResponse("conv-1"),
      })
      .mockResolvedValueOnce({
        message: "Second response",
        suggestions: [],
        conversationId: "conv-1",
        rawResponse: plannerRawResponse("conv-1"),
      });

    const { result } = renderHook(() =>
      usePlannerConversation({
        workspaceId: "ws-1",
        userId: "user-1",
        activeSection: "AI First",
      })
    );

    await act(async () => {
      await result.current.sendPrompt("First prompt");
    });

    await act(async () => {
      await result.current.sendPrompt("Follow-up prompt");
    });

    expect(mockRequestQueryStudioSuggestions).toHaveBeenCalledTimes(2);
    const [firstPayload] = mockRequestQueryStudioSuggestions.mock.calls[0] as [Record<string, unknown>, AbortSignal?];
    const [secondPayload] = mockRequestQueryStudioSuggestions.mock.calls[1] as [Record<string, unknown>, AbortSignal?];
    expect(firstPayload).not.toHaveProperty("conversationId");
    expect(secondPayload).toMatchObject({ conversationId: "conv-1" });
  });

  it("resets expired conversation and retries once without conversationId on 404", async () => {
    mockRequestQueryStudioSuggestions
      .mockResolvedValueOnce({
        message: "First response",
        suggestions: [],
        conversationId: "conv-stale",
        rawResponse: plannerRawResponse("conv-stale"),
      })
      .mockRejectedValueOnce({ status: 404, message: "Conversation not found" })
      .mockResolvedValueOnce({
        message: "Recovered response",
        suggestions: [],
        conversationId: "conv-new",
        rawResponse: plannerRawResponse("conv-new"),
      });

    const { result } = renderHook(() =>
      usePlannerConversation({
        workspaceId: "ws-1",
        userId: "user-1",
        activeSection: "AI First",
      })
    );

    await act(async () => {
      await result.current.sendPrompt("First prompt");
    });

    await act(async () => {
      await result.current.sendPrompt("Retry prompt");
    });

    expect(mockRequestQueryStudioSuggestions).toHaveBeenCalledTimes(3);
    const [expiredAttemptPayload] = mockRequestQueryStudioSuggestions.mock.calls[1] as [Record<string, unknown>, AbortSignal?];
    const [retryPayload] = mockRequestQueryStudioSuggestions.mock.calls[2] as [Record<string, unknown>, AbortSignal?];
    expect(expiredAttemptPayload).toMatchObject({ conversationId: "conv-stale" });
    expect(retryPayload).not.toHaveProperty("conversationId");
    expect(result.current.state.conversationId).toBe("conv-new");
    expect(result.current.sessionNotice).toBe("Your planning session expired. Starting a new one.");
  });
});

