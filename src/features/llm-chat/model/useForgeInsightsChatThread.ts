import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
  ForgeInsightsApiError,
  type ExecutionStartResult,
  type ForgeInsightsAskResponse,
  type ForgeInsightsChatMessage,
  type ForgeInsightsThread,
  getForgeInsightsConversation,
  type RouteDecision,
  getForgeInsightsThread,
  sendForgeInsightsChatMessage,
} from "../../../shared/services/forgeInsightsApi";
import type { ExecutionResultsResponse } from "../../../shared/services/executionsApi";
import { useForgeInsightsExecutionResult } from "./useForgeInsightsExecutionResult";

export type ForgeInsightsUiMessage = ForgeInsightsChatMessage & {
  id: string;
  timestamp: string;
};

export type ForgeInsightsExecutionState = "idle" | "running" | "success" | "failed" | "timeout";

export type ForgeInsightsResponseEvent = {
  id: string;
  threadId: string;
  assistantMessageId: string;
  mode: "chat" | "education_pipeline";
  route: string;
  routeLabel: "Chat" | "Education Pipeline";
  traceId: string | null;
  routeDecision: RouteDecision | null;
  execution: ExecutionStartResult | null;
  executionStatusCode: number | null;
  executionState: ForgeInsightsExecutionState;
  executionStatusText: string | null;
  executionResults: ExecutionResultsResponse | null;
  resultAssistantMessageId: string | null;
  failureAssistantMessageId: string | null;
  executionResultKind: string | null;
  executionResultFormat: string | null;
  rowsReturned: number | null;
  executionError: string | null;
  validationMessage: string | null;
  planResult: Record<string, unknown> | null;
  debugPayload: unknown;
  debugRequested: boolean;
};

type UseForgeInsightsChatThreadArgs = {
  workspaceId: string | null;
  activeThread: ForgeInsightsThread | null;
  activeConversationId: string | null;
  onThreadUpdate: (threadId: string, patch: Partial<ForgeInsightsThread>) => Promise<ForgeInsightsThread | null>;
  onSetActiveThread: (threadId: string | null, conversationId?: string | null) => void;
};

type UseForgeInsightsChatThreadResult = {
  messages: ForgeInsightsUiMessage[];
  responseEvents: ForgeInsightsResponseEvent[];
  isLoading: boolean;
  isSkeletonLoading: boolean;
  error: string | null;
  sessionNotice: string | null;
  sendMessage: (
    text: string,
    opts?: { debug?: boolean; signal?: AbortSignal; threadOverride?: ForgeInsightsThread | null }
  ) => Promise<boolean>;
  retryExecution: (eventId: string) => Promise<void>;
  cancelMessageRequest: () => void;
  resetThreadMessages: () => void;
  reloadThreadMessages: () => void;
};

function createUiMessage(role: ForgeInsightsChatMessage["role"], content: string): ForgeInsightsUiMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function statusOf(error: unknown): number | null {
  if (error instanceof ForgeInsightsApiError) return error.status;
  return null;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (typeof error !== "object" || error === null) return false;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code.toUpperCase() : "";
  if (code === "ERR_CANCELED" || code === "ECONNABORTED") return true;
  const name = typeof record.name === "string" ? record.name : "";
  if (name === "CanceledError" || name === "AbortError") return true;
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  return message.includes("cancel") || message.includes("abort");
}

function truncateTitle(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}...`;
}

function previewFromAssistant(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 180) return trimmed;
  return `${trimmed.slice(0, 177)}...`;
}

function toRequestMessages(messages: ForgeInsightsUiMessage[]): ForgeInsightsChatMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function toUiMessages(messages: ForgeInsightsChatMessage[]): ForgeInsightsUiMessage[] {
  return messages.map((message) => createUiMessage(message.role, message.content));
}

function formatValidationErrors(errors: unknown): string {
  if (!Array.isArray(errors) || errors.length === 0) {
    return "Plan validation failed.";
  }
  const messages = errors
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return typeof entry === "string" ? entry : null;
      return (
        asNullableString(record.message) ?? asNullableString(record.code) ?? asNullableString(record.path) ?? null
      );
    })
    .filter((entry): entry is string => Boolean(entry));
  if (messages.length === 0) return "Plan validation failed.";
  return `Plan validation failed: ${messages.join("; ")}`;
}

function extractValidationMessage(planResult: Record<string, unknown> | null): string | null {
  if (!planResult) {
    return "Education pipeline did not include plan_result.";
  }
  const sqlJson = asRecord(planResult.sql_json ?? planResult.sqlJson);
  if (!sqlJson) {
    return "Education pipeline returned no sql_json for execution.";
  }
  const validation = asRecord(planResult.validation);
  if (!validation) return null;
  if (validation.is_valid === false) {
    return formatValidationErrors(validation.errors);
  }
  return null;
}

function createResponseEvent(
  response: ForgeInsightsAskResponse,
  assistantMessageId: string,
  debugRequested: boolean,
  threadId: string
): ForgeInsightsResponseEvent {
  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    threadId,
    assistantMessageId,
    route: response.route,
    traceId: response.mode === "education_pipeline" ? response.trace_id : null,
    routeDecision: response.mode === "education_pipeline" ? response.route_decision : null,
    execution: response.mode === "education_pipeline" ? response.execution : null,
    executionStatusCode: response.mode === "education_pipeline" ? response.execution_status_code : null,
    executionResults: null,
    resultAssistantMessageId: null,
    failureAssistantMessageId: null,
    executionResultKind: null,
    executionResultFormat: null,
    rowsReturned: null,
    executionStatusText: null,
    planResult: response.mode === "education_pipeline" ? response.plan_result : null,
    debugPayload: response.debug,
    debugRequested,
  };

  if (response.mode === "chat") {
    return {
      ...base,
      mode: "chat",
      routeLabel: "Chat",
      executionState: "idle",
      executionError: null,
      validationMessage: null,
    };
  }

  const validationMessage = extractValidationMessage(response.plan_result);
  const missingExecution = !response.execution;
  const shouldFail = Boolean(validationMessage) || missingExecution;

  return {
    ...base,
    mode: "education_pipeline",
    routeLabel: "Education Pipeline",
    executionState: shouldFail ? "failed" : "running",
    executionError: validationMessage ?? (missingExecution ? "Execution identifiers missing from pipeline response." : null),
    validationMessage,
  };
}

function extractExecutionAssistantMessage(
  results: ExecutionResultsResponse | null
): { content: string; kind: string | null; format: string | null } | null {
  if (!results || typeof results !== "object") return null;
  const rawMessage = (results as { assistant_message?: unknown }).assistant_message;
  if (!rawMessage || typeof rawMessage !== "object") return null;
  const record = rawMessage as Record<string, unknown>;
  const content = asNullableString(record.content);
  if (!content) return null;
  return {
    content,
    kind: asNullableString(record.kind),
    format: asNullableString(record.format),
  };
}

function extractRowsReturned(results: ExecutionResultsResponse | null): number | null {
  if (!results || typeof results !== "object") return null;
  const total = (results as { total?: unknown }).total;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  const rows = (results as { rows?: unknown }).rows;
  if (Array.isArray(rows)) return rows.length;
  return null;
}

export function useForgeInsightsChatThread({
  workspaceId,
  activeThread,
  activeConversationId,
  onThreadUpdate,
  onSetActiveThread,
}: UseForgeInsightsChatThreadArgs): UseForgeInsightsChatThreadResult {
  const { start: pollExecutionResult } = useForgeInsightsExecutionResult();
  const normalizedWorkspaceId = useMemo(() => workspaceId?.trim() ?? "", [workspaceId]);
  const onSetActiveThreadRef = useRef(onSetActiveThread);
  const [messages, setMessages] = useState<ForgeInsightsUiMessage[]>([]);
  const [responseEvents, setResponseEvents] = useState<ForgeInsightsResponseEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSkeletonLoading, setIsSkeletonLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const isSendingRef = useRef(false);
  const activeRequestAbortRef = useRef<AbortController | null>(null);
  const pollGenerationRef = useRef(0);
  const previousThreadIdRef = useRef<string | null>(null);
  const messagesOwnerThreadIdRef = useRef<string | null>(null);

  const activeThreadId = activeThread?.id ?? null;

  useEffect(() => {
    onSetActiveThreadRef.current = onSetActiveThread;
  }, [onSetActiveThread]);

  const updateEvent = useCallback((eventId: string, updater: (event: ForgeInsightsResponseEvent) => ForgeInsightsResponseEvent) => {
    setResponseEvents((prev) => prev.map((event) => (event.id === eventId ? updater(event) : event)));
  }, []);

  const pollExecutionForEvent = useCallback(
    async (
      eventId: string,
      jobId: string,
      threadId: string,
      assistantMessageId: string,
      signal?: AbortSignal
    ) => {
      const generation = pollGenerationRef.current;
      updateEvent(eventId, (event) => ({
        ...event,
        executionState: "running",
        executionError: null,
      }));

      const outcome = await pollExecutionResult({
        jobId,
        workspaceId: normalizedWorkspaceId,
        signal,
      });
      if (generation !== pollGenerationRef.current) return;

      if (outcome.status === "success") {
        const executionResults = outcome.result;
        const assistantExecutionMessage = extractExecutionAssistantMessage(executionResults);
        let executionResultMessageId: string | null = null;

        if (assistantExecutionMessage?.content) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: assistantExecutionMessage.content,
                  }
                : message
            )
          );
          messagesOwnerThreadIdRef.current = threadId;
          executionResultMessageId = assistantMessageId;
        }

        updateEvent(eventId, (event) => ({
          ...event,
          executionState: "success",
          executionStatusText: outcome.statusText ?? "SUCCEEDED",
          executionResults,
          resultAssistantMessageId: executionResultMessageId,
          executionResultKind: assistantExecutionMessage?.kind ?? null,
          executionResultFormat: assistantExecutionMessage?.format ?? null,
          rowsReturned: extractRowsReturned(executionResults),
          executionError: null,
        }));
        return;
      }

      if (outcome.status === "failed") {
        if (isAbortError(outcome.error)) {
          updateEvent(eventId, (event) => ({
            ...event,
            executionState: "idle",
            executionStatusText: outcome.statusText,
            executionError: null,
          }));
          return;
        }
        const failureMessage = createUiMessage(
          "assistant",
          "The query failed. Try rephrasing or running again."
        );
        setMessages((prev) => [...prev, failureMessage]);
        messagesOwnerThreadIdRef.current = threadId;
        updateEvent(eventId, (event) => ({
          ...event,
          executionState: "failed",
          executionStatusText: outcome.statusText,
          failureAssistantMessageId: failureMessage.id,
          executionError: outcome.error ?? "Execution failed.",
        }));
        return;
      }

      if (outcome.status === "timeout") {
        updateEvent(eventId, (event) => ({
          ...event,
          executionState: "timeout",
          executionStatusText: outcome.statusText,
          executionError: outcome.error ?? "Execution is still running. Try retrying.",
        }));
      }
    },
    [pollExecutionResult, normalizedWorkspaceId, updateEvent]
  );

  const retryExecution = useCallback(
    async (eventId: string) => {
      const event = responseEvents.find((entry) => entry.id === eventId);
      if (!event?.execution?.jobId) return;
      await pollExecutionForEvent(
        event.id,
        event.execution.jobId,
        event.threadId,
        event.assistantMessageId
      );
    },
    [pollExecutionForEvent, responseEvents]
  );

  const cancelMessageRequest = useCallback(() => {
    activeRequestAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      activeRequestAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!activeThreadId || !normalizedWorkspaceId) {
      setMessages([]);
      setResponseEvents([]);
      setError(null);
      setSessionNotice(null);
      pollGenerationRef.current += 1;
      previousThreadIdRef.current = activeThreadId;
      messagesOwnerThreadIdRef.current = null;
      return;
    }

    let isCancelled = false;
    const didSwitchThreads = previousThreadIdRef.current !== activeThreadId;
    previousThreadIdRef.current = activeThreadId;
    setIsSkeletonLoading(true);
    setError(null);
    setSessionNotice(null);
    pollGenerationRef.current += 1;
    if (didSwitchThreads) {
      const currentOwner = messagesOwnerThreadIdRef.current;
      if (currentOwner && currentOwner !== activeThreadId && !isSendingRef.current) {
        setMessages([]);
        setResponseEvents([]);
        messagesOwnerThreadIdRef.current = activeThreadId;
      }
    }

    void (async () => {
      try {
        const detail = await getForgeInsightsThread({
          workspaceId: normalizedWorkspaceId,
          threadId: activeThreadId,
        });
        if (isCancelled) return;
        let loadedMessages = detail.messages;
        const conversationCandidates = Array.from(
          new Set(
            [
              asNullableString(detail.thread.conversation_id),
              asNullableString(activeConversationId),
              asNullableString(activeThread?.conversation_id),
            ].filter((entry): entry is string => Boolean(entry))
          )
        );
        if (loadedMessages.length === 0 && conversationCandidates.length > 0) {
          for (const conversationId of conversationCandidates) {
            try {
              const conversation = await getForgeInsightsConversation({
                workspaceId: normalizedWorkspaceId,
                conversationId,
              });
              if (isCancelled) return;
              if (conversation.messages.length > 0) {
                loadedMessages = conversation.messages;
                break;
              }
            } catch {
              // try next candidate and keep thread detail payload as fallback
            }
          }
        }
        setMessages((prev) => {
          if (loadedMessages.length > 0) {
            messagesOwnerThreadIdRef.current = activeThreadId;
            return toUiMessages(loadedMessages);
          }
          if (didSwitchThreads) {
            return prev;
          }
          return prev;
        });
        if (loadedMessages.length > 0) {
          setResponseEvents([]);
        }
        onSetActiveThreadRef.current(detail.thread.id, detail.thread.conversation_id);
      } catch (requestError) {
        if (isCancelled) return;
        const message = toErrorMessage(requestError, "Unable to load thread messages.");
        setError(message);
      } finally {
        if (!isCancelled) {
          setIsSkeletonLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [activeThreadId, normalizedWorkspaceId, activeConversationId, activeThread?.conversation_id, reloadToken]);

  const resetThreadMessages = useCallback(() => {
    setMessages([]);
    setResponseEvents([]);
    setError(null);
    setSessionNotice(null);
    pollGenerationRef.current += 1;
    messagesOwnerThreadIdRef.current = null;
  }, []);

  const reloadThreadMessages = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      opts?: { debug?: boolean; signal?: AbortSignal; threadOverride?: ForgeInsightsThread | null }
    ) => {
      if (isSendingRef.current) return false;
      if (!normalizedWorkspaceId) {
        const workspaceMessage = "Select a workspace to send chat messages.";
        setError(workspaceMessage);
        toast.error(workspaceMessage);
        return false;
      }
      const threadForSend = opts?.threadOverride ?? activeThread;
      if (!threadForSend) {
        const threadMessage = "Start or select a conversation first.";
        setError(threadMessage);
        toast.error(threadMessage);
        return false;
      }
      const prompt = text.trim();
      if (!prompt) return false;

      setError(null);
      setSessionNotice(null);
      setIsLoading(true);
      isSendingRef.current = true;
      const requestAbortController = new AbortController();
      activeRequestAbortRef.current?.abort();
      activeRequestAbortRef.current = requestAbortController;
      const externalSignal = opts?.signal;
      const onExternalAbort = () => {
        requestAbortController.abort();
      };
      if (externalSignal?.aborted) {
        requestAbortController.abort();
      } else if (externalSignal) {
        externalSignal.addEventListener("abort", onExternalAbort, { once: true });
      }

      const userMessage = createUiMessage("user", prompt);
      const previousMessages = messages;
      const requestMessages = [...toRequestMessages(previousMessages), { role: "user" as const, content: prompt }];
      const isFirstPrompt = previousMessages.length === 0;
      setMessages([...previousMessages, userMessage]);
      messagesOwnerThreadIdRef.current = threadForSend.id;

      const executeSend = async (conversationId: string | null) => {
        const request = {
          messages: requestMessages,
          ...(asNullableString(conversationId) ? { conversation_id: asNullableString(conversationId)! } : {}),
          temperature: 0.2,
          max_tokens: 512,
          debug: Boolean(opts?.debug),
        };
        return sendForgeInsightsChatMessage({
          workspaceId: normalizedWorkspaceId,
          request,
          signal: requestAbortController.signal,
        });
      };

      const completeRequest = () => {
        if (externalSignal) {
          externalSignal.removeEventListener("abort", onExternalAbort);
        }
        if (activeRequestAbortRef.current === requestAbortController) {
          activeRequestAbortRef.current = null;
        }
        setIsLoading(false);
        isSendingRef.current = false;
      };

      const processSuccessfulResponse = async (
        threadTarget: ForgeInsightsThread,
        chatResponse: ForgeInsightsAskResponse,
        conversationIdFallback?: string | null
      ) => {
        const assistantMessage = createUiMessage("assistant", chatResponse.message.content);
        setMessages((prev) => [...prev, assistantMessage]);
        messagesOwnerThreadIdRef.current = threadTarget.id;

        const event = createResponseEvent(
          chatResponse,
          assistantMessage.id,
          Boolean(opts?.debug),
          threadTarget.id
        );
        setResponseEvents((prev) => [...prev, event]);

        if (event.mode === "education_pipeline") {
          if (event.validationMessage) {
            setSessionNotice(event.validationMessage);
          }
          if (event.execution?.jobId && event.executionState !== "failed") {
            void pollExecutionForEvent(
              event.id,
              event.execution.jobId,
              threadTarget.id,
              event.assistantMessageId,
              requestAbortController.signal
            );
          }
        }

        const nowIso = new Date().toISOString();
        const patch: Partial<ForgeInsightsThread> = {
          preview_text: previewFromAssistant(chatResponse.message.content),
          last_message_at: nowIso,
        };
        const nextConversationId = asNullableString(chatResponse.conversation_id) ?? asNullableString(conversationIdFallback);
        if (nextConversationId && nextConversationId !== asNullableString(threadTarget.conversation_id)) {
          patch.conversation_id = nextConversationId;
        }
        if (!asNullableString(threadTarget.title) && isFirstPrompt) {
          patch.title = truncateTitle(prompt);
        }
        const updated = await onThreadUpdate(threadTarget.id, patch);
        onSetActiveThread(threadTarget.id, updated?.conversation_id ?? nextConversationId ?? null);
      };

      const conversationIdForRequest = opts?.threadOverride
        ? asNullableString(threadForSend.conversation_id)
        : asNullableString(activeConversationId) ?? asNullableString(threadForSend.conversation_id);

      try {
        const chatResponse = await executeSend(conversationIdForRequest);
        await processSuccessfulResponse(threadForSend, chatResponse, conversationIdForRequest);
        completeRequest();
        return true;
      } catch (requestError) {
        if (isAbortError(requestError)) {
          setMessages(previousMessages);
          setError(null);
          completeRequest();
          return false;
        }

        if (statusOf(requestError) === 404) {
          setSessionNotice("Your planning session expired. Starting a new one.");
          try {
            await onThreadUpdate(threadForSend.id, { conversation_id: null });
            onSetActiveThread(threadForSend.id, null);
            const retryResponse = await executeSend(null);
            await processSuccessfulResponse(threadForSend, retryResponse, null);
            completeRequest();
            return true;
          } catch (retryError) {
            if (isAbortError(retryError)) {
              setMessages(previousMessages);
              setError(null);
              completeRequest();
              return false;
            }
            const message = toErrorMessage(retryError, "Unable to recover expired conversation.");
            setError(message);
            toast.error(message);
            setMessages(previousMessages);
            completeRequest();
            return false;
          }
        }

        const message = toErrorMessage(requestError, "Unable to send message.");
        setError(message);
        toast.error(message);
        setMessages(previousMessages);
        completeRequest();
        return false;
      }
    },
    [
      activeConversationId,
      activeThread,
      messages,
      normalizedWorkspaceId,
      onSetActiveThread,
      onThreadUpdate,
      pollExecutionForEvent,
    ]
  );

  return {
    messages,
    responseEvents,
    isLoading,
    isSkeletonLoading,
    error,
    sessionNotice,
    sendMessage,
    retryExecution,
    cancelMessageRequest,
    resetThreadMessages,
    reloadThreadMessages,
  };
}
