import { getAccessToken } from "@/shared/runtime/accessTokenStore";
import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  FeedbackLearningAnalysisSummary,
  FeedbackLearningBulkDecisionResponse,
  FeedbackLearningCandidateDecisionResponse,
  FeedbackLearningCandidateDetail,
  FeedbackLearningCandidateFilters,
  FeedbackLearningCandidateListResponse,
  FeedbackLearningCandidateRow,
  FeedbackLearningOverrideListResponse,
  FeedbackLearningOverrideRow,
  FeedbackLearningPromotionAuditFilters,
  FeedbackLearningPromotionAuditListResponse,
  FeedbackLearningPromotionAuditRow,
  FeedbackLearningSourceFeedbackSummary,
} from "../model/types";

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

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asObjectOrNull(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
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

function normalizeSourceFeedback(raw: unknown): FeedbackLearningSourceFeedbackSummary | null {
  const row = asRecord(raw);
  if (Object.keys(row).length === 0) return null;
  return {
    prompt_feedback_id: asNumber(row.prompt_feedback_id),
    workspace_id: asString(row.workspace_id),
    user_id: asString(row.user_id),
    vote: asString(row.vote),
    normalized_prompt: asString(row.normalized_prompt),
    prompt_text: asString(row.prompt_text),
  };
}

function normalizeAnalysisSummary(raw: unknown): FeedbackLearningAnalysisSummary | null {
  const row = asRecord(raw);
  if (Object.keys(row).length === 0) return null;
  return {
    analysis_id: asNumber(row.analysis_id),
    prompt_feedback_id: asNumber(row.prompt_feedback_id),
    status: asString(row.status),
    failure_verdict: asString(row.failure_verdict),
    confidence: asNumber(row.confidence),
    analysis_json: asObjectOrNull(row.analysis_json),
  };
}

function normalizeCandidateRow(raw: unknown): FeedbackLearningCandidateRow {
  const row = asRecord(raw);
  return {
    id: asNumber(row.id) ?? 0,
    failure_analysis_id: asNumber(row.failure_analysis_id) ?? 0,
    target_type: (asString(row.target_type) ?? "manual_review") as FeedbackLearningCandidateRow["target_type"],
    concept_key: asString(row.concept_key),
    domain_key: asString(row.domain_key),
    change_type: asString(row.change_type) ?? "unknown",
    payload_json: asObjectOrNull(row.payload_json) ?? {},
    payload_hash: asString(row.payload_hash) ?? "",
    risk_level: (asString(row.risk_level) ?? "medium") as FeedbackLearningCandidateRow["risk_level"],
    evidence_count: asNumber(row.evidence_count) ?? 0,
    confidence: asNumber(row.confidence) ?? 0,
    governance_status: (asString(row.governance_status) ?? "pending") as FeedbackLearningCandidateRow["governance_status"],
    auto_apply_eligible: asBoolean(row.auto_apply_eligible),
    governance_reason_code: asString(row.governance_reason_code),
    review_notes: asString(row.review_notes),
    workspace_id: asString(row.workspace_id),
    source_scope: asString(row.source_scope) ?? "global",
    workspace_scope_key: asString(row.workspace_scope_key) ?? "__global__",
    analysis_summary: normalizeAnalysisSummary(row.analysis_summary),
    source_feedback: normalizeSourceFeedback(row.source_feedback),
  };
}

function normalizeOverrideRow(raw: unknown): FeedbackLearningOverrideRow {
  const row = asRecord(raw);
  return {
    id: asNumber(row.id) ?? 0,
    status: asString(row.status) ?? "unknown",
    workspace_id: asString(row.workspace_id),
    concept_key: asString(row.concept_key),
    domain_key: asString(row.domain_key),
    override_type: asString(row.override_type),
    override_key: asString(row.override_key),
    override_value_json: asObjectOrNull(row.override_value_json),
    approved_by: asString(row.approved_by),
  };
}

function normalizePromotionAuditRow(raw: unknown): FeedbackLearningPromotionAuditRow {
  const row = asRecord(raw);
  return {
    id: asNumber(row.id) ?? 0,
    source_type: asString(row.source_type),
    source_id: asNumber(row.source_id),
    target_table: asString(row.target_table),
    target_record_key: asString(row.target_record_key),
    promotion_action: asString(row.promotion_action),
    promotion_status: asString(row.promotion_status),
    promoted_by: asString(row.promoted_by),
    promoted_at: asString(row.promoted_at),
    retry_count: asNumber(row.retry_count),
    last_retry_at: asString(row.last_retry_at),
    notes: asString(row.notes),
    error_message: asString(row.error_message),
  };
}

function normalizeDecisionResponse(raw: unknown): FeedbackLearningCandidateDecisionResponse {
  const row = asRecord(raw);
  return {
    candidate: normalizeCandidateRow(row.candidate),
    candidate_status: asString(row.candidate_status),
    override: row.override ? normalizeOverrideRow(row.override) : null,
  };
}

function normalizeCandidateFilters(
  params: FeedbackLearningCandidateFilters = {},
): Record<string, unknown> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    page_size: params.page_size ?? 50,
  };

  if (params.governance_status) query.governance_status = params.governance_status;
  if (params.risk_level) query.risk_level = params.risk_level;
  if (params.target_type) query.target_type = params.target_type;
  if (params.workspace_id?.trim()) query.workspace_id = params.workspace_id.trim();
  if (params.change_type?.trim()) query.change_type = params.change_type.trim();
  if (params.concept_key?.trim()) query.concept_key = params.concept_key.trim();
  if (params.domain_key?.trim()) query.domain_key = params.domain_key.trim();

  return query;
}

function normalizeAuditFilters(
  params: FeedbackLearningPromotionAuditFilters = {},
): Record<string, unknown> {
  const query: Record<string, unknown> = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  };
  if (params.source_type?.trim()) query.source_type = params.source_type.trim();
  if (params.promotion_status?.trim()) {
    query.promotion_status = params.promotion_status.trim();
  }
  return query;
}

export async function listFeedbackLearningCandidates(
  params: FeedbackLearningCandidateFilters = {},
): Promise<FeedbackLearningCandidateListResponse> {
  const query = normalizeCandidateFilters(params);
  const { data } = await api.get("/feedback-learning/candidates", {
    params: query,
    headers: getAdminHeaders(),
  });
  const record = asRecord(data);
  const rawRows = Array.isArray(record.rows) ? record.rows : [];
  return {
    rows: rawRows.map(normalizeCandidateRow),
    total: asNumber(record.total) ?? rawRows.length,
    page: asNumber(record.page) ?? Number(query.page),
    page_size: asNumber(record.page_size) ?? Number(query.page_size),
  };
}

export async function getFeedbackLearningCandidateDetail(
  candidateId: number,
): Promise<FeedbackLearningCandidateDetail> {
  const { data } = await api.get(`/feedback-learning/candidates/${candidateId}`, {
    headers: getAdminHeaders(),
  });
  const record = asRecord(data);
  return {
    candidate: normalizeCandidateRow(record.candidate),
    analysis_summary: normalizeAnalysisSummary(record.analysis_summary),
    source_feedback: normalizeSourceFeedback(record.source_feedback),
    effective_target_key: asString(record.effective_target_key),
  };
}

export async function approveFeedbackLearningCandidate(
  candidateId: number,
): Promise<FeedbackLearningCandidateDecisionResponse> {
  const { data } = await api.post(
    `/feedback-learning/candidates/${candidateId}/approve`,
    {},
    { headers: getAdminHeaders() },
  );
  return normalizeDecisionResponse(data);
}

export async function rejectFeedbackLearningCandidate(
  candidateId: number,
  reason: string,
): Promise<FeedbackLearningCandidateDecisionResponse> {
  const { data } = await api.post(
    `/feedback-learning/candidates/${candidateId}/reject`,
    { reason },
    { headers: getAdminHeaders() },
  );
  return normalizeDecisionResponse(data);
}

export async function bulkApproveFeedbackLearningCandidates(
  candidateIds: number[],
): Promise<FeedbackLearningBulkDecisionResponse> {
  const { data } = await api.post(
    "/feedback-learning/candidates/bulk-approve",
    { candidate_ids: candidateIds },
    { headers: getAdminHeaders() },
  );
  const record = asRecord(data);
  const rawResults = Array.isArray(record.results) ? record.results : [];
  return {
    processed: asNumber(record.processed) ?? rawResults.length,
    results: rawResults.map(normalizeDecisionResponse),
  };
}

export async function bulkRejectFeedbackLearningCandidates(
  candidateIds: number[],
  reason: string,
): Promise<FeedbackLearningBulkDecisionResponse> {
  const { data } = await api.post(
    "/feedback-learning/candidates/bulk-reject",
    { candidate_ids: candidateIds, reason },
    { headers: getAdminHeaders() },
  );
  const record = asRecord(data);
  const rawResults = Array.isArray(record.results) ? record.results : [];
  return {
    processed: asNumber(record.processed) ?? rawResults.length,
    results: rawResults.map(normalizeDecisionResponse),
  };
}

export async function listFeedbackLearningSemanticOverrides(
  workspaceId?: string,
): Promise<FeedbackLearningOverrideListResponse> {
  const { data } = await api.get("/feedback-learning/semantic-overrides", {
    params: workspaceId?.trim() ? { workspace_id: workspaceId.trim() } : undefined,
    headers: getAdminHeaders(),
  });
  const record = asRecord(data);
  const rawRows = Array.isArray(record.rows) ? record.rows : [];
  return { rows: rawRows.map(normalizeOverrideRow) };
}

export async function listFeedbackLearningDomainOverrides(
  workspaceId?: string,
): Promise<FeedbackLearningOverrideListResponse> {
  const { data } = await api.get("/feedback-learning/domain-overrides", {
    params: workspaceId?.trim() ? { workspace_id: workspaceId.trim() } : undefined,
    headers: getAdminHeaders(),
  });
  const record = asRecord(data);
  const rawRows = Array.isArray(record.rows) ? record.rows : [];
  return { rows: rawRows.map(normalizeOverrideRow) };
}

export async function deactivateFeedbackLearningSemanticOverride(
  overrideId: number,
): Promise<FeedbackLearningOverrideRow> {
  const { data } = await api.post(
    `/feedback-learning/semantic-overrides/${overrideId}/deactivate`,
    {},
    { headers: getAdminHeaders() },
  );
  return normalizeOverrideRow(data);
}

export async function deactivateFeedbackLearningDomainOverride(
  overrideId: number,
): Promise<FeedbackLearningOverrideRow> {
  const { data } = await api.post(
    `/feedback-learning/domain-overrides/${overrideId}/deactivate`,
    {},
    { headers: getAdminHeaders() },
  );
  return normalizeOverrideRow(data);
}

export async function listFeedbackLearningPromotionAudits(
  params: FeedbackLearningPromotionAuditFilters = {},
): Promise<FeedbackLearningPromotionAuditListResponse> {
  const query = normalizeAuditFilters(params);
  const { data } = await api.get("/feedback-learning/promotion-audits", {
    params: query,
    headers: getAdminHeaders(),
  });
  const record = asRecord(data);
  const rawRows = Array.isArray(record.rows) ? record.rows : [];
  return {
    rows: rawRows.map(normalizePromotionAuditRow),
    total: asNumber(record.total) ?? rawRows.length,
    limit: asNumber(record.limit) ?? Number(query.limit),
    offset: asNumber(record.offset) ?? Number(query.offset),
  };
}
