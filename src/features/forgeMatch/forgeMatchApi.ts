import {
  analyzeForgeMatchSession,
  cancelForgeMatchAnalyzeSession,
  createForgeMatchDraft,
  exportForgeMatchSession,
  fetchForgeMatchAnalyzeHistory,
  fetchForgeMatchAnalyzeStatus,
  fetchForgeMatchSession,
  startForgeMatchAnalyzeSession,
  updateForgeMatchMappings,
  uploadForgeMatchDocument,
} from "./api";
import type {
  ForgeMatchAnalyzeRequest,
  ForgeMatchDraftRequest,
  ForgeMatchPatchRequest,
} from "./types";

export async function uploadForgeMatchFile(file: File) {
  return uploadForgeMatchDocument(file);
}

export async function analyzeForgeMatch(sessionId: string, body: ForgeMatchAnalyzeRequest = {}) {
  return analyzeForgeMatchSession(sessionId, body);
}

export async function startForgeMatchAnalyze(sessionId: string, body: ForgeMatchAnalyzeRequest = {}) {
  return startForgeMatchAnalyzeSession(sessionId, body);
}

export async function getForgeMatchAnalyzeStatus(jobId: string) {
  return fetchForgeMatchAnalyzeStatus(jobId);
}

export async function cancelForgeMatchAnalyze(jobId: string) {
  return cancelForgeMatchAnalyzeSession(jobId);
}

export async function getForgeMatchAnalyzeHistory(limit?: number) {
  return fetchForgeMatchAnalyzeHistory(limit);
}

export async function getForgeMatchSession(
  sessionId: string,
  params: { source_offset?: number; mapping_offset?: number } = {}
) {
  return fetchForgeMatchSession(sessionId, params);
}

export async function patchForgeMatchMappings(
  sessionId: string,
  updates: ForgeMatchPatchRequest["updates"]
) {
  return updateForgeMatchMappings(sessionId, updates);
}

export async function exportForgeMatch(sessionId: string, format: "csv" | "xlsx") {
  return exportForgeMatchSession(sessionId, format);
}

export async function createForgeMatchViewDraft(sessionId: string, body: ForgeMatchDraftRequest = {}) {
  return createForgeMatchDraft(sessionId, "view_draft", body);
}

export async function createForgeMatchDomainDraft(sessionId: string, body: ForgeMatchDraftRequest = {}) {
  return createForgeMatchDraft(sessionId, "domain_draft", body);
}
