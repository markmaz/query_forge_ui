import axios from "axios";
import { getAccessToken } from "@/shared/runtime/accessTokenStore";
import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  SemanticCatalogBuildRequest,
  SemanticCatalogBuildRequestBody,
  SemanticCatalogBuildResponse,
  SemanticCatalogBuildResult,
  SemanticCatalogPreviewRow,
  SemanticCatalogValidationErrors,
} from "../types";

export type {
  SemanticCatalogBuildRequest,
  SemanticCatalogBuildRequestBody,
  SemanticCatalogBuildResponse,
  SemanticCatalogBuildResult,
  SemanticCatalogPreviewRow,
  SemanticCatalogValidationErrors,
} from "../types";

const TABLE_LIMIT_MIN = 1;
const TABLE_LIMIT_MAX = 50_000;
const TABLE_LIMIT_DEFAULT = 5_000;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function toPreviewRows(value: unknown): SemanticCatalogPreviewRow[] {
  return asArray(value).map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return row as SemanticCatalogPreviewRow;
    }
    return { value: row };
  });
}

function toValidationErrors(value: unknown): SemanticCatalogValidationErrors {
  if (Array.isArray(value)) {
    const messages = value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return messages.length > 0 ? { _error: messages } : {};
  }

  const record = asRecord(value);
  const entries = Object.entries(record).reduce<SemanticCatalogValidationErrors>((acc, [key, raw]) => {
    if (Array.isArray(raw)) {
      const messages = raw
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry));
      if (messages.length > 0) {
        acc[key] = messages;
      }
      return acc;
    }

    const message = asString(raw);
    if (message) {
      acc[key] = [message];
    }
    return acc;
  }, {});

  return entries;
}

function buildErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const statusMessage = asString(data.error) ?? asString(data.message) ?? asString(data.detail);
  return statusMessage ?? fallback;
}

export class SemanticCatalogBuildApiError extends Error {
  readonly status: number | null;
  readonly fieldErrors: SemanticCatalogValidationErrors;

  constructor(message: string, status: number | null = null, fieldErrors: SemanticCatalogValidationErrors = {}) {
    super(message);
    this.name = "SemanticCatalogBuildApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function toSemanticCatalogBuildPayload(
  payload: SemanticCatalogBuildRequest,
): SemanticCatalogBuildRequestBody {
  const domainId = asNumber(payload.domain_id, Number.NaN);
  const tableLimit = asNumber(payload.table_limit, TABLE_LIMIT_DEFAULT);

  const validationErrors: SemanticCatalogValidationErrors = {};

  if (!Number.isInteger(domainId) || domainId <= 0) {
    validationErrors.domain_id = ["Domain ID is required and must be a positive integer."];
  }

  if (!Number.isInteger(tableLimit) || tableLimit < TABLE_LIMIT_MIN || tableLimit > TABLE_LIMIT_MAX) {
    validationErrors.table_limit = [`Table limit must be between ${TABLE_LIMIT_MIN} and ${TABLE_LIMIT_MAX}.`];
  }

  if (Object.keys(validationErrors).length > 0) {
    throw new SemanticCatalogBuildApiError("Invalid build request.", 400, validationErrors);
  }

  const domainName = asString(payload.domain_name);

  return {
    domain_id: domainId,
    domain_name: domainName ?? undefined,
    dry_run: asBoolean(payload.dry_run, true),
    table_limit: tableLimit,
  };
}

export function normalizeSemanticCatalogBuildResponse(raw: unknown): SemanticCatalogBuildResponse {
  const root = asRecord(raw);
  const resultRaw = asRecord(root.result);

  const result: SemanticCatalogBuildResult = {
    workspace_id: asString(resultRaw.workspace_id),
    domain_id: asNumber(resultRaw.domain_id),
    domain_name: asString(resultRaw.domain_name),
    profile_count: asNumber(resultRaw.profile_count),
    enriched_count: asNumber(resultRaw.enriched_count),
    concepts_upserted: asNumber(resultRaw.concepts_upserted),
    aliases_upserted: asNumber(resultRaw.aliases_upserted),
    relationships_upserted: asNumber(resultRaw.relationships_upserted),
    value_aliases_upserted: asNumber(resultRaw.value_aliases_upserted),
    derived_metrics_created: asNumber(resultRaw.derived_metrics_created),
    index_items_count: asNumber(resultRaw.index_items_count),
    dry_run: asBoolean(resultRaw.dry_run, true),
    concept_preview: toPreviewRows(resultRaw.concept_preview),
    alias_preview: toPreviewRows(resultRaw.alias_preview),
    relationship_preview: toPreviewRows(resultRaw.relationship_preview),
    index_preview: toPreviewRows(resultRaw.index_preview),
  };

  return { result };
}

export function parseSemanticCatalogBuildError(
  error: unknown,
  fallbackMessage = "Semantic catalog build failed.",
): SemanticCatalogBuildApiError {
  if (error instanceof SemanticCatalogBuildApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const data = asRecord(error.response?.data);
    const detail = asRecord(data.details);
    const fieldErrors = toValidationErrors(detail.errors);

    if (status === 403) {
      return new SemanticCatalogBuildApiError("Admin access required", status, fieldErrors);
    }

    return new SemanticCatalogBuildApiError(
      buildErrorMessage(data, fallbackMessage),
      status,
      fieldErrors,
    );
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new SemanticCatalogBuildApiError(error.message.trim());
  }

  return new SemanticCatalogBuildApiError(fallbackMessage);
}

function buildAdminHeaders(workspaceId: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Workspace-Id": workspaceId,
  };

  const accessToken = getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

export async function buildSemanticCatalog(
  payload: SemanticCatalogBuildRequest,
  workspaceId?: string | null,
): Promise<SemanticCatalogBuildResponse> {
  const resolvedWorkspaceId = asString(workspaceId) ?? asString(getApiWorkspaceId());
  if (!resolvedWorkspaceId) {
    throw new SemanticCatalogBuildApiError("Workspace context is required to build semantic catalog.", 400, {
      workspace_id: ["Workspace context is required."],
    });
  }

  const body = toSemanticCatalogBuildPayload(payload);

  try {
    const { data } = await api.post(
      "/admin/semantic-catalog/build",
      body,
      {
        headers: buildAdminHeaders(resolvedWorkspaceId),
      },
    );

    return normalizeSemanticCatalogBuildResponse(data);
  } catch (error) {
    throw parseSemanticCatalogBuildError(error);
  }
}
