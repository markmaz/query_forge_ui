import api from "../api";
import { toServiceError, type ServiceError } from "../semantic/errors";
import {
  forgeMatchAnalyzeRequestSchema,
  forgeMatchAnalyzeResponseSchema,
  forgeMatchAnalyzeHistoryResponseSchema,
  forgeMatchAnalyzeStartResponseSchema,
  forgeMatchAnalyzeStatusResponseSchema,
  forgeMatchDraftRequestSchema,
  forgeMatchDraftResponseSchema,
  forgeMatchGetSessionParamsSchema,
  forgeMatchListSessionsParamsSchema,
  forgeMatchListSessionsResponseSchema,
  forgeMatchPatchRequestSchema,
  forgeMatchPatchResponseSchema,
  forgeMatchSessionResponseSchema,
  forgeMatchUploadResponseSchema,
  type ForgeMatchAnalyzeRequest,
  type ForgeMatchAnalyzeResponse,
  type ForgeMatchAnalyzeHistoryResponse,
  type ForgeMatchAnalyzeStartResponse,
  type ForgeMatchAnalyzeStatusResponse,
  type ForgeMatchDraftRequest,
  type ForgeMatchDraftResponse,
  type ForgeMatchGetSessionParams,
  type ForgeMatchListSessionsParams,
  type ForgeMatchListSessionsResponse,
  type ForgeMatchPatchRequest,
  type ForgeMatchPatchResponse,
  type ForgeMatchSessionResponse,
  type ForgeMatchUploadResponse,
} from "./contracts";

const BASE_PATH = "/forge-match";

type ExportFormat = "csv" | "xlsx";

function parseOrThrow<T>(
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
  payload: unknown,
  message: string
): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(message);
  }
  return parsed.data;
}

function parseContentDispositionFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1];

  return fallback;
}

export async function uploadForgeMatchFile(file: File): Promise<ForgeMatchUploadResponse> {
  try {
    const form = new FormData();
    form.append("file", file);

    const response = await api.post(`${BASE_PATH}/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return parseOrThrow(
      forgeMatchUploadResponseSchema,
      response.data,
      "Invalid ForgeMatch upload response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to upload ForgeMatch file.");
  }
}

export async function listForgeMatchSessions(
  params: ForgeMatchListSessionsParams = {}
): Promise<ForgeMatchListSessionsResponse> {
  try {
    const queryParams = forgeMatchListSessionsParamsSchema.parse(params);
    const response = await api.get(BASE_PATH, { params: queryParams });

    return parseOrThrow(
      forgeMatchListSessionsResponseSchema,
      response.data,
      "Invalid ForgeMatch sessions list response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to load ForgeMatch sessions.");
  }
}

export async function analyzeForgeMatch(
  sessionId: string,
  body: ForgeMatchAnalyzeRequest = {}
): Promise<ForgeMatchAnalyzeResponse> {
  try {
    const normalizedSessionId = String(sessionId ?? "").trim();
    if (!normalizedSessionId) {
      throw new Error("Session id is required.");
    }

    const request = forgeMatchAnalyzeRequestSchema.parse(body);
    const response = await api.post(`${BASE_PATH}/${normalizedSessionId}/analyze`, request);

    return parseOrThrow(
      forgeMatchAnalyzeResponseSchema,
      response.data,
      "Invalid ForgeMatch analyze response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to analyze ForgeMatch session.");
  }
}

export async function startForgeMatchAnalyze(
  sessionId: string,
  body: ForgeMatchAnalyzeRequest = {}
): Promise<ForgeMatchAnalyzeStartResponse> {
  try {
    const normalizedSessionId = String(sessionId ?? "").trim();
    if (!normalizedSessionId) {
      throw new Error("Session id is required.");
    }

    const request = forgeMatchAnalyzeRequestSchema.parse(body);
    const response = await api.post(`${BASE_PATH}/${normalizedSessionId}/analyze/start`, request);

    return parseOrThrow(
      forgeMatchAnalyzeStartResponseSchema,
      response.data,
      "Invalid ForgeMatch analyze start response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to start ForgeMatch analyze session.");
  }
}

export async function getForgeMatchAnalyzeStatus(jobId: string): Promise<ForgeMatchAnalyzeStatusResponse> {
  try {
    const normalizedJobId = String(jobId ?? "").trim();
    if (!normalizedJobId) {
      throw new Error("Job id is required.");
    }

    const response = await api.get(`${BASE_PATH}/status/${normalizedJobId}`);
    return parseOrThrow(
      forgeMatchAnalyzeStatusResponseSchema,
      response.data,
      "Invalid ForgeMatch analyze status response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to load ForgeMatch analyze status.");
  }
}

export async function cancelForgeMatchAnalyze(jobId: string): Promise<ForgeMatchAnalyzeStatusResponse> {
  try {
    const normalizedJobId = String(jobId ?? "").trim();
    if (!normalizedJobId) {
      throw new Error("Job id is required.");
    }

    const response = await api.post(`${BASE_PATH}/cancel/${normalizedJobId}`);
    return parseOrThrow(
      forgeMatchAnalyzeStatusResponseSchema,
      response.data,
      "Invalid ForgeMatch cancel response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to cancel ForgeMatch analyze run.");
  }
}

export async function getForgeMatchAnalyzeHistory(limit = 20): Promise<ForgeMatchAnalyzeHistoryResponse> {
  try {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    const response = await api.get(`${BASE_PATH}/history`, {
      params: { limit: safeLimit },
    });

    const normalized = Array.isArray(response.data) ? { rows: response.data } : response.data;
    return parseOrThrow(
      forgeMatchAnalyzeHistoryResponseSchema,
      normalized,
      "Invalid ForgeMatch analyze history response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to load ForgeMatch analyze history.");
  }
}

export async function getForgeMatchSession(
  sessionId: string,
  params: ForgeMatchGetSessionParams = {}
): Promise<ForgeMatchSessionResponse> {
  try {
    const normalizedSessionId = String(sessionId ?? "").trim();
    if (!normalizedSessionId) {
      throw new Error("Session id is required.");
    }

    const queryParams = forgeMatchGetSessionParamsSchema.parse(params);
    const response = await api.get(`${BASE_PATH}/${normalizedSessionId}`, {
      params: queryParams,
    });

    return parseOrThrow(
      forgeMatchSessionResponseSchema,
      response.data,
      "Invalid ForgeMatch session response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to load ForgeMatch session.");
  }
}

export async function patchForgeMatchMappings(
  sessionId: string,
  updates: ForgeMatchPatchRequest["updates"]
): Promise<ForgeMatchPatchResponse> {
  try {
    const normalizedSessionId = String(sessionId ?? "").trim();
    if (!normalizedSessionId) {
      throw new Error("Session id is required.");
    }

    const request = forgeMatchPatchRequestSchema.parse({ updates });
    const response = await api.patch(`${BASE_PATH}/${normalizedSessionId}/mappings`, request);

    return parseOrThrow(
      forgeMatchPatchResponseSchema,
      response.data,
      "Invalid ForgeMatch patch response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to update ForgeMatch mappings.");
  }
}

export async function exportForgeMatch(
  sessionId: string,
  format: ExportFormat
): Promise<{ blob: Blob; filename: string }> {
  try {
    const normalizedSessionId = String(sessionId ?? "").trim();
    if (!normalizedSessionId) {
      throw new Error("Session id is required.");
    }

    const response = await api.get(`${BASE_PATH}/${normalizedSessionId}/export`, {
      params: { format },
      responseType: "blob",
    });

    const filename = parseContentDispositionFilename(
      response.headers?.["content-disposition"] ?? null,
      `forge_match_${normalizedSessionId}.${format}`
    );

    return {
      blob: response.data as Blob,
      filename,
    };
  } catch (error) {
    throw toServiceError(error, `Unable to export ForgeMatch ${format.toUpperCase()}.`);
  }
}

export async function createForgeMatchViewDraft(
  sessionId: string,
  body: ForgeMatchDraftRequest = {}
): Promise<ForgeMatchDraftResponse> {
  try {
    const normalizedSessionId = String(sessionId ?? "").trim();
    if (!normalizedSessionId) {
      throw new Error("Session id is required.");
    }

    const request = forgeMatchDraftRequestSchema.parse(body);
    const response = await api.post(`${BASE_PATH}/${normalizedSessionId}/create-view-draft`, request);

    return parseOrThrow(
      forgeMatchDraftResponseSchema,
      response.data,
      "Invalid ForgeMatch view draft response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to create ForgeMatch view draft.");
  }
}

export async function createForgeMatchDomainDraft(
  sessionId: string,
  body: ForgeMatchDraftRequest = {}
): Promise<ForgeMatchDraftResponse> {
  try {
    const normalizedSessionId = String(sessionId ?? "").trim();
    if (!normalizedSessionId) {
      throw new Error("Session id is required.");
    }

    const request = forgeMatchDraftRequestSchema.parse(body);
    const response = await api.post(`${BASE_PATH}/${normalizedSessionId}/create-domain-draft`, request);

    return parseOrThrow(
      forgeMatchDraftResponseSchema,
      response.data,
      "Invalid ForgeMatch domain draft response."
    );
  } catch (error) {
    throw toServiceError(error, "Unable to create ForgeMatch domain draft.");
  }
}

export function normalizeForgeMatchError(error: unknown, fallbackMessage: string): ServiceError {
  return toServiceError(error, fallbackMessage);
}
