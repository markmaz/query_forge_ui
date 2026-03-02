import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ForgeInsightsApiError,
  getForgeInsightsConversation,
  getForgeInsightsThread,
  sendForgeInsightsChatMessage,
  type ForgeInsightsThread,
} from "../../../../shared/services/forgeInsightsApi";
import {
  getExecutionResults,
  getExecutionStatus,
} from "../../../../shared/services/executionsApi";
import { useForgeInsightsChatThread } from "../useForgeInsightsChatThread";

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("../../../../shared/services/forgeInsightsApi", async () => {
  const actual = await vi.importActual("../../../../shared/services/forgeInsightsApi");
  return {
    ...actual,
    getForgeInsightsConversation: vi.fn(),
    getForgeInsightsThread: vi.fn(),
    sendForgeInsightsChatMessage: vi.fn(),
  };
});

vi.mock("../../../../shared/services/executionsApi", async () => {
  const actual = await vi.importActual("../../../../shared/services/executionsApi");
  return {
    ...actual,
    getExecutionStatus: vi.fn(),
    getExecutionResults: vi.fn(),
  };
});

const mockGetThread = vi.mocked(getForgeInsightsThread);
const mockGetConversation = vi.mocked(getForgeInsightsConversation);
const mockSendChat = vi.mocked(sendForgeInsightsChatMessage);
const mockGetExecutionStatus = vi.mocked(getExecutionStatus);
const mockGetExecutionResults = vi.mocked(getExecutionResults);

function thread(overrides?: Partial<ForgeInsightsThread>): ForgeInsightsThread {
  return {
    id: "thread-1",
    project_id: "project-1",
    conversation_id: "conv-1",
    title: null,
    preview_text: null,
    is_pinned: false,
    is_archived: false,
    last_message_at: null,
    created_at: "2026-03-02T00:00:00Z",
    updated_at: "2026-03-02T00:00:00Z",
    ...overrides,
  };
}

describe("useForgeInsightsChatThread", () => {
  beforeEach(() => {
    mockGetThread.mockReset();
    mockGetConversation.mockReset();
    mockSendChat.mockReset();
    mockGetExecutionStatus.mockReset();
    mockGetExecutionResults.mockReset();
    mockGetThread.mockResolvedValue({
      thread: thread(),
      messages: [],
      raw: {},
    });
    mockGetConversation.mockResolvedValue({
      conversation_id: "conv-1",
      messages: [],
      raw: {},
    });
  });

  it("loads history from conversation endpoint when thread detail has no messages", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread());
    const onSetActiveThread = vi.fn();

    mockGetConversation.mockResolvedValueOnce({
      conversation_id: "conv-1",
      messages: [
        { role: "user", content: "Show me attendance trends" },
        { role: "assistant", content: "Here are the trends." },
      ],
      raw: {},
    });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread(),
        activeConversationId: "conv-1",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() => expect(mockGetThread).toHaveBeenCalled());
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]?.content).toBe("Show me attendance trends");
      expect(result.current.messages[1]?.content).toBe("Here are the trends.");
    });
  });

  it("falls back to activeConversationId when thread detail has no conversation_id", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread());
    const onSetActiveThread = vi.fn();

    mockGetThread.mockResolvedValueOnce({
      thread: thread({ conversation_id: null }),
      messages: [],
      raw: {},
    });
    mockGetConversation.mockResolvedValueOnce({
      conversation_id: "conv-1",
      messages: [
        { role: "user", content: "Prior prompt" },
        { role: "assistant", content: "Prior response" },
      ],
      raw: {},
    });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread({ conversation_id: null }),
        activeConversationId: "conv-1",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() =>
      expect(mockGetConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          conversationId: "conv-1",
        })
      )
    );
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]?.content).toBe("Prior prompt");
    });
  });

  it("reloads message history when reloadThreadMessages is called", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread());
    const onSetActiveThread = vi.fn();

    mockGetThread
      .mockResolvedValueOnce({
        thread: thread(),
        messages: [],
        raw: {},
      })
      .mockResolvedValueOnce({
        thread: thread(),
        messages: [
          { role: "user", content: "Reloaded prompt" },
          { role: "assistant", content: "Reloaded response" },
        ],
        raw: {},
      });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread(),
        activeConversationId: "conv-1",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() => expect(mockGetThread).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.reloadThreadMessages();
    });

    await waitFor(() => expect(mockGetThread).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]?.content).toBe("Reloaded prompt");
    });
  });

  it("updates preview and last_message_at after successful chat-mode send", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread({ title: "Hello", preview_text: "assistant summary" }));
    const onSetActiveThread = vi.fn();

    mockSendChat.mockResolvedValueOnce({
      mode: "chat",
      route: "chat",
      conversation_id: "conv-1",
      message: { role: "assistant", content: "assistant summary response" },
      usage: null,
      debug: null,
      raw: {},
    });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread(),
        activeConversationId: "conv-1",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() => expect(mockGetThread).toHaveBeenCalled());

    await act(async () => {
      await result.current.sendMessage("Show me attendance trends");
    });

    expect(mockSendChat).toHaveBeenCalledTimes(1);
    expect(onThreadUpdate).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        preview_text: expect.any(String),
        last_message_at: expect.any(String),
        title: "Show me attendance trends",
      })
    );
    expect(result.current.responseEvents.at(-1)?.mode).toBe("chat");
  });

  it("retries once without conversation_id when backend returns 404", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread({ id: "thread-1", conversation_id: "conv-2" }));
    const onSetActiveThread = vi.fn();

    mockSendChat
      .mockRejectedValueOnce(new ForgeInsightsApiError("Conversation expired", 404))
      .mockResolvedValueOnce({
        mode: "chat",
        route: "chat",
        conversation_id: "conv-2",
        message: { role: "assistant", content: "Recovered response" },
        usage: null,
        debug: null,
        raw: {},
      });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread({ id: "thread-1", conversation_id: "stale-conv" }),
        activeConversationId: "stale-conv",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() => expect(mockGetThread).toHaveBeenCalled());

    await act(async () => {
      await result.current.sendMessage("retry request");
    });

    expect(mockSendChat).toHaveBeenCalledTimes(2);
    expect(mockSendChat.mock.calls[0]?.[0]).toMatchObject({
      request: expect.objectContaining({ conversation_id: "stale-conv" }),
    });
    expect(mockSendChat.mock.calls[1]?.[0]).toMatchObject({
      request: expect.not.objectContaining({ conversation_id: expect.anything() }),
    });
    expect(onThreadUpdate).toHaveBeenCalledWith("thread-1", { conversation_id: null });
  });

  it("polls execution and stores results for education pipeline mode", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread({ title: "Prompt", preview_text: "Pipeline summary" }));
    const onSetActiveThread = vi.fn();

    mockSendChat.mockResolvedValueOnce({
      mode: "education_pipeline",
      route: "plan_domain",
      conversation_id: "conv-1",
      trace_id: "trace-1",
      message: { role: "assistant", content: "Pipeline summary" },
      plan_result: {
        sql_json: { version: 1 },
        validation: { is_valid: true, errors: [], repairs_applied: [] },
      },
      execution: { jobId: "job-1", statementId: "stmt-1" },
      execution_status_code: 200,
      route_decision: { route: "plan_domain", confidence: 0.92, reason: "education prompt", method: "llm" },
      debug: { routed: true },
      raw: {},
    });

    mockGetExecutionStatus.mockResolvedValueOnce({
      jobId: "job-1",
      statementId: "stmt-1",
      status: "SUCCEEDED",
    });

    mockGetExecutionResults.mockResolvedValueOnce({
      columns: ["name"],
      rows: [{ name: "Holden Black" }],
      total: 1,
      assistant_message: {
        role: "assistant",
        content: "### Query Result\n\n| name |\n| --- |\n| Holden Black |",
        kind: "execution_result",
        format: "markdown",
      },
    });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread(),
        activeConversationId: "conv-1",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() => expect(mockGetThread).toHaveBeenCalled());

    await act(async () => {
      await result.current.sendMessage("Find Holden Black", { debug: true });
    });

    await waitFor(() => {
      const latestEvent = result.current.responseEvents.at(-1);
      expect(latestEvent?.mode).toBe("education_pipeline");
      expect(latestEvent?.executionState).toBe("success");
      expect(latestEvent?.executionResults?.rows?.[0]).toEqual({ name: "Holden Black" });
      expect(latestEvent?.executionResultKind).toBe("execution_result");
    });
    expect(result.current.messages.at(-1)?.content).toContain("Query Result");
  });

  it("marks execution as failed when pipeline execution fails", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread());
    const onSetActiveThread = vi.fn();

    mockSendChat.mockResolvedValueOnce({
      mode: "education_pipeline",
      route: "plan_domain",
      conversation_id: "conv-1",
      trace_id: "trace-1",
      message: { role: "assistant", content: "Pipeline summary" },
      plan_result: {
        sql_json: { version: 1 },
        validation: { is_valid: true, errors: [], repairs_applied: [] },
      },
      execution: { jobId: "job-1", statementId: "stmt-1" },
      execution_status_code: 200,
      route_decision: null,
      debug: null,
      raw: {},
    });

    mockGetExecutionStatus.mockResolvedValueOnce({
      jobId: "job-1",
      statementId: "stmt-1",
      status: "FAILED",
      error: "warehouse failure",
    });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread(),
        activeConversationId: "conv-1",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() => expect(mockGetThread).toHaveBeenCalled());

    await act(async () => {
      await result.current.sendMessage("Run failing query");
    });

    await waitFor(() => {
      const latestEvent = result.current.responseEvents.at(-1);
      expect(latestEvent?.executionState).toBe("failed");
      expect(latestEvent?.executionError).toMatch(/warehouse failure/i);
    });
    expect(result.current.messages.at(-1)?.content).toMatch(/query failed/i);
  });

  it("marks execution as timeout when status reports timeout", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread());
    const onSetActiveThread = vi.fn();

    mockSendChat.mockResolvedValueOnce({
      mode: "education_pipeline",
      route: "plan_domain",
      conversation_id: "conv-1",
      trace_id: "trace-1",
      message: { role: "assistant", content: "Pipeline summary" },
      plan_result: {
        sql_json: { version: 1 },
        validation: { is_valid: true, errors: [], repairs_applied: [] },
      },
      execution: { jobId: "job-1", statementId: "stmt-1" },
      execution_status_code: 200,
      route_decision: null,
      debug: null,
      raw: {},
    });

    mockGetExecutionStatus.mockResolvedValue({
      jobId: "job-1",
      statementId: "stmt-1",
      status: "TIMEOUT",
    });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread(),
        activeConversationId: "conv-1",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() => expect(mockGetThread).toHaveBeenCalled());

    await act(async () => {
      await result.current.sendMessage("Run long query");
    });

    await waitFor(() => {
      const latestEvent = result.current.responseEvents.at(-1);
      expect(latestEvent?.executionState).toBe("timeout");
    });
  });

  it("persists updated conversation_id from response", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread({ conversation_id: "conv-99" }));
    const onSetActiveThread = vi.fn();

    mockSendChat.mockResolvedValueOnce({
      mode: "chat",
      route: "chat",
      conversation_id: "conv-99",
      message: { role: "assistant", content: "new conversation" },
      usage: null,
      debug: null,
      raw: {},
    });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread({ conversation_id: "conv-1" }),
        activeConversationId: "conv-1",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() => expect(mockGetThread).toHaveBeenCalled());

    await act(async () => {
      await result.current.sendMessage("new convo please");
    });

    expect(onThreadUpdate).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({ conversation_id: "conv-99" })
    );
    expect(onSetActiveThread).toHaveBeenLastCalledWith("thread-1", "conv-99");
  });

  it("cancels an in-flight send request", async () => {
    const onThreadUpdate = vi.fn().mockResolvedValue(thread());
    const onSetActiveThread = vi.fn();

    mockSendChat.mockImplementationOnce(({ signal }) => {
      return new Promise((_, reject) => {
        signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Request aborted", "AbortError"));
          },
          { once: true }
        );
      });
    });

    const { result } = renderHook(() =>
      useForgeInsightsChatThread({
        workspaceId: "ws-1",
        activeThread: thread(),
        activeConversationId: "conv-1",
        onThreadUpdate,
        onSetActiveThread,
      })
    );

    await waitFor(() => expect(mockGetThread).toHaveBeenCalled());

    await act(async () => {
      void result.current.sendMessage("Cancel this request");
    });

    await act(async () => {
      result.current.cancelMessageRequest();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.messages).toHaveLength(0);
    });
  });
});
