import { getAccessToken } from "@/shared/runtime/accessTokenStore";
import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  PromptFeedbackListParams,
  PromptFeedbackListResponse,
  PromptFeedbackRow,
  PromptFeedbackVote,
} from "../types";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asVote(value: unknown): PromptFeedbackVote {
  return value === "down" ? "down" : "up";
}

function normalizeRow(raw: unknown): PromptFeedbackRow {
  const row = asRecord(raw);
  const payload = row.payload;
  return {
    id: asNumber(row.id) ?? 0,
    vote: asVote(row.vote),
    user_id: asString(row.user_id),
    trace_id: asString(row.trace_id),
    normalized_prompt: asString(row.normalized_prompt),
    prompt_text: asString(row.prompt_text),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    payload:
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null,
  };
}

function getAdminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const accessToken = getAccessToken();
  const workspaceId = getApiWorkspaceId();

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (workspaceId) {
    headers["X-Workspace-Id"] = workspaceId;
  }

  return headers;
}

function normalizeParams(params: PromptFeedbackListParams): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  };

  if (params.vote) normalized.vote = params.vote;
  if (params.user_id?.trim()) normalized.user_id = params.user_id.trim();
  if (params.trace_id?.trim()) normalized.trace_id = params.trace_id.trim();
  normalized.include_payload = params.include_payload ? "true" : "false";

  return normalized;
}

export async function listPromptFeedback(
  params: PromptFeedbackListParams = {}
): Promise<PromptFeedbackListResponse> {
  const query = normalizeParams(params);
  const { data } = await api.get("/admin/prompt-feedback", {
    params: query,
    headers: getAdminHeaders(),
  });

  const record = asRecord(data);
  const rawRows = Array.isArray(record.rows)
    ? record.rows
    : Array.isArray(record.items)
      ? record.items
      : [];
  const rows = rawRows.map(normalizeRow);
  const limit = asNumber(record.limit) ?? (query.limit as number);
  const offset = asNumber(record.offset) ?? (query.offset as number);
  const total = asNumber(record.total) ?? asNumber(record.count) ?? rows.length;

  return { rows, total, limit, offset };
}

export async function deletePromptFeedback(id: number): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/admin/prompt-feedback/${id}`, {
    headers: getAdminHeaders(),
  });
  const record = asRecord(data);
  return {
    deleted: record.deleted === true,
  };
}
