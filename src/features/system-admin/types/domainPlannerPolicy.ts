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
  | "school_listing"
  | "student_aggregate"
  | "staff_listing"
  | "staff_aggregate"
  | "school_aggregate"
  | "staff_work_context_prompt"
  | "student_school_context_prompt"
  | "adm_prompt"
  | "age_extreme_prompt"
  | "birth_month_prompt"
  | "calendar_days_off_prompt"
  | "school_literal_present"
  | "school_or_district_prompt"
  | "city_state_prompt"
  | "nativity_prompt"
  | "name_constraint_prompt"
  | "canonical_name_preference_prompt"
  | "explicit_preferred_name_request"
  | "explicit_school_key_request"
  | "explicit_staff_classification_request"
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
export type PlannerSignalMatchType = "regex" | "regex_all" | "substring_any" | "helper" | "school_literal";
export type PlannerSignalHelperName =
  | "prompt_implies_staff_work_context"
  | "prompt_implies_student_school_context"
  | "prompt_has_adm_intent"
  | "prompt_mentions_school_or_district"
  | "prompt_has_city_state_pattern"
  | "prompt_has_nativity"
  | "prompt_has_name_constraint"
  | "prompt_prefers_canonical_name_columns"
  | "prompt_explicitly_requests_preferred_name";
export type PlannerPromptIntentActionKey =
  | "list_students"
  | "aggregate_students"
  | "list_schools"
  | "aggregate_schools"
  | "mention_students"
  | "mention_schools"
  | "district_terms"
  | "subgroup_terms"
  | "nativity_terms"
  | "calendar_days_off_terms"
  | "age_extreme_terms"
  | "birth_month_terms"
  | "name_constraint_terms"
  | "explicit_preferred_name_terms"
  | "staff_work_hint"
  | "student_attend_hint"
  | "adm_hint"
  | "city_state_abbr"
  | "month_names"
  | "time_phrases";

export type PlannerRetrievalQuerySource = "vector" | "semantic_vector";
export type PlannerDomainSelectionFeatureKey =
  | "SUBGROUP_COLUMN"
  | "STUDENT_IDENTITY_COLUMN"
  | "STAFF_IDENTITY_COLUMN"
  | "ADM_SIGNAL_COLUMN"
  | "ADM_METRIC"
  | "BIRTH_DATE_COLUMN"
  | "AGE_COLUMN"
  | "CALENDAR_DAY_COLUMN"
  | "SCHOOL_DAY_FLAG_COLUMN";

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

export type PlannerProjectionMode = "prepend" | "append";

export interface PlannerProjectionPolicyRule {
  version: 1;
  when_signals_all: PlannerPolicySignalKey[];
  when_signals_any: PlannerPolicySignalKey[];
  exclude_signals_any: PlannerPolicySignalKey[];
  projection_mode: PlannerProjectionMode;
  required_concept_keys: string[];
  excluded_concept_keys: string[];
  required_column_names: string[];
  excluded_column_names: string[];
  required_filter_concept_keys: string[];
  required_join_tables: string[];
}

export interface PlannerSignalPolicyRule {
  version: 1;
  signal_keys: PlannerPolicySignalKey[];
  match_type: PlannerSignalMatchType;
  patterns: string[];
  helper_name?: PlannerSignalHelperName | null;
  suffixes: string[];
  stopwords: string[];
  case_sensitive: boolean;
}

export interface PlannerPromptIntentPolicyRule {
  version: 1;
  action_key: PlannerPromptIntentActionKey;
  regex_patterns: string[];
  substring_patterns: string[];
  state_codes: string[];
}

export interface PlannerRetrievalQuerySpec {
  query: string;
  score_boost: number;
  reasons: string[];
  source: PlannerRetrievalQuerySource;
}

export interface PlannerRetrievalPolicyRule {
  version: 1;
  when_signals_all: PlannerPolicySignalKey[];
  when_signals_any: PlannerPolicySignalKey[];
  exclude_signals_any: PlannerPolicySignalKey[];
  when_concept_key_patterns_any: string[];
  query_specs: PlannerRetrievalQuerySpec[];
  domain_name_prefer_tokens: string[];
  domain_name_avoid_tokens: string[];
  domain_name_positive_bias: number;
  domain_name_negative_bias: number;
}

export interface PlannerDomainSelectionPolicyRule {
  version: 1;
  when_signals_all: PlannerPolicySignalKey[];
  when_signals_any: PlannerPolicySignalKey[];
  exclude_signals_any: PlannerPolicySignalKey[];
  required_shortlist_features: PlannerDomainSelectionFeatureKey[];
  required_capability_features: PlannerDomainSelectionFeatureKey[];
  score_delta: number;
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

export interface PlannerProjectionPolicyRow {
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
  policy_json: PlannerProjectionPolicyRule;
  scope_rank?: number;
  is_seeded?: boolean;
  is_effective?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlannerProjectionPolicyListResponse {
  workspace_id: string;
  vertical_norm: string;
  base_domain_id: number | null;
  can_edit: boolean;
  policies: PlannerProjectionPolicyRow[];
}

export interface PlannerProjectionPolicyUpsertRequest {
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
  policy_json: PlannerProjectionPolicyRule;
}

export interface PlannerSignalPolicyRow {
  id?: number;
  policy_key: string;
  name: string;
  description: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id: string | null;
  scope_vertical_norm: string | null;
  priority: number;
  is_active: boolean;
  stop_on_match: boolean;
  policy_json: PlannerSignalPolicyRule;
  scope_rank?: number;
  is_seeded?: boolean;
  is_effective?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlannerSignalPolicyListResponse {
  workspace_id: string;
  can_edit: boolean;
  policies: PlannerSignalPolicyRow[];
}

export interface PlannerSignalPolicyUpsertRequest {
  id?: number;
  policy_key: string;
  name: string;
  description?: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id?: string | null;
  scope_vertical_norm?: string | null;
  priority?: number;
  is_active?: boolean;
  stop_on_match?: boolean;
  policy_json: PlannerSignalPolicyRule;
}

export interface PlannerPromptIntentPolicyRow {
  id?: number;
  policy_key: string;
  name: string;
  description: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id: string | null;
  scope_vertical_norm: string | null;
  priority: number;
  is_active: boolean;
  stop_on_match: boolean;
  policy_json: PlannerPromptIntentPolicyRule;
  scope_rank?: number;
  is_seeded?: boolean;
  is_effective?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlannerPromptIntentPolicyListResponse {
  workspace_id: string;
  can_edit: boolean;
  policies: PlannerPromptIntentPolicyRow[];
}

export interface PlannerPromptIntentPolicyUpsertRequest {
  id?: number;
  policy_key: string;
  name: string;
  description?: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id?: string | null;
  scope_vertical_norm?: string | null;
  priority?: number;
  is_active?: boolean;
  stop_on_match?: boolean;
  policy_json: PlannerPromptIntentPolicyRule;
}

export interface PlannerRetrievalPolicyRow {
  id?: number;
  policy_key: string;
  name: string;
  description: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id: string | null;
  scope_vertical_norm: string | null;
  priority: number;
  is_active: boolean;
  stop_on_match: boolean;
  policy_json: PlannerRetrievalPolicyRule;
  scope_rank?: number;
  is_seeded?: boolean;
  is_effective?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlannerRetrievalPolicyListResponse {
  workspace_id: string;
  can_edit: boolean;
  policies: PlannerRetrievalPolicyRow[];
}

export interface PlannerRetrievalPolicyUpsertRequest {
  id?: number;
  policy_key: string;
  name: string;
  description?: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id?: string | null;
  scope_vertical_norm?: string | null;
  priority?: number;
  is_active?: boolean;
  stop_on_match?: boolean;
  policy_json: PlannerRetrievalPolicyRule;
}

export interface PlannerDomainSelectionPolicyRow {
  id?: number;
  policy_key: string;
  name: string;
  description: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id: string | null;
  scope_vertical_norm: string | null;
  priority: number;
  is_active: boolean;
  stop_on_match: boolean;
  policy_json: PlannerDomainSelectionPolicyRule;
  scope_rank?: number;
  is_seeded?: boolean;
  is_effective?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlannerDomainSelectionPolicyListResponse {
  workspace_id: string;
  can_edit: boolean;
  policies: PlannerDomainSelectionPolicyRow[];
}

export interface PlannerDomainSelectionPolicyUpsertRequest {
  id?: number;
  policy_key: string;
  name: string;
  description?: string | null;
  scope_type: PlannerPolicyScopeType;
  scope_workspace_id?: string | null;
  scope_vertical_norm?: string | null;
  priority?: number;
  is_active?: boolean;
  stop_on_match?: boolean;
  policy_json: PlannerDomainSelectionPolicyRule;
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
