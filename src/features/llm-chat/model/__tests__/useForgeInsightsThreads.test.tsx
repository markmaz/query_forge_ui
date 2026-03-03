import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ForgeInsightsApiError,
  createForgeInsightsThread,
  getForgeInsightsConversation,
  deleteForgeInsightsConversation,
  deleteForgeInsightsThread,
  listForgeInsightsConversations,
  listForgeInsightsThreads,
  patchForgeInsightsThread,
} from "../../../../shared/services/forgeInsightsApi";
import { useForgeInsightsThreads } from "../useForgeInsightsThreads";

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("../../../../shared/services/forgeInsightsApi", async () => {
  const actual = await vi.importActual("../../../../shared/services/forgeInsightsApi");
  return {
    ...actual,
    listForgeInsightsThreads: vi.fn(),
    createForgeInsightsThread: vi.fn(),
    patchForgeInsightsThread: vi.fn(),
    deleteForgeInsightsThread: vi.fn(),
    listForgeInsightsConversations: vi.fn(),
    deleteForgeInsightsConversation: vi.fn(),
    getForgeInsightsConversation: vi.fn(),
    getForgeInsightsThread: vi.fn(),
    sendForgeInsightsChatMessage: vi.fn(),
  };
});

const mockListThreads = vi.mocked(listForgeInsightsThreads);
const mockCreateThread = vi.mocked(createForgeInsightsThread);
const mockPatchThread = vi.mocked(patchForgeInsightsThread);
const mockDeleteThread = vi.mocked(deleteForgeInsightsThread);
const mockListConversations = vi.mocked(listForgeInsightsConversations);
const mockDeleteConversation = vi.mocked(deleteForgeInsightsConversation);
const mockGetConversation = vi.mocked(getForgeInsightsConversation);

describe("useForgeInsightsThreads", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockListThreads.mockReset();
    mockCreateThread.mockReset();
    mockPatchThread.mockReset();
    mockDeleteThread.mockReset();
    mockListConversations.mockReset();
    mockDeleteConversation.mockReset();
    mockGetConversation.mockReset();
    mockListThreads.mockResolvedValue([]);
    mockListConversations.mockResolvedValue([]);
  });

  it("creates a thread and stores it", async () => {
    mockCreateThread.mockResolvedValueOnce({
      id: "t-1",
      project_id: "p-1",
      conversation_id: "conv-1",
      title: "New thread",
      preview_text: null,
      is_pinned: false,
      is_archived: false,
      last_message_at: "2026-03-02T00:00:00Z",
      created_at: "2026-03-02T00:00:00Z",
      updated_at: "2026-03-02T00:00:00Z",
    });

    const { result } = renderHook(() => useForgeInsightsThreads("ws-1", "p-1"));

    await waitFor(() => {
      expect(mockListThreads).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.createThread({ projectId: "p-1", title: "New thread" });
    });

    expect(mockCreateThread).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      thread: { project_id: "p-1", title: "New thread" },
    });
    expect(result.current.threads.some((thread) => thread.id === "t-1")).toBe(true);
  });

  it("moves a thread to another project", async () => {
    mockListThreads.mockResolvedValueOnce([
      {
        id: "t-1",
        project_id: "p-1",
        conversation_id: "conv-1",
        title: "Thread A",
        preview_text: null,
        is_pinned: false,
        is_archived: false,
        last_message_at: "2026-03-02T00:00:00Z",
        created_at: "2026-03-02T00:00:00Z",
        updated_at: "2026-03-02T00:00:00Z",
      },
    ]);
    mockPatchThread.mockResolvedValueOnce({
      id: "t-1",
      project_id: "p-2",
      conversation_id: "conv-1",
      title: "Thread A",
      preview_text: null,
      is_pinned: false,
      is_archived: false,
      last_message_at: "2026-03-02T00:00:00Z",
      created_at: "2026-03-02T00:00:00Z",
      updated_at: "2026-03-03T00:00:00Z",
    });

    const { result } = renderHook(() => useForgeInsightsThreads("ws-1", "p-1"));
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    await act(async () => {
      await result.current.moveThread("t-1", "p-2");
    });

    expect(mockPatchThread).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "t-1",
      patch: { project_id: "p-2" },
    });
    expect(result.current.threads[0]?.project_id).toBe("p-2");
  });

  it("archives a thread via patch and removes it from active list", async () => {
    mockListThreads.mockResolvedValueOnce([
      {
        id: "t-1",
        project_id: null,
        conversation_id: "conv-1",
        title: "Archive Me",
        preview_text: null,
        is_pinned: false,
        is_archived: false,
        last_message_at: "2026-03-02T00:00:00Z",
        created_at: "2026-03-02T00:00:00Z",
        updated_at: "2026-03-02T00:00:00Z",
      },
    ]);
    mockPatchThread.mockResolvedValueOnce({
      id: "t-1",
      project_id: null,
      conversation_id: "conv-1",
      title: "Archive Me",
      preview_text: null,
      is_pinned: false,
      is_archived: true,
      last_message_at: "2026-03-02T00:00:00Z",
      created_at: "2026-03-02T00:00:00Z",
      updated_at: "2026-03-03T00:00:00Z",
    });

    const { result } = renderHook(() => useForgeInsightsThreads("ws-1", null));
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    await act(async () => {
      await result.current.archiveThread("t-1");
    });

    expect(mockPatchThread).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "t-1",
      patch: { is_archived: true },
    });
    expect(result.current.threads).toHaveLength(0);
  });

  it("hydrates synthetic threads from conversation list", async () => {
    mockListThreads.mockResolvedValueOnce([]);
    mockListConversations.mockResolvedValueOnce([
      {
        conversation_id: "fi_1",
        title: "Persisted thread",
        preview_text: "Saved response",
        message_count: 4,
        created_at: "2026-03-02T00:00:00Z",
        updated_at: "2026-03-03T00:00:00Z",
        raw: {},
      },
    ]);

    const { result } = renderHook(() => useForgeInsightsThreads("ws-1", null));
    await waitFor(() => {
      expect(result.current.threads).toHaveLength(1);
    });
    expect(result.current.threads[0]?.id).toBe("conv:fi_1");
    expect(result.current.threads[0]?.conversation_id).toBe("fi_1");
  });

  it("deletes via conversation endpoint when thread has conversation_id", async () => {
    mockListThreads.mockResolvedValueOnce([
      {
        id: "t-1",
        project_id: null,
        conversation_id: "fi_del_1",
        title: "Delete me",
        preview_text: null,
        is_pinned: false,
        is_archived: false,
        last_message_at: "2026-03-02T00:00:00Z",
        created_at: "2026-03-02T00:00:00Z",
        updated_at: "2026-03-02T00:00:00Z",
      },
    ]);
    mockDeleteConversation.mockResolvedValueOnce();
    mockDeleteThread.mockResolvedValueOnce();

    const { result } = renderHook(() => useForgeInsightsThreads("ws-1", null));
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    await act(async () => {
      await result.current.deleteThread("t-1");
    });

    expect(mockDeleteConversation).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      conversationId: "fi_del_1",
    });
    expect(result.current.threads).toHaveLength(0);
  });

  it("treats 404 conversation delete as success and removes stale row", async () => {
    mockListThreads.mockResolvedValueOnce([
      {
        id: "conv:fi_missing_1",
        project_id: null,
        conversation_id: "fi_missing_1",
        title: "Missing conversation",
        preview_text: null,
        is_pinned: false,
        is_archived: false,
        last_message_at: "2026-03-02T00:00:00Z",
        created_at: "2026-03-02T00:00:00Z",
        updated_at: "2026-03-02T00:00:00Z",
      },
    ]);
    mockDeleteConversation.mockRejectedValueOnce(
      new ForgeInsightsApiError("Conversation not found.", 404)
    );

    const { result } = renderHook(() => useForgeInsightsThreads("ws-1", null));
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteThread("conv:fi_missing_1");
    });

    expect(deleted).toBe(true);
    expect(mockDeleteThread).not.toHaveBeenCalled();
    expect(result.current.threads).toHaveLength(0);
  });

  it("removes stale synthetic conversation row when loading detail returns 404", async () => {
    mockListThreads.mockResolvedValueOnce([
      {
        id: "conv:fi_missing_2",
        project_id: null,
        conversation_id: "fi_missing_2",
        title: "Missing conversation",
        preview_text: null,
        is_pinned: false,
        is_archived: false,
        last_message_at: "2026-03-02T00:00:00Z",
        created_at: "2026-03-02T00:00:00Z",
        updated_at: "2026-03-02T00:00:00Z",
      },
    ]);
    mockGetConversation.mockRejectedValueOnce(
      new ForgeInsightsApiError("Conversation not found.", 404)
    );

    const { result } = renderHook(() => useForgeInsightsThreads("ws-1", null));
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    await act(async () => {
      await result.current.loadThreadDetail("conv:fi_missing_2");
    });

    expect(result.current.threads).toHaveLength(0);
    expect(result.current.error).toBe("Conversation not found.");
  });

  it("does not rehydrate tombstoned stale conversation ids after refresh", async () => {
    mockListThreads.mockResolvedValueOnce([]);
    mockListConversations.mockResolvedValueOnce([
      {
        conversation_id: "fi_stale_1",
        title: "Stale conversation",
        preview_text: null,
        message_count: 1,
        created_at: "2026-03-02T00:00:00Z",
        updated_at: "2026-03-03T00:00:00Z",
        raw: {},
      },
    ]);
    mockGetConversation.mockRejectedValueOnce(
      new ForgeInsightsApiError("Conversation not found.", 404)
    );

    const { result } = renderHook(() => useForgeInsightsThreads("ws-1", null));
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    await act(async () => {
      await result.current.loadThreadDetail("conv:fi_stale_1");
    });
    expect(result.current.threads).toHaveLength(0);

    mockListThreads.mockResolvedValueOnce([]);
    mockListConversations.mockResolvedValueOnce([
      {
        conversation_id: "fi_stale_1",
        title: "Stale conversation",
        preview_text: null,
        message_count: 1,
        created_at: "2026-03-02T00:00:00Z",
        updated_at: "2026-03-03T00:00:00Z",
        raw: {},
      },
    ]);

    await act(async () => {
      await result.current.refreshThreads();
    });

    expect(result.current.threads).toHaveLength(0);
  });
});
