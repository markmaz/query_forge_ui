import axios from "axios";

import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  PlannerDomainCapabilityListResponse,
  PlannerDomainCapabilityRow,
  PlannerDomainCapabilityUpsertRequest,
  PlannerPolicyCandidateReviewStatus,
  PlannerPolicyCapabilityKey,
  PlannerPolicyCandidateSourceType,
  PlannerPolicyScopeType,
  PlannerPolicySignalKey,
  PlannerPolicySourceType,
  PlannerPolicySupportLevel,
  PlannerRerankPolicyCandidateApproveRequest,
  PlannerRerankPolicyCandidateApproveResponse,
  PlannerRerankPolicyCandidateCreateRequest,
  PlannerRerankPolicyCandidateListResponse,
  PlannerRerankPolicyCandidateRow,
  PlannerRerankPolicyCandidateSuggestDomainSnapshot,
  PlannerRerankPolicyCandidateSuggestRequest,
  PlannerRerankPolicyCandidateSuggestResponse,
  PlannerRerankPolicyListResponse,
  PlannerRerankPolicyRow,
  PlannerRerankPolicyRule,
  PlannerRerankPolicyUpsertRequest,
} from "../types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(token);
  }
  return false;
}

function workspaceRequestConfig() {
  const workspaceId = getApiWorkspaceId();
  if (!workspaceId) return {};
  return { headers: { "X-Workspace-Id": workspaceId } };
}

function parsePlannerPolicyApiError(error: unknown, fallbackMessage: string): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as
      | { error?: string; message?: string; detail?: string }
      | undefined;
    if (status === 403) return new Error("Admin access required");
    const apiMessage = data?.error ?? data?.message ?? data?.detail;
    if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
      return new Error(apiMessage.trim());
    }
    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return new Error(error.message.trim());
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return new Error(error.message.trim());
  }
  return new Error(fallbackMessage);
}

const SCOPE_TYPES = new Set<PlannerPolicyScopeType>([
  "global",
  "vertical",
  "workspace",
  "global_domain",
  "vertical_domain",
  "workspace_domain",
]);

const SUPPORT_LEVELS = new Set<PlannerPolicySupportLevel>(["direct", "derived", "partial"]);
const SOURCE_TYPES = new Set<PlannerPolicySourceType>([
  "semantic_concept",
  "metric",
  "dimension",
  "filter",
  "derived_condition",
  "heuristic_inference",
]);
const CANDIDATE_SOURCE_TYPES = new Set<PlannerPolicyCandidateSourceType>([
  "ai_recommendation",
  "manual",
  "trace_review",
]);
const REVIEW_STATUSES = new Set<PlannerPolicyCandidateReviewStatus>([
  "pending",
  "approved",
  "rejected",
]);

const SIGNAL_KEYS = new Set<PlannerPolicySignalKey>([
  "student_listing",
  "student_aggregate",
  "staff_listing",
  "staff_aggregate",
  "school_aggregate",
  "age_extreme_prompt",
  "birth_month_prompt",
  "calendar_days_off_prompt",
  "school_literal_present",
  "district_literal_present",
  "time_constraint_present",
  "status_enrolled",
  "status_active",
  "subgroup_prompt",
  "program_prompt",
  "staff_role_prompt",
  "needs_student_identity",
  "needs_school_filter",
  "needs_enrollment_status",
  "needs_attendance_metric",
  "needs_grade_metric",
  "needs_program_membership",
  "listing_intent",
  "aggregate_intent",
  "grouped_aggregate",
]);

const CAPABILITY_KEYS = new Set<PlannerPolicyCapabilityKey>([
  "STUDENT_IDENTITY",
  "BIRTH_DATE",
  "AGE",
  "STAFF_IDENTITY",
  "SCHOOL_IDENTITY",
  "SCHOOL_NAME",
  "CALENDAR_DATE",
  "SCHOOL_DAY_FLAG",
  "NON_INSTRUCTIONAL_DAY",
  "DISTRICT_NAME",
  "ENROLLMENT_STATUS",
  "PROGRAM_MEMBERSHIP",
  "STAFF_ROLE",
  "GRADE_LEVEL",
  "RACE_ETHNICITY",
  "GENDER",
  "STUDENT_COUNT",
  "ENROLLMENT_COUNT",
  "ATTENDANCE_RATE",
  "COURSE_GRADE",
  "DISCIPLINE_INCIDENT_COUNT",
]);

function normalizeSignalList(value: unknown): PlannerPolicySignalKey[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is PlannerPolicySignalKey => Boolean(entry && SIGNAL_KEYS.has(entry as PlannerPolicySignalKey)));
}

function normalizeCapabilityList(value: unknown): PlannerPolicyCapabilityKey[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry)?.toUpperCase() ?? null)
    .filter(
      (entry): entry is PlannerPolicyCapabilityKey =>
        Boolean(entry && CAPABILITY_KEYS.has(entry as PlannerPolicyCapabilityKey)),
    );
}

function normalizePolicyRule(raw: unknown): PlannerRerankPolicyRule {
  const record = asRecord(raw) ?? {};
  return {
    version: 1,
    when_signals_all: normalizeSignalList(record.when_signals_all),
    when_signals_any: normalizeSignalList(record.when_signals_any),
    exclude_signals_any: normalizeSignalList(record.exclude_signals_any),
    prefer_capabilities: normalizeCapabilityList(record.prefer_capabilities),
    penalize_missing: normalizeCapabilityList(record.penalize_missing),
    require_for_bonus: normalizeCapabilityList(record.require_for_bonus),
    boost: asNumber(record.boost) ?? 0,
    penalty: asNumber(record.penalty) ?? 0,
    max_effect: asNumber(record.max_effect) ?? 0.5,
  };
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeCapabilityRow(raw: unknown): PlannerDomainCapabilityRow | null {
  const record = asRecord(raw);
  if (!record) return null;
  const scopeType = asString(record.scope_type)?.toLowerCase() as PlannerPolicyScopeType | undefined;
  const capabilityKey = asString(record.capability_key)?.toUpperCase() as PlannerPolicyCapabilityKey | undefined;
  const supportLevel = asString(record.support_level)?.toLowerCase() as PlannerPolicySupportLevel | undefined;
  const sourceType = asString(record.source_type)?.toLowerCase() as PlannerPolicySourceType | undefined;
  if (!scopeType || !SCOPE_TYPES.has(scopeType) || !capabilityKey || !CAPABILITY_KEYS.has(capabilityKey)) {
    return null;
  }
  return {
    id: asNumber(record.id) ?? asNumber(record.capability_id) ?? undefined,
    scope_type: scopeType,
    scope_workspace_id: asString(record.scope_workspace_id),
    scope_vertical_norm: asString(record.scope_vertical_norm),
    base_domain_id: asNumber(record.base_domain_id) ?? 0,
    capability_key: capabilityKey,
    support_level: supportLevel && SUPPORT_LEVELS.has(supportLevel) ? supportLevel : "direct",
    source_type: sourceType && SOURCE_TYPES.has(sourceType) ? sourceType : "semantic_concept",
    source_ref: asString(record.source_ref),
    confidence: asNumber(record.confidence) ?? 1,
    notes: asString(record.notes),
    is_active: asBoolean(record.is_active),
    is_inherited: asBoolean(record.is_inherited),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizePolicyRow(raw: unknown): PlannerRerankPolicyRow | null {
  const record = asRecord(raw);
  if (!record) return null;
  const scopeType = asString(record.scope_type)?.toLowerCase() as PlannerPolicyScopeType | undefined;
  if (!scopeType || !SCOPE_TYPES.has(scopeType)) return null;
  const policyKey = asString(record.policy_key);
  const name = asString(record.name) ?? (policyKey ? humanizeKey(policyKey) : null);
  if (!policyKey || !name) return null;
  return {
    id: asNumber(record.id) ?? asNumber(record.policy_id) ?? undefined,
    policy_key: policyKey,
    name,
    description: asString(record.description),
    scope_type: scopeType,
    scope_workspace_id: asString(record.scope_workspace_id),
    scope_vertical_norm: asString(record.scope_vertical_norm),
    scope_base_domain_id: asNumber(record.scope_base_domain_id),
    priority: asNumber(record.priority) ?? 100,
    is_active: asBoolean(record.is_active),
    stop_on_match: asBoolean(record.stop_on_match),
    policy_json: normalizePolicyRule(record.policy_json),
    scope_rank: asNumber(record.scope_rank) ?? undefined,
    is_inherited: asBoolean(record.is_inherited),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizeCandidateRow(raw: unknown): PlannerRerankPolicyCandidateRow | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asNumber(record.id) ?? asNumber(record.candidate_id);
  const candidateKey = asString(record.candidate_key);
  const sourceType = asString(record.source_type)?.toLowerCase() as PlannerPolicyCandidateSourceType | undefined;
  const reviewStatus =
    (asString(record.review_status)?.toLowerCase() as PlannerPolicyCandidateReviewStatus | undefined) ?? "pending";
  if (!id || !candidateKey || !sourceType || !CANDIDATE_SOURCE_TYPES.has(sourceType) || !reviewStatus || !REVIEW_STATUSES.has(reviewStatus)) {
    return null;
  }
  return {
    id,
    candidate_key: candidateKey,
    source_type: sourceType,
    workspace_id: asString(record.workspace_id),
    vertical_norm: asString(record.vertical_norm),
    candidate_json: normalizePolicyRule(record.candidate_json),
    rationale_json: asRecord(record.rationale_json),
    confidence: asNumber(record.confidence),
    review_status: reviewStatus,
    approved_policy_id: asNumber(record.approved_policy_id),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizeSuggestDomainSnapshot(raw: unknown): PlannerRerankPolicyCandidateSuggestDomainSnapshot | null {
  const record = asRecord(raw);
  if (!record) return null;
  const baseDomainId = asNumber(record.base_domain_id);
  const domainName = asString(record.domain_name);
  if (!baseDomainId || !domainName) return null;
  const presentCapabilities = Array.isArray(record.present_capabilities)
    ? record.present_capabilities
        .map((entry) => asString(entry)?.toUpperCase() ?? null)
        .filter(
          (entry): entry is PlannerPolicyCapabilityKey =>
            Boolean(entry && CAPABILITY_KEYS.has(entry as PlannerPolicyCapabilityKey)),
        )
    : [];
  const metricKeys = Array.isArray(record.metric_keys)
    ? record.metric_keys.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry))
    : [];
  const dimensionKeys = Array.isArray(record.dimension_keys)
    ? record.dimension_keys.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry))
    : [];
  return {
    base_domain_id: baseDomainId,
    domain_name: domainName,
    present_capabilities: presentCapabilities,
    metric_keys: metricKeys,
    dimension_keys: dimensionKeys,
  };
}

export async function getPlannerDomainCapabilities(
  baseDomainId: number,
  verticalNorm: string,
  includeInactive = false,
): Promise<PlannerDomainCapabilityListResponse> {
  try {
    const { data } = await api.get("/domains/planner-domain-capabilities", {
      ...workspaceRequestConfig(),
      params: {
        base_domain_id: baseDomainId,
        vertical_norm: verticalNorm.trim() || "generic",
        include_inactive: includeInactive,
      },
    });
    const record = asRecord(data) ?? {};
    const rows = Array.isArray(record.capabilities) ? record.capabilities : [];
    return {
      workspace_id: asString(record.workspace_id) ?? "",
      vertical_norm: asString(record.vertical_norm) ?? (verticalNorm.trim() || "generic"),
      base_domain_id: asNumber(record.base_domain_id) ?? baseDomainId,
      domain_name: asString(record.domain_name),
      can_edit: asBoolean(record.can_edit),
      capabilities: rows
        .map(normalizeCapabilityRow)
        .filter((row): row is PlannerDomainCapabilityRow => Boolean(row)),
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to load planner domain capabilities.");
  }
}

export async function upsertPlannerDomainCapability(
  payload: PlannerDomainCapabilityUpsertRequest,
): Promise<PlannerDomainCapabilityRow> {
  try {
    const { data } = await api.put(
      "/domains/planner-domain-capabilities",
      { capability: payload },
      workspaceRequestConfig(),
    );
    return normalizeCapabilityRow(data) ?? {
      id: undefined,
      scope_type: payload.scope_type,
      scope_workspace_id: payload.scope_workspace_id ?? null,
      scope_vertical_norm: payload.scope_vertical_norm ?? null,
      base_domain_id: payload.base_domain_id,
      capability_key: payload.capability_key,
      support_level: payload.support_level,
      source_type: payload.source_type,
      source_ref: payload.source_ref ?? null,
      confidence: payload.confidence ?? 1,
      notes: payload.notes ?? null,
      is_active: payload.is_active ?? true,
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to save planner domain capability.");
  }
}

export async function deletePlannerDomainCapability(capabilityId: number): Promise<void> {
  try {
    await api.delete(
      `/domains/planner-domain-capabilities/${capabilityId}`,
      workspaceRequestConfig(),
    );
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to delete planner domain capability.");
  }
}

export async function getPlannerRerankPolicies(
  baseDomainId: number | null,
  verticalNorm: string,
  includeInactive = false,
): Promise<PlannerRerankPolicyListResponse> {
  try {
    const params: Record<string, unknown> = {
      vertical_norm: verticalNorm.trim() || "generic",
      include_inactive: includeInactive,
    };
    if (baseDomainId) params.base_domain_id = baseDomainId;
    const { data } = await api.get("/domains/planner-rerank-policies", {
      ...workspaceRequestConfig(),
      params,
    });
    const record = asRecord(data) ?? {};
    const rows = Array.isArray(record.policies) ? record.policies : [];
    return {
      workspace_id: asString(record.workspace_id) ?? "",
      vertical_norm: asString(record.vertical_norm) ?? (verticalNorm.trim() || "generic"),
      base_domain_id: asNumber(record.base_domain_id),
      domain_name: asString(record.domain_name),
      can_edit: asBoolean(record.can_edit),
      policies: rows
        .map(normalizePolicyRow)
        .filter((row): row is PlannerRerankPolicyRow => Boolean(row)),
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to load planner rerank policies.");
  }
}

export async function upsertPlannerRerankPolicy(
  payload: PlannerRerankPolicyUpsertRequest,
): Promise<PlannerRerankPolicyRow> {
  try {
    const { data } = await api.put(
      "/domains/planner-rerank-policies",
      { policy: payload },
      workspaceRequestConfig(),
    );
    const normalized = normalizePolicyRow(data);
    if (!normalized) throw new Error("Invalid policy response");
    return normalized;
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to save planner rerank policy.");
  }
}

export async function deletePlannerRerankPolicy(policyId: number): Promise<void> {
  try {
    await api.delete(
      `/domains/planner-rerank-policies/${policyId}`,
      workspaceRequestConfig(),
    );
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to delete planner rerank policy.");
  }
}

export async function getPlannerRerankPolicyCandidates(
  reviewStatus: PlannerPolicyCandidateReviewStatus | "",
  verticalNorm: string,
): Promise<PlannerRerankPolicyCandidateListResponse> {
  try {
    const params: Record<string, unknown> = {};
    if (reviewStatus) params.review_status = reviewStatus;
    if (verticalNorm.trim()) params.vertical_norm = verticalNorm.trim();
    const { data } = await api.get("/domains/planner-rerank-policy-candidates", {
      ...workspaceRequestConfig(),
      params,
    });
    const record = asRecord(data) ?? {};
    const rows = Array.isArray(record.candidates) ? record.candidates : [];
    return {
      workspace_id: asString(record.workspace_id) ?? "",
      review_status:
        (asString(record.review_status)?.toLowerCase() as PlannerPolicyCandidateReviewStatus | undefined) &&
        REVIEW_STATUSES.has(asString(record.review_status)?.toLowerCase() as PlannerPolicyCandidateReviewStatus)
          ? (asString(record.review_status)?.toLowerCase() as PlannerPolicyCandidateReviewStatus)
          : null,
      vertical_norm: asString(record.vertical_norm),
      candidates: rows
        .map(normalizeCandidateRow)
        .filter((row): row is PlannerRerankPolicyCandidateRow => Boolean(row)),
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to load planner rerank policy candidates.");
  }
}

export async function createPlannerRerankPolicyCandidate(
  payload: PlannerRerankPolicyCandidateCreateRequest,
): Promise<PlannerRerankPolicyCandidateRow> {
  try {
    const method = payload.id ? api.put : api.post;
    const { data } = await method(
      "/domains/planner-rerank-policy-candidates",
      { candidate: payload },
      workspaceRequestConfig(),
    );
    const normalized = normalizeCandidateRow(data);
    if (!normalized) throw new Error("Invalid candidate response");
    return normalized;
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to create planner rerank policy candidate.");
  }
}

export async function deletePlannerRerankPolicyCandidate(candidateId: number): Promise<void> {
  try {
    await api.delete(
      `/domains/planner-rerank-policy-candidates/${candidateId}`,
      workspaceRequestConfig(),
    );
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to delete planner rerank policy candidate.");
  }
}

export async function approvePlannerRerankPolicyCandidate(
  candidateId: number,
  payload: PlannerRerankPolicyCandidateApproveRequest,
): Promise<PlannerRerankPolicyCandidateApproveResponse> {
  try {
    const { data } = await api.post(
      `/domains/planner-rerank-policy-candidates/${candidateId}/approve`,
      { approval: payload },
      workspaceRequestConfig(),
    );
    const record = asRecord(data) ?? {};
    const policy = normalizePolicyRow(record.policy);
    if (!policy) throw new Error("Invalid candidate approval response");
    return {
      candidate_id: asNumber(record.candidate_id) ?? candidateId,
      review_status: "approved",
      approved_policy_id: asNumber(record.approved_policy_id) ?? policy.id ?? 0,
      policy,
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to approve planner rerank policy candidate.");
  }
}

export async function suggestPlannerRerankPolicyCandidate(
  payload: PlannerRerankPolicyCandidateSuggestRequest,
): Promise<PlannerRerankPolicyCandidateSuggestResponse> {
  try {
    const { data } = await api.post(
      "/domains/planner-rerank-policy-candidates/suggest",
      { suggestion: payload },
      workspaceRequestConfig(),
    );
    const record = asRecord(data) ?? {};
    const candidate = normalizeCandidateRow(record.candidate);
    if (!candidate) throw new Error("Invalid AI candidate response");
    return {
      candidate,
      prompt_signals: normalizeSignalList(record.prompt_signals),
      expected_domain: normalizeSuggestDomainSnapshot(record.expected_domain),
      observed_domain: normalizeSuggestDomainSnapshot(record.observed_domain),
      llm_resolution: asRecord(record.llm_resolution),
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to suggest planner rerank policy candidate.");
  }
}
