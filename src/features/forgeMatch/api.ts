import {
  analyzeForgeMatch,
  cancelForgeMatchAnalyze,
  createForgeMatchDomainDraft,
  createForgeMatchViewDraft,
  deleteForgeMatchSession as deleteForgeMatchSessionService,
  exportForgeMatch,
  getForgeMatchAnalyzeHistory,
  getForgeMatchAnalyzeStatus,
  getForgeMatchSession,
  listForgeMatchSessions as listForgeMatchSessionsService,
  patchForgeMatchMappings,
  startForgeMatchAnalyze,
  uploadForgeMatchFile,
  type ForgeMatchAnalyzeRequest,
  type ForgeMatchDraftRequest,
  type ForgeMatchListSessionsParams,
  type ForgeMatchPatchRequest,
} from "@/shared/services/forgeMatch";

export async function uploadForgeMatchDocument(file: File) {
  return uploadForgeMatchFile(file);
}

export async function listForgeMatchSessions(params: {
  page?: number;
  pageSize?: number;
  status?: ForgeMatchListSessionsParams["status"] | "all";
  q?: string;
} = {}) {
  const normalized: ForgeMatchListSessionsParams = {
    page: params.page,
    page_size: params.pageSize,
    q: params.q?.trim() ? params.q.trim() : undefined,
    status: params.status && params.status !== "all" ? params.status : undefined,
  };
  return listForgeMatchSessionsService(normalized);
}

export async function analyzeForgeMatchSession(sessionId: string, body: ForgeMatchAnalyzeRequest = {}) {
  return analyzeForgeMatch(sessionId, body);
}

export async function startForgeMatchAnalyzeSession(
  sessionId: string,
  body: ForgeMatchAnalyzeRequest = {}
) {
  return startForgeMatchAnalyze(sessionId, body);
}

export async function fetchForgeMatchAnalyzeStatus(jobId: string) {
  return getForgeMatchAnalyzeStatus(jobId);
}

export async function cancelForgeMatchAnalyzeSession(jobId: string) {
  return cancelForgeMatchAnalyze(jobId);
}

export async function fetchForgeMatchAnalyzeHistory(limit = 20) {
  return getForgeMatchAnalyzeHistory(limit);
}

export async function fetchForgeMatchSession(sessionId: string, params: { source_offset?: number; mapping_offset?: number } = {}) {
  return getForgeMatchSession(sessionId, {
    source_limit: 500,
    source_offset: params.source_offset ?? 0,
    mapping_limit: 2000,
    mapping_offset: params.mapping_offset ?? 0,
  });
}

export async function deleteForgeMatchSession(sessionId: string) {
  return deleteForgeMatchSessionService(sessionId);
}

export async function updateForgeMatchMappings(
  sessionId: string,
  updates: ForgeMatchPatchRequest["updates"]
) {
  return patchForgeMatchMappings(sessionId, updates);
}

export async function exportForgeMatchSession(sessionId: string, format: "csv" | "xlsx") {
  return exportForgeMatch(sessionId, format);
}

export async function createForgeMatchDraft(
  sessionId: string,
  kind: "view_draft" | "domain_draft",
  body: ForgeMatchDraftRequest = {}
) {
  if (kind === "view_draft") {
    return createForgeMatchViewDraft(sessionId, body);
  }
  return createForgeMatchDomainDraft(sessionId, body);
}
