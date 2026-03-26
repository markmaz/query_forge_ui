export type PlannerPolicyScopeType =
  | "global"
  | "vertical"
  | "workspace"
  | "global_domain"
  | "vertical_domain"
  | "workspace_domain";

export type PlannerPolicyCapabilityKey =
  | "STUDENT_IDENTITY"
  | "BIRTH_DATE"
  | "AGE"
  | "STAFF_IDENTITY"
  | "SCHOOL_IDENTITY"
  | "SCHOOL_NAME"
  | "CALENDAR_DATE"
  | "SCHOOL_DAY_FLAG"
  | "NON_INSTRUCTIONAL_DAY"
  | "DISTRICT_NAME"
  | "ENROLLMENT_STATUS"
  | "PROGRAM_MEMBERSHIP"
  | "STAFF_ROLE"
  | "GRADE_LEVEL"
  | "RACE_ETHNICITY"
  | "GENDER"
  | "STUDENT_COUNT"
  | "ENROLLMENT_COUNT"
  | "ATTENDANCE_RATE"
  | "COURSE_GRADE"
  | "DISCIPLINE_INCIDENT_COUNT";

export type PlannerPolicySupportLevel = "direct" | "derived" | "partial";

export type PlannerPolicySourceType =
  | "semantic_concept"
  | "metric"
  | "dimension"
  | "filter"
  | "derived_condition"
  | "heuristic_inference";

export type PlannerPolicySignalKey =
  | "student_listing"
  | "student_aggregate"
  | "staff_listing"
  | "staff_aggregate"
  | "school_aggregate"
  | "age_extreme_prompt"
  | "birth_month_prompt"
  | "calendar_days_off_prompt"
  | "school_literal_present"
  | "district_literal_present"
  | "time_constraint_present"
  | "status_enrolled"
  | "status_active"
  | "subgroup_prompt"
  | "program_prompt"
  | "staff_role_prompt"
  | "needs_student_identity"
  | "needs_school_filter"
  | "needs_enrollment_status"
  | "needs_attendance_metric"
  | "needs_grade_metric"
  | "needs_program_membership"
  | "listing_intent"
  | "aggregate_intent"
  | "grouped_aggregate";

export type PlannerPolicyCandidateSourceType =
  | "ai_recommendation"
  | "manual"
  | "trace_review";

export type PlannerPolicyCandidateReviewStatus = "pending" | "approved" | "rejected";

export interface PlannerRerankPolicyRule {
  version: 1;
  when_signals_all: PlannerPolicySignalKey[];
  when_signals_any: PlannerPolicySignalKey[];
  exclude_signals_any: PlannerPolicySignalKey[];
  prefer_capabilities: PlannerPolicyCapabilityKey[];
  penalize_missing: PlannerPolicyCapabilityKey[];
  require_for_bonus: PlannerPolicyCapabilityKey[];
  boost: number;
  penalty: number;
  max_effect: number;
}

export interface PlannerDomainCapabilityRow {
  id?: number;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id: string | null;
  scope_vertical_norm: string | null;
  base_domain_id: number;
  capability_key: PlannerPolicyCapabilityKey;
  support_level: PlannerPolicySupportLevel;
  source_type: PlannerPolicySourceType;
  source_ref: string | null;
  confidence: number;
  notes: string | null;
  is_active: boolean;
  is_inherited?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlannerDomainCapabilityListResponse {
  workspace_id: string;
  vertical_norm: string;
  base_domain_id: number;
  domain_name: string | null;
  can_edit: boolean;
  capabilities: PlannerDomainCapabilityRow[];
}

export interface PlannerDomainCapabilityUpsertRequest {
  id?: number;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id?: string | null;
  scope_vertical_norm?: string | null;
  base_domain_id: number;
  capability_key: PlannerPolicyCapabilityKey;
  support_level: PlannerPolicySupportLevel;
  source_type: PlannerPolicySourceType;
  source_ref?: string | null;
  confidence?: number;
  notes?: string | null;
  is_active?: boolean;
}

export interface PlannerRerankPolicyRow {
  id?: number;
  policy_key: string;
  name: string;
  description: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id: string | null;
  scope_vertical_norm: string | null;
  scope_base_domain_id: number | null;
  priority: number;
  is_active: boolean;
  stop_on_match: boolean;
  policy_json: PlannerRerankPolicyRule;
  scope_rank?: number;
  is_inherited?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlannerRerankPolicyListResponse {
  workspace_id: string;
  vertical_norm: string;
  base_domain_id: number | null;
  domain_name: string | null;
  can_edit: boolean;
  policies: PlannerRerankPolicyRow[];
}

export interface PlannerRerankPolicyUpsertRequest {
  id?: number;
  policy_key: string;
  name: string;
  description?: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id?: string | null;
  scope_vertical_norm?: string | null;
  scope_base_domain_id?: number | null;
  priority?: number;
  is_active?: boolean;
  stop_on_match?: boolean;
  policy_json: PlannerRerankPolicyRule;
}

export interface PlannerRerankPolicyCandidateRow {
  id: number;
  candidate_key: string;
  source_type: PlannerPolicyCandidateSourceType;
  workspace_id: string | null;
  vertical_norm: string | null;
  candidate_json: PlannerRerankPolicyRule;
  rationale_json: Record<string, unknown> | null;
  confidence: number | null;
  review_status: PlannerPolicyCandidateReviewStatus;
  approved_policy_id: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlannerRerankPolicyCandidateListResponse {
  workspace_id: string;
  review_status: PlannerPolicyCandidateReviewStatus | null;
  vertical_norm: string | null;
  candidates: PlannerRerankPolicyCandidateRow[];
}

export interface PlannerRerankPolicyCandidateCreateRequest {
  id?: number;
  candidate_key: string;
  source_type?: PlannerPolicyCandidateSourceType;
  workspace_id?: string | null;
  vertical_norm?: string | null;
  candidate_policy: PlannerRerankPolicyRule;
  rationale_json?: Record<string, unknown> | null;
  confidence?: number | null;
}

export interface PlannerRerankPolicyCandidateApproveRequest {
  name: string;
  description?: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id?: string | null;
  scope_vertical_norm?: string | null;
  scope_base_domain_id?: number | null;
  priority?: number;
  is_active?: boolean;
  stop_on_match?: boolean;
  policy_key?: string | null;
}

export interface PlannerRerankPolicyCandidateApproveResponse {
  candidate_id: number;
  review_status: PlannerPolicyCandidateReviewStatus;
  approved_policy_id: number;
  policy: PlannerRerankPolicyRow;
}

export interface PlannerRerankPolicyCandidateSuggestRequest {
  prompt: string;
  vertical_norm?: string | null;
  expected_base_domain_id: number;
  observed_base_domain_id?: number | null;
  candidate_key?: string | null;
  notes?: string | null;
  llm_id?: number | null;
}

export interface PlannerRerankPolicyCandidateSuggestDomainSnapshot {
  base_domain_id: number;
  domain_name: string;
  present_capabilities: PlannerPolicyCapabilityKey[];
  metric_keys: string[];
  dimension_keys: string[];
}

export interface PlannerRerankPolicyCandidateSuggestResponse {
  candidate: PlannerRerankPolicyCandidateRow;
  prompt_signals: PlannerPolicySignalKey[];
  expected_domain: PlannerRerankPolicyCandidateSuggestDomainSnapshot | null;
  observed_domain: PlannerRerankPolicyCandidateSuggestDomainSnapshot | null;
  llm_resolution?: Record<string, unknown> | null;
}
