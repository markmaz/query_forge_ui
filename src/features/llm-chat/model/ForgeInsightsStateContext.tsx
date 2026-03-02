import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type ForgeInsightsStateValue = {
  selectedProjectId: string | null;
  activeThreadId: string | null;
  activeConversationId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  setActiveThread: (threadId: string | null, conversationId?: string | null) => void;
  setActiveConversationId: (conversationId: string | null) => void;
};

const ForgeInsightsStateContext = createContext<ForgeInsightsStateValue | null>(null);

const FORGE_INSIGHTS_STATE_STORAGE_PREFIX = "forgeInsights:state";

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function storageKey(workspaceId: string | null | undefined): string | null {
  const normalizedWorkspaceId = toNullableString(workspaceId);
  if (!normalizedWorkspaceId) return null;
  return `${FORGE_INSIGHTS_STATE_STORAGE_PREFIX}:${normalizedWorkspaceId}`;
}

function readPersistedState(workspaceId: string | null | undefined): {
  selectedProjectId: string | null;
  activeThreadId: string | null;
  activeConversationId: string | null;
} {
  if (typeof window === "undefined") {
    return {
      selectedProjectId: null,
      activeThreadId: null,
      activeConversationId: null,
    };
  }
  const key = storageKey(workspaceId);
  if (!key) {
    return {
      selectedProjectId: null,
      activeThreadId: null,
      activeConversationId: null,
    };
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return {
        selectedProjectId: null,
        activeThreadId: null,
        activeConversationId: null,
      };
    }
    const parsed = JSON.parse(raw) as {
      selectedProjectId?: unknown;
      activeThreadId?: unknown;
      activeConversationId?: unknown;
    };
    return {
      selectedProjectId: toNullableString(parsed.selectedProjectId),
      activeThreadId: toNullableString(parsed.activeThreadId),
      activeConversationId: toNullableString(parsed.activeConversationId),
    };
  } catch {
    return {
      selectedProjectId: null,
      activeThreadId: null,
      activeConversationId: null,
    };
  }
}

type ProviderProps = {
  workspaceId: string | null;
  children: React.ReactNode;
};

export function ForgeInsightsStateProvider({ workspaceId, children }: ProviderProps) {
  const persisted = useMemo(() => readPersistedState(workspaceId), [workspaceId]);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(persisted.selectedProjectId);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(persisted.activeThreadId);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(persisted.activeConversationId);

  useEffect(() => {
    setSelectedProjectIdState(persisted.selectedProjectId);
    setActiveThreadId(persisted.activeThreadId);
    setActiveConversationIdState(persisted.activeConversationId);
  }, [persisted.activeConversationId, persisted.activeThreadId, persisted.selectedProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = storageKey(workspaceId);
    if (!key) return;
    const payload = {
      selectedProjectId,
      activeThreadId,
      activeConversationId,
    };
    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // no-op
    }
  }, [workspaceId, selectedProjectId, activeThreadId, activeConversationId]);

  const value = useMemo<ForgeInsightsStateValue>(
    () => ({
      selectedProjectId,
      activeThreadId,
      activeConversationId,
      setSelectedProjectId: (projectId) => {
        setSelectedProjectIdState(toNullableString(projectId));
      },
      setActiveThread: (threadId, conversationId = null) => {
        setActiveThreadId(toNullableString(threadId));
        setActiveConversationIdState(toNullableString(conversationId));
      },
      setActiveConversationId: (conversationId) => {
        setActiveConversationIdState(toNullableString(conversationId));
      },
    }),
    [activeConversationId, activeThreadId, selectedProjectId]
  );

  return <ForgeInsightsStateContext.Provider value={value}>{children}</ForgeInsightsStateContext.Provider>;
}

export function useForgeInsightsState() {
  const context = useContext(ForgeInsightsStateContext);
  if (!context) {
    throw new Error("useForgeInsightsState must be used within ForgeInsightsStateProvider.");
  }
  return context;
}
