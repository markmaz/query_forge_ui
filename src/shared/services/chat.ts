import axios from "axios";

import api from "./api";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  stream: false;
  temperature: number;
  max_tokens: number;
  debug: boolean;
};

export type ChatResponse = {
  assistant?: Partial<ChatMessage> | null;
  message?: Partial<ChatMessage> | null;
  messages?: Array<Partial<ChatMessage>> | null;
  content?: string | null;
  response?: string | null;
  text?: string | null;
  output_text?: string | null;
  debug?: unknown;
  [key: string]: unknown;
};

export type MinimalChatResult = {
  assistant: ChatMessage;
  raw: ChatResponse;
};

export type SendMinimalChatInput = {
  workspaceId?: string | null;
  messages: ChatMessage[];
  debug?: boolean;
  signal?: AbortSignal;
};

const CHAT_MINIMAL_PATH = "/chat/minimal";

function isChatRole(value: unknown): value is ChatRole {
  return value === "user" || value === "assistant" || value === "system";
}

function normalizeMessageCandidate(value: unknown, fallbackRole: ChatRole): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const content = typeof candidate.content === "string" ? candidate.content : null;
  if (!content?.trim()) return null;

  const role = isChatRole(candidate.role) ? candidate.role : fallbackRole;
  return { role, content };
}

function extractAssistantMessage(response: ChatResponse): ChatMessage {
  const directAssistant = normalizeMessageCandidate(response.assistant, "assistant");
  if (directAssistant) return { ...directAssistant, role: "assistant" };

  const directMessage = normalizeMessageCandidate(response.message, "assistant");
  if (directMessage) return { ...directMessage, role: "assistant" };

  if (Array.isArray(response.messages)) {
    for (let i = response.messages.length - 1; i >= 0; i -= 1) {
      const parsed = normalizeMessageCandidate(response.messages[i], "assistant");
      if (parsed && parsed.role === "assistant") {
        return parsed;
      }
    }
    for (let i = response.messages.length - 1; i >= 0; i -= 1) {
      const parsed = normalizeMessageCandidate(response.messages[i], "assistant");
      if (parsed) return { ...parsed, role: "assistant" };
    }
  }

  const textCandidates = [response.output_text, response.response, response.text, response.content];
  for (const value of textCandidates) {
    if (typeof value === "string" && value.trim()) {
      return { role: "assistant", content: value };
    }
  }

  throw new Error("Chat response did not include assistant content.");
}

function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const value = record.detail ?? record.message ?? record.error;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function sendMinimalChat(input: SendMinimalChatInput): Promise<MinimalChatResult> {
  const request: ChatRequest = {
    messages: input.messages,
    stream: false,
    temperature: 0.2,
    max_tokens: 512,
    debug: Boolean(input.debug),
  };

  try {
    const response = await api.post<ChatResponse>(CHAT_MINIMAL_PATH, request, {
      signal: input.signal,
      headers: input.workspaceId ? { "X-Workspace-Id": String(input.workspaceId) } : undefined,
    });

    const raw = (response.data ?? {}) as ChatResponse;
    return {
      assistant: extractAssistantMessage(raw),
      raw,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = extractErrorMessage(error.response?.data) ?? error.message ?? "Chat request failed";
      throw new Error(message);
    }
    if (error instanceof Error) throw error;
    throw new Error("Chat request failed");
  }
}

