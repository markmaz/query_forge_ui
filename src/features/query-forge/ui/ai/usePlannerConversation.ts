import { useCallback, useEffect, useMemo, useState } from "react";
import type { SqlQueryJson } from "../../model/sqlJson";
import {
  requestQueryStudioSuggestions,
  toAiSuggestUserMessage,
} from "./aiCopilotApi";
import type {
  AiCopilotSection,
  PlanDomainResponse,
  QueryStudioSuggestRequest,
  QueryStudioSuggestResponse,
} from "./types";

const PLANNER_CONVERSATION_STORAGE_VERSION = 1;
const PLANNER_CONVERSATION_STORAGE_KEY = "query_forge.planner_conversation";
const MAX_PERSISTED_MESSAGES = 20;

export type PlannerConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type PersistedPlannerConversation = {
  version: number;
  conversationId: string | null;
  messages: PlannerConversationMessage[];
};

type UsePlannerConversationArgs = {
  workspaceId: string | null;
  userId?: string | null;
  activeSection: AiCopilotSection;
  sqlJson?: SqlQueryJson | null;
  domainContext?: QueryStudioSuggestRequest["domainContext"];
  candidates?: QueryStudioSuggestRequest["candidates"];
};

type SendPromptOptions = {
  baseDomainId?: number;
  fastMode?: boolean;
  debug?: boolean;
  signal?: AbortSignal;
};

export type PlannerConversationState = {
  conversationId: string | null;
  messages: PlannerConversationMessage[];
  latestPlanResult: PlanDomainResponse | null;
  isLoading: boolean;
  error: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function extractStatus(error: unknown): number | null {
  const record = asRecord(error);
  const status = record?.status;
  if (isFiniteNumber(status)) return status;
  const response = asRecord(record?.response);
  if (isFiniteNumber(response?.status)) return response.status;
  return null;
}

function isPlanDomainResponse(value: unknown): value is PlanDomainResponse {
  const record = asRecord(value);
  if (!record) return false;
  return Boolean(record.plan_json_v2 && record.validation && "sql_json" in record);
}

function toConversationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function plannerConversationStorageKey(workspaceId: string | null, userId?: string | null): string {
  const workspacePart = workspaceId?.trim() || "global";
  const userPart = userId?.trim() || "user";
  return `${PLANNER_CONVERSATION_STORAGE_KEY}:${workspacePart}:${userPart}`;
}

function readPersistedPlannerConversation(
  workspaceId: string | null,
  userId?: string | null
): PersistedPlannerConversation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(plannerConversationStorageKey(workspaceId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      conversationId?: unknown;
      messages?: unknown;
    };
    if (parsed.version !== PLANNER_CONVERSATION_STORAGE_VERSION) return null;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
          .map((entry) => {
            const record = asRecord(entry);
            if (!record) return null;
            const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
            if (!role) return null;
            const content = typeof record.content === "string" ? record.content : "";
            if (!content.trim()) return null;
            return {
              id:
                typeof record.id === "string" && record.id.trim()
                  ? record.id
                  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role,
              content,
              timestamp:
                typeof record.timestamp === "string" && record.timestamp.trim()
                  ? record.timestamp
                  : new Date().toISOString(),
            } as PlannerConversationMessage;
          })
          .filter((entry): entry is PlannerConversationMessage => Boolean(entry))
          .slice(-MAX_PERSISTED_MESSAGES)
      : [];
    return {
      version: PLANNER_CONVERSATION_STORAGE_VERSION,
      conversationId: toConversationId(parsed.conversationId),
      messages,
    };
  } catch {
    return null;
  }
}

function buildDomainContextWithOverride(
  domainContext: QueryStudioSuggestRequest["domainContext"],
  baseDomainId?: number
): QueryStudioSuggestRequest["domainContext"] {
  if (!isFiniteNumber(baseDomainId)) return domainContext;
  return {
    ...(domainContext ?? {}),
    selectedDomainId: baseDomainId,
    domainCandidates: Array.isArray(domainContext?.domainCandidates)
      ? domainContext.domainCandidates
      : [],
  };
}

function buildSqlJsonWithDomainOverride(sqlJson: SqlQueryJson | null | undefined, baseDomainId?: number) {
  if (!sqlJson || !isFiniteNumber(baseDomainId)) return sqlJson ?? undefined;
  return {
    ...sqlJson,
    domainId: baseDomainId,
  };
}

function appendMessage(
  messages: PlannerConversationMessage[],
  role: PlannerConversationMessage["role"],
  content: string
): PlannerConversationMessage[] {
  const next = [
    ...messages,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role,
      content,
      timestamp: new Date().toISOString(),
    },
  ];
  return next.slice(-MAX_PERSISTED_MESSAGES);
}

export function usePlannerConversation({
  workspaceId,
  userId = null,
  activeSection,
  sqlJson,
  domainContext,
  candidates,
}: UsePlannerConversationArgs) {
  const persisted = useMemo(
    () => readPersistedPlannerConversation(workspaceId, userId),
    [workspaceId, userId]
  );

  const [conversationId, setConversationId] = useState<string | null>(() => persisted?.conversationId ?? null);
  const [messages, setMessages] = useState<PlannerConversationMessage[]>(() => persisted?.messages ?? []);
  const [latestPlanResult, setLatestPlanResult] = useState<PlanDomainResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    setConversationId(persisted?.conversationId ?? null);
    setMessages(persisted?.messages ?? []);
    setLatestPlanResult(null);
    setError(null);
    setSessionNotice(null);
  }, [persisted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = plannerConversationStorageKey(workspaceId, userId);
    if (!conversationId && messages.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    const payload: PersistedPlannerConversation = {
      version: PLANNER_CONVERSATION_STORAGE_VERSION,
      conversationId,
      messages,
    };
    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // no-op
    }
  }, [workspaceId, userId, conversationId, messages]);

  const newSession = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setLatestPlanResult(null);
    setError(null);
    setSessionNotice(null);
  }, []);

  const sendPrompt = useCallback(
    async (prompt: string, opts?: SendPromptOptions): Promise<QueryStudioSuggestResponse> => {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        throw new Error("Prompt is required");
      }
      setIsLoading(true);
      setError(null);
      setSessionNotice(null);
      setMessages((prev) => appendMessage(prev, "user", trimmedPrompt));

      const execute = async (conversationIdOverride: string | null) =>
        requestQueryStudioSuggestions(
          {
            workspaceId,
            activeSection,
            userPrompt: trimmedPrompt,
            ...(typeof conversationIdOverride === "string" && conversationIdOverride.trim().length > 0
              ? { conversationId: conversationIdOverride.trim() }
              : {}),
            ...(typeof opts?.baseDomainId === "number" && Number.isFinite(opts.baseDomainId)
              ? { baseDomainId: opts.baseDomainId }
              : {}),
            ...(typeof opts?.fastMode === "boolean" ? { fastMode: opts.fastMode } : {}),
            ...(typeof opts?.debug === "boolean" ? { debug: opts.debug } : {}),
            ...(buildSqlJsonWithDomainOverride(sqlJson, opts?.baseDomainId)
              ? { sqlJson: buildSqlJsonWithDomainOverride(sqlJson, opts?.baseDomainId) }
              : {}),
            ...(buildDomainContextWithOverride(domainContext, opts?.baseDomainId)
              ? { domainContext: buildDomainContextWithOverride(domainContext, opts?.baseDomainId) }
              : {}),
            ...(candidates ? { candidates } : {}),
          },
          opts?.signal
        );

      try {
        const queryResponse = await execute(conversationId);
        let nextConversationId = toConversationId(queryResponse.conversationId);
        if (!nextConversationId && isPlanDomainResponse(queryResponse.rawResponse)) {
          nextConversationId = toConversationId(queryResponse.rawResponse.conversation_id);
        }

        if (!nextConversationId && conversationId) {
          nextConversationId = conversationId;
        }

        setConversationId(nextConversationId);
        setMessages((prev) => appendMessage(prev, "assistant", queryResponse.message));

        const rawResponse = isPlanDomainResponse(queryResponse.rawResponse)
          ? queryResponse.rawResponse
          : null;
        if (rawResponse) {
          setLatestPlanResult(rawResponse);
        }
        setIsLoading(false);
        return {
          ...queryResponse,
          conversationId: nextConversationId,
        };
      } catch (error) {
        if (extractStatus(error) === 404 && conversationId) {
          setSessionNotice("Your planning session expired. Starting a new one.");
          setConversationId(null);

          try {
            const retryQueryResponse = await execute(null);
            const retryConversationId = toConversationId(retryQueryResponse.conversationId) ??
              (isPlanDomainResponse(retryQueryResponse.rawResponse)
                ? toConversationId(retryQueryResponse.rawResponse.conversation_id)
                : null);
            setConversationId(retryConversationId);
            setMessages((prev) => appendMessage(prev, "assistant", retryQueryResponse.message));
            const rawResponse = isPlanDomainResponse(retryQueryResponse.rawResponse)
              ? retryQueryResponse.rawResponse
              : null;
            if (rawResponse) {
              setLatestPlanResult(rawResponse);
            }
            setIsLoading(false);
            return {
              ...retryQueryResponse,
              conversationId: retryConversationId,
            };
          } catch (retryError) {
            const message = toAiSuggestUserMessage(retryError);
            setError(message);
            setIsLoading(false);
            throw retryError;
          }
        }

        const message = toAiSuggestUserMessage(error);
        setError(message);
        setIsLoading(false);
        throw error;
      }
    },
    [activeSection, candidates, conversationId, domainContext, sqlJson, workspaceId]
  );

  return {
    sendPrompt,
    newSession,
    sessionNotice,
    state: {
      conversationId,
      messages,
      latestPlanResult,
      isLoading,
      error,
    } as PlannerConversationState,
  };
}
