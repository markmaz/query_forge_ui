import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createForgeInsightsThread,
  deleteForgeInsightsThread,
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
    getForgeInsightsThread: vi.fn(),
    sendForgeInsightsChatMessage: vi.fn(),
  };
});

const mockListThreads = vi.mocked(listForgeInsightsThreads);
const mockCreateThread = vi.mocked(createForgeInsightsThread);
const mockPatchThread = vi.mocked(patchForgeInsightsThread);
const mockDeleteThread = vi.mocked(deleteForgeInsightsThread);

describe("useForgeInsightsThreads", () => {
  beforeEach(() => {
    mockListThreads.mockReset();
    mockCreateThread.mockReset();
    mockPatchThread.mockReset();
    mockDeleteThread.mockReset();
    mockListThreads.mockResolvedValue([]);
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
});
