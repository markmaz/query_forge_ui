import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteForgeInsightsConversation,
  ForgeInsightsApiError,
  getForgeInsightsConversation,
  getForgeInsightsThread,
  listForgeInsightsConversations,
  sendForgeInsightsChatMessage,
} from "../forgeInsightsApi";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../api", () => ({
  default: {
    post: mocks.post,
    get: mocks.get,
    patch: mocks.patch,
    delete: mocks.delete,
  },
}));

describe("forgeInsightsApi ask response parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses chat mode response", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        mode: "chat",
        route: "chat",
        conversation_id: "fi_1",
        message: {
          role: "assistant",
          content: "Hello from chat",
        },
        usage: { total_tokens: 42 },
      },
    });

    const response = await sendForgeInsightsChatMessage({
      workspaceId: "ws-1",
      request: {
        messages: [{ role: "user", content: "Hello" }],
        debug: false,
      },
    });

    expect(response.mode).toBe("chat");
    expect(response.route).toBe("chat");
    expect(response.message.content).toBe("Hello from chat");
    expect(mocks.post).toHaveBeenCalledWith(
      "/chat/forge-insights",
      expect.any(Object),
      expect.objectContaining({ headers: { "X-Workspace-Id": "ws-1" } })
    );
  });

  it("parses education pipeline response", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        mode: "education_pipeline",
        route: "plan_domain",
        conversation_id: "fi_2",
        trace_id: "trace-1",
        message: {
          role: "assistant",
          content: "Started your query.",
        },
        plan_result: {
          sql_json: { version: 1 },
          validation: { is_valid: true, errors: [], repairs_applied: [] },
        },
        execution: { jobId: "job-1", statementId: "stmt-1" },
        execution_status_code: 200,
        route_decision: {
          route: "plan_domain",
          confidence: 0.93,
          reason: "education query",
          method: "llm",
        },
      },
    });

    const response = await sendForgeInsightsChatMessage({
      workspaceId: "ws-1",
      request: {
        messages: [{ role: "user", content: "Find student attendance" }],
        debug: true,
      },
    });

    expect(response.mode).toBe("education_pipeline");
    if (response.mode !== "education_pipeline") {
      throw new Error("expected education_pipeline response");
    }
    expect(response.execution?.jobId).toBe("job-1");
    expect(response.trace_id).toBe("trace-1");
    expect(response.route_decision?.method).toBe("llm");
  });

  it("throws on malformed response with missing assistant content", async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        mode: "chat",
        route: "chat",
        conversation_id: "fi_3",
      },
    });

    await expect(
      sendForgeInsightsChatMessage({
        workspaceId: "ws-1",
        request: {
          messages: [{ role: "user", content: "Hello" }],
        },
      })
    ).rejects.toBeInstanceOf(ForgeInsightsApiError);
  });

  it("loads conversation messages from conversation detail endpoint", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        conversation: {
          id: "fi_conv_1",
          messages: [
            { role: "user", content: "Show attendance" },
            { role: "assistant", content: "Here is attendance data." },
          ],
        },
      },
    });

    const response = await getForgeInsightsConversation({
      workspaceId: "ws-1",
      conversationId: "fi_conv_1",
    });

    expect(response.conversation_id).toBe("fi_conv_1");
    expect(response.messages).toHaveLength(2);
    expect(mocks.get).toHaveBeenCalledWith(
      "/chat/forge-insights/conversations/fi_conv_1",
      expect.objectContaining({ headers: { "X-Workspace-Id": "ws-1" } })
    );
  });

  it("parses tolerant conversation history variants", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        conversation: {
          id: "fi_conv_2",
          history: [
            { role: "human", text: "Show attendance trends" },
            {
              role: "ai",
              content: [
                { type: "text", text: "Here are the trends." },
                { type: "text", text: "Attendance is up 3%." },
              ],
            },
          ],
        },
      },
    });

    const response = await getForgeInsightsConversation({
      workspaceId: "ws-1",
      conversationId: "fi_conv_2",
    });

    expect(response.conversation_id).toBe("fi_conv_2");
    expect(response.messages).toEqual([
      { role: "user", content: "Show attendance trends" },
      { role: "assistant", content: "Here are the trends.\nAttendance is up 3%." },
    ]);
  });

  it("parses wrapped message envelopes in conversation history", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        conversation_id: "fi_conv_wrapped",
        events: [
          { id: "e1", message: { role: "user", content: "Find students by grade." } },
          { id: "e2", message: { role: "assistant", content: "Here are the students." } },
        ],
      },
    });

    const response = await getForgeInsightsConversation({
      workspaceId: "ws-1",
      conversationId: "fi_conv_wrapped",
    });

    expect(response.conversation_id).toBe("fi_conv_wrapped");
    expect(response.messages).toEqual([
      { role: "user", content: "Find students by grade." },
      { role: "assistant", content: "Here are the students." },
    ]);
  });

  it("hydrates thread detail messages when conversation_id is nested under conversation", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        thread: {
          id: "thread-1",
          title: "Thread title",
          project_id: null,
          conversation: { id: "fi_conv_3" },
        },
        conversation: {
          messages: [
            { role: "user", content: "Prompt one" },
            { role: "assistant", content: "Response one" },
          ],
        },
      },
    });

    const detail = await getForgeInsightsThread({
      workspaceId: "ws-1",
      threadId: "thread-1",
    });

    expect(detail.thread.conversation_id).toBe("fi_conv_3");
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[0]?.content).toBe("Prompt one");
  });

  it("hydrates thread detail messages when history is emitted as events", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        thread: {
          id: "thread-events-1",
          title: "Events thread",
          project_id: null,
          conversation_id: "fi_conv_events",
        },
        events: [
          { role: "user", text: "Show prior thread history" },
          { message: { role: "assistant", content: "Loaded from events." } },
        ],
      },
    });

    const detail = await getForgeInsightsThread({
      workspaceId: "ws-1",
      threadId: "thread-events-1",
    });

    expect(detail.thread.conversation_id).toBe("fi_conv_events");
    expect(detail.messages).toEqual([
      { role: "user", content: "Show prior thread history" },
      { role: "assistant", content: "Loaded from events." },
    ]);
  });

  it("lists persisted conversations", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        conversations: [
          {
            conversation_id: "fi_list_1",
            title: "Attendance thread",
            preview_text: "Attendance is up",
            message_count: 5,
            updated_at: "2026-03-03T00:00:00Z",
          },
        ],
      },
    });

    const rows = await listForgeInsightsConversations({
      workspaceId: "ws-1",
      limit: 50,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.conversation_id).toBe("fi_list_1");
    expect(mocks.get).toHaveBeenCalledWith(
      "/chat/forge-insights/conversations",
      expect.objectContaining({
        headers: { "X-Workspace-Id": "ws-1" },
        params: { limit: 50 },
      })
    );
  });

  it("ignores non-conversation ids from list payloads", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        conversations: [
          {
            id: "thread_123",
            title: "Not a conversation id",
          },
        ],
      },
    });

    const rows = await listForgeInsightsConversations({
      workspaceId: "ws-1",
      limit: 50,
    });

    expect(rows).toEqual([]);
  });

  it("accepts fi_ id fallback for conversation rows", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        conversations: [
          {
            id: "fi_list_2",
            title: "Fallback id row",
          },
        ],
      },
    });

    const rows = await listForgeInsightsConversations({
      workspaceId: "ws-1",
      limit: 50,
    });

    expect(rows[0]?.conversation_id).toBe("fi_list_2");
  });

  it("deletes conversation via chat endpoint", async () => {
    mocks.delete.mockResolvedValueOnce({ data: {} });

    await deleteForgeInsightsConversation({
      workspaceId: "ws-1",
      conversationId: "fi_delete_1",
    });

    expect(mocks.delete).toHaveBeenCalledWith(
      "/chat/forge-insights/conversations/fi_delete_1",
      expect.objectContaining({
        headers: { "X-Workspace-Id": "ws-1" },
      })
    );
  });
});
