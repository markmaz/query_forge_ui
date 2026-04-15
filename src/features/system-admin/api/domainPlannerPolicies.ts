import axios from "axios";

import api, { getApiWorkspaceId } from "@/shared/services/api";
import type {
  PlannerDomainSelectionFeatureKey,
  PlannerDomainSelectionPolicyListResponse,
  PlannerDomainSelectionPolicyRow,
  PlannerDomainSelectionPolicyRule,
  PlannerDomainSelectionPolicyUpsertRequest,
  PlannerDomainCapabilityListResponse,
  PlannerDomainCapabilityRow,
  PlannerDomainCapabilityUpsertRequest,
  PlannerPolicyCandidateReviewStatus,
  PlannerPolicyCapabilityKey,
  PlannerPolicyCandidateSourceType,
  PlannerPromptIntentActionKey,
  PlannerPromptIntentPolicyListResponse,
  PlannerPromptIntentPolicyRow,
  PlannerPromptIntentPolicyRule,
  PlannerPromptIntentPolicyUpsertRequest,
  PlannerProjectionPolicyListResponse,
  PlannerProjectionPolicyRow,
  PlannerProjectionPolicyRule,
  PlannerProjectionPolicyUpsertRequest,
  PlannerRetrievalPolicyListResponse,
  PlannerRetrievalPolicyRow,
  PlannerRetrievalPolicyRule,
  PlannerRetrievalPolicyUpsertRequest,
  PlannerRetrievalQuerySource,
  PlannerSignalHelperName,
  PlannerSignalMatchType,
  PlannerSignalPolicyListResponse,
  PlannerSignalPolicyRow,
  PlannerSignalPolicyRule,
  PlannerSignalPolicyUpsertRequest,
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
  "workspace",
  "global_domain",
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
const SIGNAL_MATCH_TYPES = new Set<PlannerSignalMatchType>([
  "regex",
  "regex_all",
  "substring_any",
  "helper",
  "school_literal",
]);
const SIGNAL_HELPER_NAMES = new Set<PlannerSignalHelperName>([
  "prompt_implies_staff_work_context",
  "prompt_implies_student_school_context",
  "prompt_has_adm_intent",
  "prompt_mentions_school_or_district",
  "prompt_has_city_state_pattern",
  "prompt_has_nativity",
  "prompt_has_name_constraint",
  "prompt_prefers_canonical_name_columns",
  "prompt_explicitly_requests_preferred_name",
]);
const PROMPT_INTENT_ACTION_KEYS = new Set<PlannerPromptIntentActionKey>([
  "list_students",
  "aggregate_students",
  "list_schools",
  "aggregate_schools",
  "mention_students",
  "mention_schools",
  "district_terms",
  "subgroup_terms",
  "nativity_terms",
  "calendar_days_off_terms",
  "age_extreme_terms",
  "birth_month_terms",
  "name_constraint_terms",
  "explicit_preferred_name_terms",
  "staff_work_hint",
  "student_attend_hint",
  "adm_hint",
  "city_state_abbr",
  "month_names",
  "time_phrases",
]);
const REVIEW_STATUSES = new Set<PlannerPolicyCandidateReviewStatus>([
  "pending",
  "approved",
  "rejected",
]);

const SIGNAL_KEYS = new Set<PlannerPolicySignalKey>([
  "student_listing",
  "school_listing",
  "student_aggregate",
  "staff_listing",
  "staff_aggregate",
  "school_aggregate",
  "staff_work_context_prompt",
  "student_school_context_prompt",
  "adm_prompt",
  "age_extreme_prompt",
  "birth_month_prompt",
  "calendar_days_off_prompt",
  "school_literal_present",
  "school_or_district_prompt",
  "city_state_prompt",
  "nativity_prompt",
  "name_constraint_prompt",
  "canonical_name_preference_prompt",
  "explicit_preferred_name_request",
  "explicit_school_key_request",
  "explicit_staff_classification_request",
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

const RETRIEVAL_QUERY_SOURCES = new Set<PlannerRetrievalQuerySource>(["vector", "semantic_vector"]);
const DOMAIN_SELECTION_FEATURE_KEYS = new Set<PlannerDomainSelectionFeatureKey>([
  "SUBGROUP_COLUMN",
  "STUDENT_IDENTITY_COLUMN",
  "STAFF_IDENTITY_COLUMN",
  "ADM_SIGNAL_COLUMN",
  "ADM_METRIC",
  "BIRTH_DATE_COLUMN",
  "AGE_COLUMN",
  "CALENDAR_DAY_COLUMN",
  "SCHOOL_DAY_FLAG_COLUMN",
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

function normalizeStringList(value: unknown, options?: { lower?: boolean; upper?: boolean }): string[] {
  const lower = options?.lower ?? false;
  const upper = options?.upper ?? false;
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry))
        .map((entry) => {
          if (upper) return entry.toUpperCase();
          if (lower) return entry.toLowerCase();
          return entry;
        }),
    ),
  );
}

function normalizeProjectionRule(raw: unknown): PlannerProjectionPolicyRule {
  const record = asRecord(raw) ?? {};
  const projectionMode = asString(record.projection_mode)?.toLowerCase();
  return {
    version: 1,
    when_signals_all: normalizeSignalList(record.when_signals_all),
    when_signals_any: normalizeSignalList(record.when_signals_any),
    exclude_signals_any: normalizeSignalList(record.exclude_signals_any),
    projection_mode: projectionMode === "append" ? "append" : "prepend",
    required_concept_keys: normalizeStringList(record.required_concept_keys, { upper: true }),
    excluded_concept_keys: normalizeStringList(record.excluded_concept_keys, { upper: true }),
    required_column_names: normalizeStringList(record.required_column_names, { lower: true }),
    excluded_column_names: normalizeStringList(record.excluded_column_names, { lower: true }),
    required_filter_concept_keys: normalizeStringList(record.required_filter_concept_keys, { upper: true }),
    required_join_tables: normalizeStringList(record.required_join_tables, { lower: true }),
  };
}

function normalizeSignalRule(raw: unknown): PlannerSignalPolicyRule {
  const record = asRecord(raw) ?? {};
  const matchType = asString(record.match_type)?.toLowerCase() as PlannerSignalMatchType | undefined;
  const helperName = asString(record.helper_name) as PlannerSignalHelperName | null;
  return {
    version: 1,
    signal_keys: normalizeSignalList(record.signal_keys),
    match_type: matchType && SIGNAL_MATCH_TYPES.has(matchType) ? matchType : "regex",
    patterns: normalizeStringList(record.patterns),
    helper_name: helperName && SIGNAL_HELPER_NAMES.has(helperName) ? helperName : null,
    suffixes: normalizeStringList(record.suffixes, { lower: true }),
    stopwords: normalizeStringList(record.stopwords, { lower: true }),
    case_sensitive: asBoolean(record.case_sensitive),
  };
}

function normalizePromptIntentRule(raw: unknown): PlannerPromptIntentPolicyRule {
  const record = asRecord(raw) ?? {};
  const actionKey = asString(record.action_key)?.toLowerCase() as PlannerPromptIntentActionKey | undefined;
  return {
    version: 1,
    action_key: actionKey && PROMPT_INTENT_ACTION_KEYS.has(actionKey) ? actionKey : "list_students",
    regex_patterns: normalizeStringList(record.regex_patterns),
    substring_patterns: normalizeStringList(record.substring_patterns),
    state_codes: normalizeStringList(record.state_codes, { lower: true }),
  };
}

function normalizeRetrievalRule(raw: unknown): PlannerRetrievalPolicyRule {
  const record = asRecord(raw) ?? {};
  const rawSpecs = Array.isArray(record.query_specs) ? record.query_specs : [];
  const querySpecs = rawSpecs
    .map((entry) => {
      const spec = asRecord(entry);
      if (!spec) return null;
      const query = asString(spec.query);
      const source = asString(spec.source)?.toLowerCase() as PlannerRetrievalQuerySource | undefined;
      if (!query) return null;
      return {
        query,
        score_boost: asNumber(spec.score_boost) ?? 0,
        reasons: normalizeStringList(spec.reasons),
        source: source && RETRIEVAL_QUERY_SOURCES.has(source) ? source : "vector",
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  return {
    version: 1,
    when_signals_all: normalizeSignalList(record.when_signals_all),
    when_signals_any: normalizeSignalList(record.when_signals_any),
    exclude_signals_any: normalizeSignalList(record.exclude_signals_any),
    when_concept_key_patterns_any: normalizeStringList(record.when_concept_key_patterns_any, { upper: true }),
    query_specs: querySpecs,
    domain_name_prefer_tokens: normalizeStringList(record.domain_name_prefer_tokens, { lower: true }),
    domain_name_avoid_tokens: normalizeStringList(record.domain_name_avoid_tokens, { lower: true }),
    domain_name_positive_bias: asNumber(record.domain_name_positive_bias) ?? 0,
    domain_name_negative_bias: asNumber(record.domain_name_negative_bias) ?? 0,
  };
}

function normalizeDomainSelectionRule(raw: unknown): PlannerDomainSelectionPolicyRule {
  const record = asRecord(raw) ?? {};
  const normalizeFeatureList = (value: unknown) =>
    normalizeStringList(value, { upper: true }).filter(
      (entry): entry is PlannerDomainSelectionFeatureKey =>
        DOMAIN_SELECTION_FEATURE_KEYS.has(entry as PlannerDomainSelectionFeatureKey),
    );
  return {
    version: 1,
    when_signals_all: normalizeSignalList(record.when_signals_all),
    when_signals_any: normalizeSignalList(record.when_signals_any),
    exclude_signals_any: normalizeSignalList(record.exclude_signals_any),
    required_shortlist_features: normalizeFeatureList(record.required_shortlist_features),
    required_capability_features: normalizeFeatureList(record.required_capability_features),
    score_delta: asNumber(record.score_delta) ?? 0,
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

function normalizeProjectionPolicyRow(raw: unknown): PlannerProjectionPolicyRow | null {
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
    scope_base_domain_id: asNumber(record.scope_base_domain_id),
    priority: asNumber(record.priority) ?? 100,
    is_active: asBoolean(record.is_active),
    stop_on_match: asBoolean(record.stop_on_match),
    policy_json: normalizeProjectionRule(record.policy_json),
    scope_rank: asNumber(record.scope_rank) ?? undefined,
    is_seeded: asBoolean(record.is_seeded),
    is_effective: asBoolean(record.is_effective),
    can_edit: asBoolean(record.can_edit),
    can_delete: asBoolean(record.can_delete),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizeSignalPolicyRow(raw: unknown): PlannerSignalPolicyRow | null {
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
    priority: asNumber(record.priority) ?? 100,
    is_active: asBoolean(record.is_active),
    stop_on_match: asBoolean(record.stop_on_match),
    policy_json: normalizeSignalRule(record.policy_json),
    scope_rank: asNumber(record.scope_rank) ?? undefined,
    is_seeded: asBoolean(record.is_seeded),
    is_effective: asBoolean(record.is_effective),
    can_edit: asBoolean(record.can_edit),
    can_delete: asBoolean(record.can_delete),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizePromptIntentPolicyRow(raw: unknown): PlannerPromptIntentPolicyRow | null {
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
    priority: asNumber(record.priority) ?? 100,
    is_active: asBoolean(record.is_active),
    stop_on_match: asBoolean(record.stop_on_match),
    policy_json: normalizePromptIntentRule(record.policy_json),
    scope_rank: asNumber(record.scope_rank) ?? undefined,
    is_seeded: asBoolean(record.is_seeded),
    is_effective: asBoolean(record.is_effective),
    can_edit: asBoolean(record.can_edit),
    can_delete: asBoolean(record.can_delete),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizeRetrievalPolicyRow(raw: unknown): PlannerRetrievalPolicyRow | null {
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
    priority: asNumber(record.priority) ?? 100,
    is_active: asBoolean(record.is_active),
    stop_on_match: asBoolean(record.stop_on_match),
    policy_json: normalizeRetrievalRule(record.policy_json),
    scope_rank: asNumber(record.scope_rank) ?? undefined,
    is_seeded: asBoolean(record.is_seeded),
    is_effective: asBoolean(record.is_effective),
    can_edit: asBoolean(record.can_edit),
    can_delete: asBoolean(record.can_delete),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
  };
}

function normalizeDomainSelectionPolicyRow(raw: unknown): PlannerDomainSelectionPolicyRow | null {
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
    priority: asNumber(record.priority) ?? 100,
    is_active: asBoolean(record.is_active),
    stop_on_match: asBoolean(record.stop_on_match),
    policy_json: normalizeDomainSelectionRule(record.policy_json),
    scope_rank: asNumber(record.scope_rank) ?? undefined,
    is_seeded: asBoolean(record.is_seeded),
    is_effective: asBoolean(record.is_effective),
    can_edit: asBoolean(record.can_edit),
    can_delete: asBoolean(record.can_delete),
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
  includeInactive = false,
): Promise<PlannerDomainCapabilityListResponse> {
  try {
    const { data } = await api.get("/domains/planner-domain-capabilities", {
      ...workspaceRequestConfig(),
      params: {
        base_domain_id: baseDomainId,
        include_inactive: includeInactive,
      },
    });
    const record = asRecord(data) ?? {};
    const rows = Array.isArray(record.capabilities) ? record.capabilities : [];
    return {
      workspace_id: asString(record.workspace_id) ?? "",
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
  includeInactive = false,
): Promise<PlannerRerankPolicyListResponse> {
  try {
    const params: Record<string, unknown> = {
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

export async function getPlannerProjectionPolicies(
  baseDomainId: number | null,
  includeInactive = false,
  includeSeeded = true,
): Promise<PlannerProjectionPolicyListResponse> {
  try {
    const params: Record<string, unknown> = {
      include_inactive: includeInactive,
      include_seeded: includeSeeded,
    };
    if (baseDomainId) params.base_domain_id = baseDomainId;
    const { data } = await api.get("/admin/planner-projection-policies", {
      ...workspaceRequestConfig(),
      params,
    });
    const record = asRecord(data) ?? {};
    const rows = Array.isArray(record.policies) ? record.policies : [];
    return {
      workspace_id: asString(record.workspace_id) ?? "",
      base_domain_id: asNumber(record.base_domain_id),
      can_edit: asBoolean(record.can_edit),
      policies: rows
        .map(normalizeProjectionPolicyRow)
        .filter((row): row is PlannerProjectionPolicyRow => Boolean(row)),
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to load planner projection policies.");
  }
}

export async function getPlannerSignalPolicies(
  includeInactive = false,
  includeSeeded = true,
): Promise<PlannerSignalPolicyListResponse> {
  try {
    const { data } = await api.get("/admin/planner-signal-policies", {
      ...workspaceRequestConfig(),
      params: {
        include_inactive: includeInactive,
        include_seeded: includeSeeded,
      },
    });
    const record = asRecord(data) ?? {};
    const rows = Array.isArray(record.policies) ? record.policies : [];
    return {
      workspace_id: asString(record.workspace_id) ?? "",
      can_edit: asBoolean(record.can_edit),
      policies: rows
        .map(normalizeSignalPolicyRow)
        .filter((row): row is PlannerSignalPolicyRow => Boolean(row)),
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to load planner signal policies.");
  }
}

export async function upsertPlannerSignalPolicy(
  payload: PlannerSignalPolicyUpsertRequest,
): Promise<PlannerSignalPolicyRow> {
  try {
    const { data } = await api.put(
      "/admin/planner-signal-policies",
      payload,
      workspaceRequestConfig(),
    );
    const normalized = normalizeSignalPolicyRow(data);
    if (!normalized) throw new Error("Invalid signal policy response");
    return normalized;
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to save planner signal policy.");
  }
}

export async function deletePlannerSignalPolicy(policyId: number): Promise<void> {
  try {
    await api.delete(`/admin/planner-signal-policies/${policyId}`, workspaceRequestConfig());
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to delete planner signal policy.");
  }
}

export async function getPlannerPromptIntentPolicies(
  includeInactive = false,
  includeSeeded = true,
): Promise<PlannerPromptIntentPolicyListResponse> {
  try {
    const { data } = await api.get("/admin/planner-prompt-intent-policies", {
      ...workspaceRequestConfig(),
      params: {
        include_inactive: includeInactive,
        include_seeded: includeSeeded,
      },
    });
    const record = asRecord(data) ?? {};
    const rows = Array.isArray(record.policies) ? record.policies : [];
    return {
      workspace_id: asString(record.workspace_id) ?? "",
      can_edit: asBoolean(record.can_edit),
      policies: rows
        .map(normalizePromptIntentPolicyRow)
        .filter((row): row is PlannerPromptIntentPolicyRow => Boolean(row)),
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to load planner prompt intent policies.");
  }
}

export async function upsertPlannerPromptIntentPolicy(
  payload: PlannerPromptIntentPolicyUpsertRequest,
): Promise<PlannerPromptIntentPolicyRow> {
  try {
    const { data } = await api.put(
      "/admin/planner-prompt-intent-policies",
      payload,
      workspaceRequestConfig(),
    );
    const normalized = normalizePromptIntentPolicyRow(data);
    if (!normalized) throw new Error("Invalid prompt intent policy response");
    return normalized;
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to save planner prompt intent policy.");
  }
}

export async function deletePlannerPromptIntentPolicy(policyId: number): Promise<void> {
  try {
    await api.delete(`/admin/planner-prompt-intent-policies/${policyId}`, workspaceRequestConfig());
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to delete planner prompt intent policy.");
  }
}

export async function getPlannerRetrievalPolicies(
  includeInactive = false,
  includeSeeded = true,
): Promise<PlannerRetrievalPolicyListResponse> {
  try {
    const { data } = await api.get("/admin/planner-retrieval-policies", {
      ...workspaceRequestConfig(),
      params: {
        include_inactive: includeInactive,
        include_seeded: includeSeeded,
      },
    });
    const record = asRecord(data) ?? {};
    const rows = Array.isArray(record.policies) ? record.policies : [];
    return {
      workspace_id: asString(record.workspace_id) ?? "",
      can_edit: asBoolean(record.can_edit),
      policies: rows
        .map(normalizeRetrievalPolicyRow)
        .filter((row): row is PlannerRetrievalPolicyRow => Boolean(row)),
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to load planner retrieval policies.");
  }
}

export async function upsertPlannerRetrievalPolicy(
  payload: PlannerRetrievalPolicyUpsertRequest,
): Promise<PlannerRetrievalPolicyRow> {
  try {
    const { data } = await api.put(
      "/admin/planner-retrieval-policies",
      payload,
      workspaceRequestConfig(),
    );
    const normalized = normalizeRetrievalPolicyRow(data);
    if (!normalized) throw new Error("Invalid retrieval policy response");
    return normalized;
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to save planner retrieval policy.");
  }
}

export async function deletePlannerRetrievalPolicy(policyId: number): Promise<void> {
  try {
    await api.delete(`/admin/planner-retrieval-policies/${policyId}`, workspaceRequestConfig());
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to delete planner retrieval policy.");
  }
}

export async function getPlannerDomainSelectionPolicies(
  includeInactive = false,
  includeSeeded = true,
): Promise<PlannerDomainSelectionPolicyListResponse> {
  try {
    const { data } = await api.get("/admin/planner-domain-selection-policies", {
      ...workspaceRequestConfig(),
      params: {
        include_inactive: includeInactive,
        include_seeded: includeSeeded,
      },
    });
    const record = asRecord(data) ?? {};
    const rows = Array.isArray(record.policies) ? record.policies : [];
    return {
      workspace_id: asString(record.workspace_id) ?? "",
      can_edit: asBoolean(record.can_edit),
      policies: rows
        .map(normalizeDomainSelectionPolicyRow)
        .filter((row): row is PlannerDomainSelectionPolicyRow => Boolean(row)),
    };
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to load planner domain selection policies.");
  }
}

export async function upsertPlannerDomainSelectionPolicy(
  payload: PlannerDomainSelectionPolicyUpsertRequest,
): Promise<PlannerDomainSelectionPolicyRow> {
  try {
    const { data } = await api.put(
      "/admin/planner-domain-selection-policies",
      payload,
      workspaceRequestConfig(),
    );
    const normalized = normalizeDomainSelectionPolicyRow(data);
    if (!normalized) throw new Error("Invalid domain selection policy response");
    return normalized;
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to save planner domain selection policy.");
  }
}

export async function deletePlannerDomainSelectionPolicy(policyId: number): Promise<void> {
  try {
    await api.delete(`/admin/planner-domain-selection-policies/${policyId}`, workspaceRequestConfig());
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to delete planner domain selection policy.");
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

export async function upsertPlannerProjectionPolicy(
  payload: PlannerProjectionPolicyUpsertRequest,
): Promise<PlannerProjectionPolicyRow> {
  try {
    const { data } = await api.put(
      "/admin/planner-projection-policies",
      payload,
      workspaceRequestConfig(),
    );
    const normalized = normalizeProjectionPolicyRow(data);
    if (!normalized) throw new Error("Invalid projection policy response");
    return normalized;
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to save planner projection policy.");
  }
}

export async function deletePlannerProjectionPolicy(policyId: number): Promise<void> {
  try {
    await api.delete(
      `/admin/planner-projection-policies/${policyId}`,
      workspaceRequestConfig(),
    );
  } catch (error) {
    throw parsePlannerPolicyApiError(error, "Unable to delete planner projection policy.");
  }
}

export async function getPlannerRerankPolicyCandidates(
  reviewStatus: PlannerPolicyCandidateReviewStatus | "",
): Promise<PlannerRerankPolicyCandidateListResponse> {
  try {
    const params: Record<string, unknown> = {};
    if (reviewStatus) params.review_status = reviewStatus;
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
