import axios from "axios";

import api from "./api";

export type ForgeInsightsChatRole = "user" | "assistant" | "system";

export type ForgeInsightsChatMessage = {
  role: ForgeInsightsChatRole;
  content: string;
};

export type ForgeInsightsProject = {
  id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ForgeInsightsThread = {
  id: string;
  project_id: string | null;
  conversation_id: string | null;
  title: string | null;
  preview_text: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ForgeInsightsThreadDetail = {
  thread: ForgeInsightsThread;
  messages: ForgeInsightsChatMessage[];
  raw: Record<string, unknown>;
};

export type ForgeInsightsConversationDetail = {
  conversation_id: string;
  messages: ForgeInsightsChatMessage[];
  raw: Record<string, unknown>;
};

export type ForgeInsightsConversationListItem = {
  conversation_id: string;
  title: string | null;
  preview_text: string | null;
  message_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  raw: Record<string, unknown>;
};

export type ForgeInsightsChatRequest = {
  messages: ForgeInsightsChatMessage[];
  conversation_id?: string;
  temperature?: number;
  max_tokens?: number;
  debug?: boolean;
};

export type RouteDecision = {
  route: string | null;
  confidence: number | null;
  reason: string | null;
  method: string | null;
};

export type ExecutionStartResult = {
  jobId: string;
  statementId: string;
};

export type ForgeInsightsChatModeResponse = {
  mode: "chat";
  route: string;
  conversation_id: string | null;
  message: ForgeInsightsChatMessage;
  usage: Record<string, unknown> | null;
  debug: unknown;
  raw: Record<string, unknown>;
};

export type ForgeInsightsEducationModeResponse = {
  mode: "education_pipeline";
  route: string;
  conversation_id: string | null;
  trace_id: string | null;
  message: ForgeInsightsChatMessage;
  plan_result: Record<string, unknown> | null;
  execution: ExecutionStartResult | null;
  execution_status_code: number | null;
  route_decision: RouteDecision | null;
  debug: unknown;
  raw: Record<string, unknown>;
};

export type ForgeInsightsAskResponse =
  | ForgeInsightsChatModeResponse
  | ForgeInsightsEducationModeResponse;

export type ForgeInsightsChatResponse = ForgeInsightsAskResponse;

export type ForgeInsightsLegacyChatResponse = {
  conversation_id: string | null;
  message: ForgeInsightsChatMessage;
  raw: Record<string, unknown>;
};

export type ForgeInsightsProjectPatch = Partial<
  Pick<ForgeInsightsProject, "name" | "description" | "is_archived">
>;

export type ForgeInsightsThreadPatch = Partial<
  Pick<
    ForgeInsightsThread,
    "project_id" | "title" | "preview_text" | "is_pinned" | "is_archived" | "last_message_at" | "conversation_id"
  >
>;

export type ForgeInsightsCreateThreadInput = {
  project_id?: string | null;
  conversation_id?: string | null;
  title?: string | null;
};

export class ForgeInsightsApiError extends Error {
  readonly status: number | null;
  readonly data: unknown;

  constructor(message: string, status: number | null = null, data?: unknown) {
    super(message);
    this.name = "ForgeInsightsApiError";
    this.status = status;
    this.data = data;
  }
}

const FORGE_INSIGHTS_PROJECTS_PATH = "/forge-insights/projects";
const FORGE_INSIGHTS_THREADS_PATH = "/forge-insights/threads";
const FORGE_INSIGHTS_CHAT_PATH = "/chat/forge-insights";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function toIdString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return null;
}

function toNonEmptyString(value: unknown): string | null {
  return toIdString(value);
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toTimestampOrNow(value: unknown): string {
  return toNonEmptyString(value) ?? new Date().toISOString();
}

function ensureWorkspaceId(workspaceId: string | null | undefined): string {
  const normalized = toNonEmptyString(workspaceId);
  if (!normalized) {
    throw new ForgeInsightsApiError("Workspace is required for Forge Insights requests.");
  }
  return normalized;
}

function parseErrorMessage(data: unknown): string | null {
  const record = asRecord(data);
  if (!record) return null;
  const detail = record.detail ?? record.message ?? record.error;
  return toNonEmptyString(detail);
}

function toApiError(error: unknown, fallbackMessage: string): ForgeInsightsApiError {
  if (error instanceof ForgeInsightsApiError) return error;
  if (axios.isAxiosError(error)) {
    const status =
      typeof error.response?.status === "number" && Number.isFinite(error.response.status)
        ? error.response.status
        : null;
    const message = parseErrorMessage(error.response?.data) ?? error.message ?? fallbackMessage;
    return new ForgeInsightsApiError(message, status, error.response?.data);
  }
  if (error instanceof Error) return new ForgeInsightsApiError(error.message || fallbackMessage);
  return new ForgeInsightsApiError(fallbackMessage);
}

function parseProject(value: unknown): ForgeInsightsProject | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = toIdString(record.id ?? record.project_id ?? record.projectId);
  const name = toNonEmptyString(record.name ?? record.project_name ?? record.projectName);
  if (!id || !name) return null;
  return {
    id,
    name,
    description: toNonEmptyString(record.description ?? record.project_description ?? record.projectDescription),
    is_archived: toBoolean(record.is_archived ?? record.isArchived),
    created_at: toTimestampOrNow(record.created_at ?? record.createdAt),
    updated_at: toTimestampOrNow(record.updated_at ?? record.updatedAt),
  };
}

function parseThread(value: unknown): ForgeInsightsThread | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = toIdString(record.id ?? record.thread_id ?? record.threadId);
  if (!id) return null;
  const conversationRecord = asRecord(record.conversation);
  return {
    id,
    project_id: toIdString(record.project_id ?? record.projectId),
    conversation_id: toNonEmptyString(
      record.conversation_id ??
        record.conversationId ??
        conversationRecord?.id ??
        conversationRecord?.conversation_id ??
        conversationRecord?.conversationId
    ),
    title: toNonEmptyString(record.title),
    preview_text: toNonEmptyString(record.preview_text ?? record.previewText),
    is_pinned: toBoolean(record.is_pinned ?? record.isPinned),
    is_archived: toBoolean(record.is_archived ?? record.isArchived),
    last_message_at: toNonEmptyString(record.last_message_at ?? record.lastMessageAt),
    created_at: toTimestampOrNow(record.created_at ?? record.createdAt),
    updated_at: toTimestampOrNow(record.updated_at ?? record.updatedAt),
  };
}

function normalizeMessageRole(value: unknown): ForgeInsightsChatRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "user" || normalized === "assistant" || normalized === "system") return normalized;
  if (normalized === "human") return "user";
  if (normalized === "ai" || normalized === "bot" || normalized === "model") return "assistant";
  return null;
}

function extractMessageText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => extractMessageText(entry))
      .filter((entry): entry is string => Boolean(entry))
      .join("\n")
      .trim();
    return joined.length > 0 ? joined : null;
  }

  const record = asRecord(value);
  if (!record) return null;

  const direct =
    extractMessageText(record.content) ??
    extractMessageText(record.text) ??
    extractMessageText(record.message) ??
    extractMessageText(record.value) ??
    extractMessageText(record.body) ??
    extractMessageText(record.output) ??
    extractMessageText(record.response);

  return direct;
}

function parseMessagesInput(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
      try {
        return parseMessagesInput(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }
    return [];
  }

  const record = asRecord(value);
  if (!record) return [];

  const nestedArray =
    record.messages ??
    record.history ??
    record.turns ??
    record.events ??
    record.items ??
    record.rows ??
    record.data;

  return Array.isArray(nestedArray) ? nestedArray : [];
}

function parseMessages(value: unknown): ForgeInsightsChatMessage[] {
  const rows = parseMessagesInput(value);
  if (rows.length === 0) return [];

  const parsed = rows.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];

    const nestedMessage =
      asRecord(record.message) ??
      asRecord(record.payload) ??
      asRecord(record.entry) ??
      asRecord(record.event);

    const role = normalizeMessageRole(
      record.role ??
        record.author_role ??
        record.authorRole ??
        record.sender_role ??
        record.senderRole ??
        record.type ??
        nestedMessage?.role ??
        nestedMessage?.author_role ??
        nestedMessage?.authorRole ??
        nestedMessage?.sender_role ??
        nestedMessage?.senderRole ??
        nestedMessage?.type
    );
    const content = extractMessageText(
      record.content ??
        record.text ??
        record.message ??
        record.value ??
        record.body ??
        record.output ??
        record.response ??
        nestedMessage?.content ??
        nestedMessage?.text ??
        nestedMessage?.value ??
        nestedMessage?.body ??
        nestedMessage?.output ??
        nestedMessage?.response
    );
    if (role && content) {
      return [{ role, content }];
    }

    const pairUser = extractMessageText(
      record.user_message ??
        record.user ??
        record.prompt ??
        record.question ??
        nestedMessage?.user_message ??
        nestedMessage?.user ??
        nestedMessage?.prompt ??
        nestedMessage?.question
    );
    const pairAssistant = extractMessageText(
      record.assistant_message ??
        record.assistant ??
        record.answer ??
        record.result ??
        nestedMessage?.assistant_message ??
        nestedMessage?.assistant ??
        nestedMessage?.answer ??
        nestedMessage?.result
    );
    if (pairUser || pairAssistant) {
      const messages: ForgeInsightsChatMessage[] = [];
      if (pairUser) messages.push({ role: "user", content: pairUser });
      if (pairAssistant) messages.push({ role: "assistant", content: pairAssistant });
      return messages;
    }

    return [];
  });

  return parsed;
}

function parseProjectsResponse(value: unknown): ForgeInsightsProject[] {
  if (Array.isArray(value)) {
    return value.map(parseProject).filter((entry): entry is ForgeInsightsProject => Boolean(entry));
  }
  const record = asRecord(value);
  const rows = Array.isArray(record?.projects)
    ? record.projects
    : Array.isArray(record?.data)
      ? record.data
      : Array.isArray(record?.items)
        ? record.items
        : Array.isArray(record?.results)
          ? record.results
          : Array.isArray(record?.rows)
            ? record.rows
            : [];
  return rows.map(parseProject).filter((entry): entry is ForgeInsightsProject => Boolean(entry));
}

function parseThreadsResponse(value: unknown): ForgeInsightsThread[] {
  if (Array.isArray(value)) {
    return value.map(parseThread).filter((entry): entry is ForgeInsightsThread => Boolean(entry));
  }
  const record = asRecord(value);
  const rows = Array.isArray(record?.threads)
    ? record.threads
    : Array.isArray(record?.data)
      ? record.data
      : Array.isArray(record?.items)
        ? record.items
        : Array.isArray(record?.results)
          ? record.results
          : Array.isArray(record?.rows)
            ? record.rows
            : [];
  return rows.map(parseThread).filter((entry): entry is ForgeInsightsThread => Boolean(entry));
}

function parseThreadDetailResponse(value: unknown): ForgeInsightsThreadDetail {
  const root = asRecord(value) ?? {};
  const dataRecord = asRecord(root.data) ?? {};
  const rootConversationRecord = asRecord(root.conversation);
  const dataConversationRecord = asRecord(dataRecord.conversation);
  const threadCandidate = parseThread(root.thread) ?? parseThread(dataRecord.thread) ?? parseThread(root) ?? parseThread(dataRecord);
  if (!threadCandidate) {
    throw new ForgeInsightsApiError("Thread response is missing required thread fields.");
  }
  const enrichedThread: ForgeInsightsThread = {
    ...threadCandidate,
    conversation_id:
      threadCandidate.conversation_id ??
      toNonEmptyString(
        root.conversation_id ??
          root.conversationId ??
          dataRecord.conversation_id ??
          dataRecord.conversationId ??
          rootConversationRecord?.id ??
          rootConversationRecord?.conversation_id ??
          rootConversationRecord?.conversationId ??
          dataConversationRecord?.id ??
          dataConversationRecord?.conversation_id ??
          dataConversationRecord?.conversationId
      ),
  };
  const messages = parseMessages(
    root.messages ??
      dataRecord.messages ??
      root.history ??
      dataRecord.history ??
      root.turns ??
      dataRecord.turns ??
      root.events ??
      dataRecord.events ??
      rootConversationRecord?.messages ??
      rootConversationRecord?.history ??
      rootConversationRecord?.turns ??
      rootConversationRecord?.events ??
      dataConversationRecord?.messages ??
      dataConversationRecord?.history ??
      dataConversationRecord?.turns ??
      dataConversationRecord?.events ??
      asRecord(root.thread)?.messages ??
      asRecord(root.thread)?.history ??
      asRecord(root.thread)?.turns ??
      asRecord(root.thread)?.events ??
      asRecord(dataRecord.thread)?.messages ??
      asRecord(dataRecord.thread)?.history ??
      asRecord(dataRecord.thread)?.turns ??
      asRecord(dataRecord.thread)?.events ??
      []
  );
  return {
    thread: enrichedThread,
    messages,
    raw: root,
  };
}

function parseConversationDetailResponse(
  value: unknown,
  conversationIdFallback?: string | null
): ForgeInsightsConversationDetail {
  const root = asRecord(value) ?? {};
  const dataRecord = asRecord(root.data) ?? {};
  const conversationRecord = asRecord(root.conversation) ?? asRecord(dataRecord.conversation) ?? {};
  const conversation_id =
    toNonEmptyString(root.conversation_id ?? root.conversationId) ??
    toNonEmptyString(dataRecord.conversation_id ?? dataRecord.conversationId) ??
    toNonEmptyString(conversationRecord.id ?? conversationRecord.conversation_id ?? conversationRecord.conversationId) ??
    toNonEmptyString(conversationIdFallback);

  if (!conversation_id) {
    throw new ForgeInsightsApiError("Conversation response is missing conversation_id.");
  }

  const messages = parseMessages(
    root.messages ??
      dataRecord.messages ??
      root.history ??
      dataRecord.history ??
      root.turns ??
      dataRecord.turns ??
      root.events ??
      dataRecord.events ??
      conversationRecord.messages ??
      conversationRecord.history ??
      conversationRecord.turns ??
      conversationRecord.events ??
      []
  );

  return {
    conversation_id,
    messages,
    raw: root,
  };
}

function parseConversationListItem(value: unknown): ForgeInsightsConversationListItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const conversationRecord = asRecord(record.conversation);
  const explicitConversationId =
    toNonEmptyString(
      record.conversation_id ??
        record.conversationId ??
        conversationRecord?.conversation_id ??
        conversationRecord?.conversationId
    ) ?? null;
  const fallbackConversationId =
    toNonEmptyString(record.id ?? conversationRecord?.id) ?? null;
  const conversation_id =
    explicitConversationId ??
    (fallbackConversationId && fallbackConversationId.startsWith("fi_")
      ? fallbackConversationId
      : null);
  if (!conversation_id) return null;

  return {
    conversation_id,
    title:
      toNonEmptyString(record.title ?? record.name ?? record.subject ?? conversationRecord?.title ?? conversationRecord?.name) ??
      null,
    preview_text:
      toNonEmptyString(
        record.preview_text ??
          record.previewText ??
          record.last_message_preview ??
          record.lastMessagePreview ??
          record.snippet ??
          conversationRecord?.preview_text ??
          conversationRecord?.previewText ??
          conversationRecord?.last_message_preview ??
          conversationRecord?.lastMessagePreview
      ) ?? null,
    message_count:
      toNumber(
        record.message_count ??
          record.messageCount ??
          record.messages_count ??
          record.messagesCount ??
          conversationRecord?.message_count ??
          conversationRecord?.messageCount ??
          conversationRecord?.messages_count ??
          conversationRecord?.messagesCount
      ) ?? null,
    created_at:
      toNonEmptyString(record.created_at ?? record.createdAt ?? conversationRecord?.created_at ?? conversationRecord?.createdAt) ??
      null,
    updated_at:
      toNonEmptyString(record.updated_at ?? record.updatedAt ?? conversationRecord?.updated_at ?? conversationRecord?.updatedAt) ??
      null,
    raw: record,
  };
}

function parseConversationListResponse(value: unknown): ForgeInsightsConversationListItem[] {
  if (Array.isArray(value)) {
    return value
      .map(parseConversationListItem)
      .filter((entry): entry is ForgeInsightsConversationListItem => Boolean(entry));
  }
  const record = asRecord(value);
  if (!record) return [];

  const rows =
    (Array.isArray(record.conversations) && record.conversations) ||
    (Array.isArray(record.items) && record.items) ||
    (Array.isArray(record.results) && record.results) ||
    (Array.isArray(record.rows) && record.rows) ||
    (Array.isArray(record.data) && record.data) ||
    [];

  return rows
    .map(parseConversationListItem)
    .filter((entry): entry is ForgeInsightsConversationListItem => Boolean(entry));
}

function parseRouteDecision(value: unknown): RouteDecision | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    route: toNonEmptyString(record.route),
    confidence: toNumber(record.confidence),
    reason: toNonEmptyString(record.reason),
    method: toNonEmptyString(record.method),
  };
}

function parseExecutionStartResult(value: unknown): ExecutionStartResult | null {
  const record = asRecord(value);
  if (!record) return null;
  const jobId = toNonEmptyString(record.jobId ?? record.job_id);
  const statementId = toNonEmptyString(record.statementId ?? record.statement_id);
  if (!jobId || !statementId) return null;
  return {
    jobId,
    statementId,
  };
}

function parseChatResponse(value: unknown): ForgeInsightsAskResponse {
  const record = asRecord(value) ?? {};
  const conversation_id = toNonEmptyString(record.conversation_id ?? record.conversationId);
  const messageCandidate = asRecord(record.message) ?? asRecord(record.assistant);
  const messageRoleRaw = messageCandidate?.role;
  const messageRole: ForgeInsightsChatRole =
    messageRoleRaw === "user" || messageRoleRaw === "assistant" || messageRoleRaw === "system"
      ? messageRoleRaw
      : "assistant";
  const messageContent =
    toNonEmptyString(messageCandidate?.content) ??
    toNonEmptyString(record.response) ??
    toNonEmptyString(record.content);
  if (!messageContent) {
    throw new ForgeInsightsApiError("Chat response did not include assistant content.");
  }
  const message = {
    role: messageRole,
    content: messageContent,
  } satisfies ForgeInsightsChatMessage;
  const mode = toNonEmptyString(record.mode) ?? "chat";
  const route = toNonEmptyString(record.route) ?? (mode === "education_pipeline" ? "plan_domain" : "chat");

  if (mode === "education_pipeline") {
    return {
      mode: "education_pipeline",
      route,
      conversation_id,
      trace_id: toNonEmptyString(record.trace_id ?? record.traceId),
      message,
      plan_result: asRecord(record.plan_result ?? record.planResult),
      execution: parseExecutionStartResult(record.execution),
      execution_status_code: toNumber(record.execution_status_code ?? record.executionStatusCode),
      route_decision: parseRouteDecision(record.route_decision ?? record.routeDecision),
      debug: record.debug ?? null,
      raw: record,
    };
  }

  return {
    mode: "chat",
    route,
    conversation_id,
    message,
    usage: asRecord(record.usage),
    debug: record.debug ?? null,
    raw: record,
  };
}

function normalizeProjectPatch(input: ForgeInsightsProjectPatch): ForgeInsightsProjectPatch {
  return {
    ...(typeof input.name === "string" ? { name: input.name } : {}),
    ...(typeof input.description === "string" || input.description === null
      ? { description: input.description }
      : {}),
    ...(typeof input.is_archived === "boolean" ? { is_archived: input.is_archived } : {}),
  };
}

function normalizeThreadPatch(input: ForgeInsightsThreadPatch): ForgeInsightsThreadPatch {
  return {
    ...(typeof input.project_id === "string" || input.project_id === null
      ? { project_id: input.project_id }
      : {}),
    ...(typeof input.conversation_id === "string" || input.conversation_id === null
      ? { conversation_id: input.conversation_id }
      : {}),
    ...(typeof input.title === "string" || input.title === null ? { title: input.title } : {}),
    ...(typeof input.preview_text === "string" || input.preview_text === null
      ? { preview_text: input.preview_text }
      : {}),
    ...(typeof input.is_pinned === "boolean" ? { is_pinned: input.is_pinned } : {}),
    ...(typeof input.is_archived === "boolean" ? { is_archived: input.is_archived } : {}),
    ...(typeof input.last_message_at === "string" || input.last_message_at === null
      ? { last_message_at: input.last_message_at }
      : {}),
  };
}

function workspaceHeaders(workspaceId: string): Record<string, string> {
  return {
    "X-Workspace-Id": workspaceId,
  };
}

function projectFallbackFromResponse(
  data: unknown,
  fallback: { id?: string | null; name?: string | null; description?: string | null; isArchived?: boolean }
): ForgeInsightsProject | null {
  const record = asRecord(data);
  const id = toIdString(record?.id ?? record?.project_id ?? record?.projectId ?? fallback.id);
  const name = toNonEmptyString(record?.name ?? record?.project_name ?? record?.projectName ?? fallback.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    description: toNonEmptyString(record?.description ?? fallback.description),
    is_archived: toBoolean(record?.is_archived ?? record?.isArchived ?? fallback.isArchived ?? false),
    created_at: toTimestampOrNow(record?.created_at ?? record?.createdAt),
    updated_at: toTimestampOrNow(record?.updated_at ?? record?.updatedAt),
  };
}

function threadFallbackFromResponse(
  data: unknown,
  fallback: {
    id?: string | null;
    projectId?: string | null;
    conversationId?: string | null;
    title?: string | null;
    previewText?: string | null;
    isPinned?: boolean;
    isArchived?: boolean;
    lastMessageAt?: string | null;
  }
): ForgeInsightsThread | null {
  const record = asRecord(data);
  const id = toIdString(record?.id ?? record?.thread_id ?? record?.threadId ?? fallback.id);
  if (!id) return null;
  return {
    id,
    project_id: toIdString(record?.project_id ?? record?.projectId ?? fallback.projectId),
    conversation_id: toNonEmptyString(
      record?.conversation_id ?? record?.conversationId ?? fallback.conversationId
    ),
    title: toNonEmptyString(record?.title ?? fallback.title),
    preview_text: toNonEmptyString(record?.preview_text ?? record?.previewText ?? fallback.previewText),
    is_pinned: toBoolean(record?.is_pinned ?? record?.isPinned ?? fallback.isPinned ?? false),
    is_archived: toBoolean(record?.is_archived ?? record?.isArchived ?? fallback.isArchived ?? false),
    last_message_at: toNonEmptyString(record?.last_message_at ?? record?.lastMessageAt ?? fallback.lastMessageAt),
    created_at: toTimestampOrNow(record?.created_at ?? record?.createdAt),
    updated_at: toTimestampOrNow(record?.updated_at ?? record?.updatedAt),
  };
}

export async function listForgeInsightsProjects(input: {
  workspaceId: string;
  includeArchived?: boolean;
  signal?: AbortSignal;
}): Promise<ForgeInsightsProject[]> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  try {
    const response = await api.get(FORGE_INSIGHTS_PROJECTS_PATH, {
      signal: input.signal,
      headers: workspaceHeaders(workspaceId),
      params: {
        include_archived: input.includeArchived ?? false,
      },
    });
    return parseProjectsResponse(response.data);
  } catch (error) {
    throw toApiError(error, "Unable to load Forge Insights projects.");
  }
}

export async function createForgeInsightsProject(input: {
  workspaceId: string;
  name: string;
  description?: string | null;
  signal?: AbortSignal;
}): Promise<ForgeInsightsProject> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  const name = toNonEmptyString(input.name);
  if (!name) {
    throw new ForgeInsightsApiError("Project name is required.");
  }
  try {
    const response = await api.post(
      FORGE_INSIGHTS_PROJECTS_PATH,
      {
        name,
        ...(typeof input.description === "string" || input.description === null
          ? { description: input.description }
          : {}),
      },
      {
        signal: input.signal,
        headers: workspaceHeaders(workspaceId),
      }
    );
    const parsed =
      parseProject(response.data) ??
      parseProject(asRecord(response.data)?.project) ??
      projectFallbackFromResponse(response.data, {
        name,
        description: input.description ?? null,
      });
    if (!parsed) {
      throw new ForgeInsightsApiError("Project response is malformed.");
    }
    return parsed;
  } catch (error) {
    throw toApiError(error, "Unable to create project.");
  }
}

export async function patchForgeInsightsProject(input: {
  workspaceId: string;
  projectId: string;
  patch: ForgeInsightsProjectPatch;
  signal?: AbortSignal;
}): Promise<ForgeInsightsProject> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  const projectId = toNonEmptyString(input.projectId);
  if (!projectId) {
    throw new ForgeInsightsApiError("projectId is required.");
  }
  try {
    const response = await api.patch(
      `${FORGE_INSIGHTS_PROJECTS_PATH}/${encodeURIComponent(projectId)}`,
      normalizeProjectPatch(input.patch),
      {
        signal: input.signal,
        headers: workspaceHeaders(workspaceId),
      }
    );
    const parsed =
      parseProject(response.data) ??
      parseProject(asRecord(response.data)?.project) ??
      projectFallbackFromResponse(response.data, {
        id: projectId,
        name: input.patch.name ?? null,
        description: input.patch.description ?? null,
        isArchived: input.patch.is_archived,
      });
    if (!parsed) {
      throw new ForgeInsightsApiError("Project response is malformed.");
    }
    return parsed;
  } catch (error) {
    throw toApiError(error, "Unable to update project.");
  }
}

export async function deleteForgeInsightsProject(input: {
  workspaceId: string;
  projectId: string;
  signal?: AbortSignal;
}): Promise<void> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  const projectId = toNonEmptyString(input.projectId);
  if (!projectId) {
    throw new ForgeInsightsApiError("projectId is required.");
  }
  try {
    await api.delete(`${FORGE_INSIGHTS_PROJECTS_PATH}/${encodeURIComponent(projectId)}`, {
      signal: input.signal,
      headers: workspaceHeaders(workspaceId),
    });
  } catch (error) {
    throw toApiError(error, "Unable to delete project.");
  }
}

export async function listForgeInsightsThreads(input: {
  workspaceId: string;
  projectId?: string | null;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<ForgeInsightsThread[]> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  try {
    const response = await api.get(FORGE_INSIGHTS_THREADS_PATH, {
      signal: input.signal,
      headers: workspaceHeaders(workspaceId),
      params: {
        ...(toNonEmptyString(input.projectId) ? { project_id: input.projectId } : {}),
        include_archived: input.includeArchived ?? false,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      },
    });
    return parseThreadsResponse(response.data);
  } catch (error) {
    throw toApiError(error, "Unable to load threads.");
  }
}

export async function createForgeInsightsThread(input: {
  workspaceId: string;
  thread: ForgeInsightsCreateThreadInput;
  signal?: AbortSignal;
}): Promise<ForgeInsightsThread> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  const payload = {
    ...(typeof input.thread.project_id === "string" || input.thread.project_id === null
      ? { project_id: input.thread.project_id }
      : {}),
    ...(typeof input.thread.conversation_id === "string" || input.thread.conversation_id === null
      ? { conversation_id: input.thread.conversation_id }
      : {}),
    ...(typeof input.thread.title === "string" || input.thread.title === null
      ? { title: input.thread.title }
      : {}),
  };

  try {
    const response = await api.post(FORGE_INSIGHTS_THREADS_PATH, payload, {
      signal: input.signal,
      headers: workspaceHeaders(workspaceId),
    });
    const parsed =
      parseThread(response.data) ??
      parseThread(asRecord(response.data)?.thread) ??
      threadFallbackFromResponse(response.data, {
        projectId: input.thread.project_id ?? null,
        conversationId: input.thread.conversation_id ?? null,
        title: input.thread.title ?? null,
      });
    if (!parsed) {
      throw new ForgeInsightsApiError("Thread response is malformed.");
    }
    return parsed;
  } catch (error) {
    throw toApiError(error, "Unable to create thread.");
  }
}

export async function getForgeInsightsThread(input: {
  workspaceId: string;
  threadId: string;
  signal?: AbortSignal;
}): Promise<ForgeInsightsThreadDetail> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  const threadId = toNonEmptyString(input.threadId);
  if (!threadId) {
    throw new ForgeInsightsApiError("threadId is required.");
  }
  try {
    const response = await api.get(`${FORGE_INSIGHTS_THREADS_PATH}/${encodeURIComponent(threadId)}`, {
      signal: input.signal,
      headers: workspaceHeaders(workspaceId),
    });
    return parseThreadDetailResponse(response.data);
  } catch (error) {
    throw toApiError(error, "Unable to load thread.");
  }
}

export async function getForgeInsightsConversation(input: {
  workspaceId: string;
  conversationId: string;
  signal?: AbortSignal;
}): Promise<ForgeInsightsConversationDetail> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  const conversationId = toNonEmptyString(input.conversationId);
  if (!conversationId) {
    throw new ForgeInsightsApiError("conversationId is required.");
  }
  try {
    const response = await api.get(
      `${FORGE_INSIGHTS_CHAT_PATH}/conversations/${encodeURIComponent(conversationId)}`,
      {
        signal: input.signal,
        headers: workspaceHeaders(workspaceId),
      }
    );
    return parseConversationDetailResponse(response.data, conversationId);
  } catch (error) {
    throw toApiError(error, "Unable to load conversation.");
  }
}

export async function listForgeInsightsConversations(input: {
  workspaceId: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<ForgeInsightsConversationListItem[]> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  try {
    const response = await api.get(`${FORGE_INSIGHTS_CHAT_PATH}/conversations`, {
      signal: input.signal,
      headers: workspaceHeaders(workspaceId),
      params: {
        limit: input.limit ?? 50,
      },
    });
    return parseConversationListResponse(response.data);
  } catch (error) {
    throw toApiError(error, "Unable to load conversations.");
  }
}

export async function deleteForgeInsightsConversation(input: {
  workspaceId: string;
  conversationId: string;
  signal?: AbortSignal;
}): Promise<void> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  const conversationId = toNonEmptyString(input.conversationId);
  if (!conversationId) {
    throw new ForgeInsightsApiError("conversationId is required.");
  }
  try {
    await api.delete(`${FORGE_INSIGHTS_CHAT_PATH}/conversations/${encodeURIComponent(conversationId)}`, {
      signal: input.signal,
      headers: workspaceHeaders(workspaceId),
    });
  } catch (error) {
    throw toApiError(error, "Unable to delete conversation.");
  }
}

export async function patchForgeInsightsThread(input: {
  workspaceId: string;
  threadId: string;
  patch: ForgeInsightsThreadPatch;
  signal?: AbortSignal;
}): Promise<ForgeInsightsThread> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  const threadId = toNonEmptyString(input.threadId);
  if (!threadId) {
    throw new ForgeInsightsApiError("threadId is required.");
  }
  try {
    const response = await api.patch(
      `${FORGE_INSIGHTS_THREADS_PATH}/${encodeURIComponent(threadId)}`,
      normalizeThreadPatch(input.patch),
      {
        signal: input.signal,
        headers: workspaceHeaders(workspaceId),
      }
    );
    const parsed =
      parseThread(response.data) ??
      parseThread(asRecord(response.data)?.thread) ??
      threadFallbackFromResponse(response.data, {
        id: threadId,
        projectId: input.patch.project_id ?? null,
        conversationId: input.patch.conversation_id ?? null,
        title: input.patch.title ?? null,
        previewText: input.patch.preview_text ?? null,
        isPinned: input.patch.is_pinned,
        isArchived: input.patch.is_archived,
        lastMessageAt: input.patch.last_message_at ?? null,
      });
    if (!parsed) {
      throw new ForgeInsightsApiError("Thread response is malformed.");
    }
    return parsed;
  } catch (error) {
    throw toApiError(error, "Unable to update thread.");
  }
}

export async function deleteForgeInsightsThread(input: {
  workspaceId: string;
  threadId: string;
  signal?: AbortSignal;
}): Promise<void> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  const threadId = toNonEmptyString(input.threadId);
  if (!threadId) {
    throw new ForgeInsightsApiError("threadId is required.");
  }
  try {
    await api.delete(`${FORGE_INSIGHTS_THREADS_PATH}/${encodeURIComponent(threadId)}`, {
      signal: input.signal,
      headers: workspaceHeaders(workspaceId),
    });
  } catch (error) {
    throw toApiError(error, "Unable to delete thread.");
  }
}

export async function sendForgeInsightsChatMessage(input: {
  workspaceId: string;
  request: ForgeInsightsChatRequest;
  signal?: AbortSignal;
}): Promise<ForgeInsightsChatResponse> {
  const workspaceId = ensureWorkspaceId(input.workspaceId);
  try {
    const response = await api.post(FORGE_INSIGHTS_CHAT_PATH, input.request, {
      signal: input.signal,
      headers: workspaceHeaders(workspaceId),
    });
    return parseChatResponse(response.data);
  } catch (error) {
    throw toApiError(error, "Unable to send Forge Insights chat message.");
  }
}
