import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
  type ForgeInsightsConversationListItem,
  type ForgeInsightsThread,
  type ForgeInsightsThreadDetail,
  createForgeInsightsThread,
  deleteForgeInsightsConversation,
  deleteForgeInsightsThread,
  getForgeInsightsConversation,
  getForgeInsightsThread,
  listForgeInsightsConversations,
  listForgeInsightsThreads,
  patchForgeInsightsThread,
} from "../../../shared/services/forgeInsightsApi";

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

const STALE_CONVERSATIONS_STORAGE_PREFIX = "forgeInsights:staleConversations";

function staleConversationsStorageKey(workspaceId: string): string {
  return `${STALE_CONVERSATIONS_STORAGE_PREFIX}:${workspaceId}`;
}

function readStaleConversationIds(workspaceId: string): Set<string> {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(staleConversationsStorageKey(workspaceId));
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(
      parsed
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry): entry is string => entry.length > 0)
    );
  } catch {
    return new Set<string>();
  }
}

function writeStaleConversationIds(workspaceId: string, values: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(staleConversationsStorageKey(workspaceId), JSON.stringify([...values]));
  } catch {
    // no-op
  }
}

function statusFromError(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as { status?: unknown; response?: { status?: unknown } };
  if (typeof record.status === "number" && Number.isFinite(record.status)) return record.status;
  if (typeof record.response?.status === "number" && Number.isFinite(record.response.status)) {
    return record.response.status;
  }
  return null;
}

function isNotFoundError(error: unknown): boolean {
  return statusFromError(error) === 404;
}

function isSyntheticThreadId(threadId: string): boolean {
  return threadId.startsWith("conv:");
}

function syntheticThreadId(conversationId: string): string {
  return `conv:${conversationId}`;
}

function conversationIdFromThread(thread: ForgeInsightsThread | null | undefined): string | null {
  if (!thread) return null;
  if (thread.conversation_id) return thread.conversation_id;
  if (isSyntheticThreadId(thread.id)) {
    const parsed = thread.id.slice("conv:".length).trim();
    return parsed.length > 0 ? parsed : null;
  }
  return null;
}

function mergeThreadsWithConversations(
  rows: ForgeInsightsThread[],
  conversations: ForgeInsightsConversationListItem[]
): ForgeInsightsThread[] {
  const byId = new Map<string, ForgeInsightsThread>();
  const byConversationId = new Map<string, ForgeInsightsThread>();

  rows.forEach((row) => {
    byId.set(row.id, row);
    const conversationId = row.conversation_id?.trim();
    if (conversationId) byConversationId.set(conversationId, row);
  });

  conversations.forEach((conversation) => {
    const conversationId = conversation.conversation_id;
    const existing = byConversationId.get(conversationId);
    if (existing) {
      const merged: ForgeInsightsThread = {
        ...existing,
        title: existing.title ?? conversation.title ?? null,
        preview_text: existing.preview_text ?? conversation.preview_text ?? null,
        last_message_at:
          existing.last_message_at ??
          conversation.updated_at ??
          conversation.created_at ??
          existing.last_message_at,
      };
      byId.set(merged.id, merged);
      byConversationId.set(conversationId, merged);
      return;
    }

    const timestamp = conversation.updated_at ?? conversation.created_at ?? new Date().toISOString();
    const synthetic: ForgeInsightsThread = {
      id: syntheticThreadId(conversationId),
      project_id: null,
      conversation_id: conversationId,
      title: conversation.title ?? null,
      preview_text: conversation.preview_text ?? null,
      is_pinned: false,
      is_archived: false,
      last_message_at: conversation.updated_at ?? conversation.created_at ?? null,
      created_at: conversation.created_at ?? timestamp,
      updated_at: conversation.updated_at ?? timestamp,
    };
    byId.set(synthetic.id, synthetic);
    byConversationId.set(conversationId, synthetic);
  });

  return [...byId.values()];
}

function sortThreads(rows: ForgeInsightsThread[]): ForgeInsightsThread[] {
  return [...rows].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const aTs = new Date(a.last_message_at ?? a.updated_at).getTime();
    const bTs = new Date(b.last_message_at ?? b.updated_at).getTime();
    return bTs - aTs;
  });
}

function optimisticThread(input: { projectId: string | null; title?: string | null }): ForgeInsightsThread {
  const now = new Date().toISOString();
  return {
    id: `tmp-thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    project_id: input.projectId,
    conversation_id: null,
    title: input.title ?? null,
    preview_text: null,
    is_pinned: false,
    is_archived: false,
    last_message_at: now,
    created_at: now,
    updated_at: now,
  };
}

type UseForgeInsightsThreadsResult = {
  threads: ForgeInsightsThread[];
  selectedProjectThreads: ForgeInsightsThread[];
  unassignedThreads: ForgeInsightsThread[];
  isLoading: boolean;
  error: string | null;
  refreshThreads: () => Promise<void>;
  createThread: (input: { projectId: string | null; title?: string | null }) => Promise<ForgeInsightsThread | null>;
  loadThreadDetail: (threadId: string) => Promise<ForgeInsightsThreadDetail | null>;
  updateThread: (threadId: string, patch: Partial<ForgeInsightsThread>) => Promise<ForgeInsightsThread | null>;
  moveThread: (threadId: string, projectId: string | null) => Promise<ForgeInsightsThread | null>;
  archiveThread: (threadId: string) => Promise<boolean>;
  deleteThread: (threadId: string) => Promise<boolean>;
  togglePinned: (threadId: string) => Promise<ForgeInsightsThread | null>;
  upsertThread: (thread: ForgeInsightsThread) => void;
};

export function useForgeInsightsThreads(
  workspaceId: string | null,
  selectedProjectId: string | null
): UseForgeInsightsThreadsResult {
  const normalizedWorkspaceId = useMemo(() => workspaceId?.trim() ?? "", [workspaceId]);
  const normalizedSelectedProjectId = useMemo(() => asNullableString(selectedProjectId), [selectedProjectId]);
  const [threads, setThreads] = useState<ForgeInsightsThread[]>([]);
  const threadsRef = useRef<ForgeInsightsThread[]>([]);
  const staleConversationIdsRef = useRef<Set<string>>(new Set());
  const lastMutationTsRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markConversationStale = useCallback(
    (conversationId: string | null | undefined) => {
      const normalized = asNullableString(conversationId);
      if (!normalized || !normalizedWorkspaceId) return;
      const next = new Set(staleConversationIdsRef.current);
      if (!next.has(normalized)) {
        next.add(normalized);
        staleConversationIdsRef.current = next;
        writeStaleConversationIds(normalizedWorkspaceId, next);
      }
    },
    [normalizedWorkspaceId]
  );

  const clearConversationStale = useCallback(
    (conversationId: string | null | undefined) => {
      const normalized = asNullableString(conversationId);
      if (!normalized || !normalizedWorkspaceId) return;
      if (!staleConversationIdsRef.current.has(normalized)) return;
      const next = new Set(staleConversationIdsRef.current);
      next.delete(normalized);
      staleConversationIdsRef.current = next;
      writeStaleConversationIds(normalizedWorkspaceId, next);
    },
    [normalizedWorkspaceId]
  );

  useEffect(() => {
    if (!normalizedWorkspaceId) {
      staleConversationIdsRef.current = new Set();
      return;
    }
    staleConversationIdsRef.current = readStaleConversationIds(normalizedWorkspaceId);
  }, [normalizedWorkspaceId]);

  const refreshThreads = useCallback(async () => {
    if (!normalizedWorkspaceId) {
      setThreads([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    const requestStartedAt = Date.now();
    try {
      const [threadsResult, conversationsResult] = await Promise.allSettled([
        listForgeInsightsThreads({
          workspaceId: normalizedWorkspaceId,
          includeArchived: false,
          limit: 200,
          offset: 0,
        }),
        listForgeInsightsConversations({
          workspaceId: normalizedWorkspaceId,
          limit: 50,
        }),
      ]);

      const rows = threadsResult.status === "fulfilled" ? threadsResult.value : [];
      const conversationsRaw =
        conversationsResult.status === "fulfilled" ? conversationsResult.value : [];
      const conversations = conversationsRaw.filter(
        (conversation) => !staleConversationIdsRef.current.has(conversation.conversation_id)
      );
      if (
        threadsResult.status === "rejected" &&
        conversationsResult.status === "rejected"
      ) {
        throw conversationsResult.reason ?? threadsResult.reason;
      }
      const mergedRows = mergeThreadsWithConversations(rows, conversations);
      setThreads((prev) => {
        const fetchedSorted = sortThreads(mergedRows);
        const merged =
          lastMutationTsRef.current > requestStartedAt
            ? sortThreads([...fetchedSorted, ...prev.filter((thread) => !fetchedSorted.some((row) => row.id === thread.id))])
            : fetchedSorted;
        threadsRef.current = merged;
        return merged;
      });
      setError(null);
    } catch (requestError) {
      const message = toErrorMessage(requestError, "Unable to load conversations.");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [normalizedWorkspaceId]);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  const upsertThread = useCallback((thread: ForgeInsightsThread) => {
    lastMutationTsRef.current = Date.now();
    setThreads((prev) => {
      const next = sortThreads([thread, ...prev.filter((entry) => entry.id !== thread.id)]);
      threadsRef.current = next;
      return next;
    });
  }, []);

  const createThread = useCallback(
    async (input: { projectId: string | null; title?: string | null }) => {
      if (!normalizedWorkspaceId) return null;
      const optimistic = optimisticThread({
        projectId: input.projectId,
        title: input.title ?? null,
      });
      const optimisticRows = sortThreads([optimistic, ...threadsRef.current]);
      lastMutationTsRef.current = Date.now();
      threadsRef.current = optimisticRows;
      setThreads(optimisticRows);
      try {
        const created = await createForgeInsightsThread({
          workspaceId: normalizedWorkspaceId,
          thread: {
            project_id: input.projectId,
            ...(typeof input.title === "string" ? { title: input.title } : {}),
          },
        });
        const nextRows = sortThreads([created, ...threadsRef.current.filter((entry) => entry.id !== optimistic.id)]);
        lastMutationTsRef.current = Date.now();
        threadsRef.current = nextRows;
        setThreads(nextRows);
        return created;
      } catch (requestError) {
        const nextRows = threadsRef.current.filter((entry) => entry.id !== optimistic.id);
        lastMutationTsRef.current = Date.now();
        threadsRef.current = nextRows;
        setThreads(nextRows);
        const message = toErrorMessage(requestError, "Unable to create thread.");
        setError(message);
        toast.error(message);
        return null;
      }
    },
    [normalizedWorkspaceId]
  );

  const loadThreadDetail = useCallback(
    async (threadId: string) => {
      if (!normalizedWorkspaceId) return null;
      const existing = threadsRef.current.find((entry) => entry.id === threadId) ?? null;
      const syntheticConversationId = existing ? conversationIdFromThread(existing) : null;
      if (isSyntheticThreadId(threadId) && syntheticConversationId) {
        try {
          const conversation = await getForgeInsightsConversation({
            workspaceId: normalizedWorkspaceId,
            conversationId: syntheticConversationId,
          });
          clearConversationStale(conversation.conversation_id);
          const now = new Date().toISOString();
          const syntheticThread: ForgeInsightsThread = {
            id: threadId,
            project_id: existing?.project_id ?? null,
            conversation_id: conversation.conversation_id,
            title: existing?.title ?? null,
            preview_text: existing?.preview_text ?? null,
            is_pinned: existing?.is_pinned ?? false,
            is_archived: false,
            last_message_at: existing?.last_message_at ?? now,
            created_at: existing?.created_at ?? now,
            updated_at: existing?.updated_at ?? now,
          };
          upsertThread(syntheticThread);
          return {
            thread: syntheticThread,
            messages: conversation.messages,
            raw: conversation.raw,
          };
        } catch (requestError) {
          if (isNotFoundError(requestError)) {
            markConversationStale(syntheticConversationId);
            setThreads((prev) => {
              const next = prev.filter((entry) => entry.id !== threadId);
              threadsRef.current = next;
              return next;
            });
            setError("Conversation not found.");
            return null;
          }
          const message = toErrorMessage(requestError, "Unable to load conversation.");
          setError(message);
          toast.error(message);
          return null;
        }
      }
      try {
        const detail = await getForgeInsightsThread({
          workspaceId: normalizedWorkspaceId,
          threadId,
        });
        upsertThread(detail.thread);
        return detail;
      } catch (requestError) {
        const message = toErrorMessage(requestError, "Unable to load thread.");
        setError(message);
        toast.error(message);
        return null;
      }
    },
    [clearConversationStale, markConversationStale, normalizedWorkspaceId, upsertThread]
  );

  const updateThread = useCallback(
    async (threadId: string, patch: Partial<ForgeInsightsThread>) => {
      if (!normalizedWorkspaceId) return null;
      const previous = threadsRef.current.find((entry) => entry.id === threadId);
      if (!previous) return null;
      const optimistic = {
        ...previous,
        ...patch,
        project_id:
          patch.project_id === undefined ? previous.project_id : asNullableString(patch.project_id),
        title: patch.title === undefined ? previous.title : asNullableString(patch.title),
        preview_text:
          patch.preview_text === undefined ? previous.preview_text : asNullableString(patch.preview_text),
        conversation_id:
          patch.conversation_id === undefined
            ? previous.conversation_id
            : asNullableString(patch.conversation_id),
        updated_at: new Date().toISOString(),
      };
      lastMutationTsRef.current = Date.now();
      setThreads((prev) => {
        const next = sortThreads(prev.map((entry) => (entry.id === threadId ? optimistic : entry)));
        threadsRef.current = next;
        return next;
      });
      if (isSyntheticThreadId(threadId)) {
        return optimistic;
      }
      try {
        const updated = await patchForgeInsightsThread({
          workspaceId: normalizedWorkspaceId,
          threadId,
          patch: {
            ...(patch.project_id !== undefined ? { project_id: asNullableString(patch.project_id) } : {}),
            ...(patch.title !== undefined ? { title: asNullableString(patch.title) } : {}),
            ...(patch.preview_text !== undefined ? { preview_text: asNullableString(patch.preview_text) } : {}),
            ...(patch.is_pinned !== undefined ? { is_pinned: Boolean(patch.is_pinned) } : {}),
            ...(patch.is_archived !== undefined ? { is_archived: Boolean(patch.is_archived) } : {}),
            ...(patch.last_message_at !== undefined
              ? { last_message_at: asNullableString(patch.last_message_at) }
              : {}),
            ...(patch.conversation_id !== undefined
              ? { conversation_id: asNullableString(patch.conversation_id) }
              : {}),
          },
        });
        const mergedUpdated: ForgeInsightsThread = {
          ...optimistic,
          ...updated,
        };
        lastMutationTsRef.current = Date.now();
        setThreads((prev) => {
          const next = sortThreads(prev.map((entry) => (entry.id === threadId ? mergedUpdated : entry)));
          threadsRef.current = next;
          return next;
        });
        return mergedUpdated;
      } catch (requestError) {
        setThreads((prev) => {
          const next = sortThreads(prev.map((entry) => (entry.id === threadId ? previous : entry)));
          threadsRef.current = next;
          return next;
        });
        const message = toErrorMessage(requestError, "Unable to update thread.");
        setError(message);
        toast.error(message);
        return null;
      }
    },
    [normalizedWorkspaceId]
  );

  const moveThread = useCallback(
    async (threadId: string, projectId: string | null) => {
      return updateThread(threadId, { project_id: projectId });
    },
    [updateThread]
  );

  const archiveThread = useCallback(
    async (threadId: string) => {
      if (!normalizedWorkspaceId) return false;
      const previous = threadsRef.current.find((entry) => entry.id === threadId);
      if (!previous) return false;
      setThreads((prev) => {
        const next = prev.filter((entry) => entry.id !== threadId);
        lastMutationTsRef.current = Date.now();
        threadsRef.current = next;
        return next;
      });
      try {
        if (isSyntheticThreadId(threadId)) {
          const conversationId = conversationIdFromThread(previous);
          if (conversationId) {
            try {
              await deleteForgeInsightsConversation({
                workspaceId: normalizedWorkspaceId,
                conversationId,
              });
            } catch (requestError) {
              if (!isNotFoundError(requestError)) {
                throw requestError;
              }
              markConversationStale(conversationId);
            }
          }
          return true;
        }
        await patchForgeInsightsThread({
          workspaceId: normalizedWorkspaceId,
          threadId,
          patch: { is_archived: true },
        });
        return true;
      } catch (requestError) {
        setThreads((prev) => {
          const next = sortThreads([previous, ...prev]);
          threadsRef.current = next;
          return next;
        });
        const message = toErrorMessage(requestError, "Unable to archive thread.");
        setError(message);
        toast.error(message);
        return false;
      }
    },
    [markConversationStale, normalizedWorkspaceId]
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      if (!normalizedWorkspaceId) return false;
      const previous = threadsRef.current.find((entry) => entry.id === threadId);
      if (!previous) return false;
      const conversationId = conversationIdFromThread(previous);
      setThreads((prev) => {
        const next = prev.filter((entry) => entry.id !== threadId);
        lastMutationTsRef.current = Date.now();
        threadsRef.current = next;
        return next;
      });
      try {
        if (conversationId) {
          try {
            await deleteForgeInsightsConversation({
              workspaceId: normalizedWorkspaceId,
              conversationId,
            });
          } catch (requestError) {
            if (!isNotFoundError(requestError)) {
              throw requestError;
            }
            markConversationStale(conversationId);
          }
        }
        if (!isSyntheticThreadId(threadId)) {
          try {
            await deleteForgeInsightsThread({
              workspaceId: normalizedWorkspaceId,
              threadId,
            });
          } catch (requestError) {
            if (!isNotFoundError(requestError)) {
              throw requestError;
            }
          }
        }
        return true;
      } catch (requestError) {
        setThreads((prev) => {
          const next = sortThreads([previous, ...prev]);
          threadsRef.current = next;
          return next;
        });
        const message = toErrorMessage(requestError, "Unable to delete thread.");
        setError(message);
        toast.error(message);
        return false;
      }
    },
    [markConversationStale, normalizedWorkspaceId]
  );

  const togglePinned = useCallback(
    async (threadId: string) => {
      const existing = threadsRef.current.find((entry) => entry.id === threadId);
      if (!existing) return null;
      return updateThread(threadId, { is_pinned: !existing.is_pinned });
    },
    [updateThread]
  );

  const selectedProjectThreads = useMemo(
    () =>
      sortThreads(
        threads.filter((thread) =>
          normalizedSelectedProjectId ? thread.project_id === normalizedSelectedProjectId : false
        )
      ),
    [threads, normalizedSelectedProjectId]
  );

  const unassignedThreads = useMemo(
    () => sortThreads(threads.filter((thread) => !thread.project_id)),
    [threads]
  );

  return {
    threads,
    selectedProjectThreads,
    unassignedThreads,
    isLoading,
    error,
    refreshThreads,
    createThread,
    loadThreadDetail,
    updateThread,
    moveThread,
    archiveThread,
    deleteThread,
    togglePinned,
    upsertThread,
  };
}
