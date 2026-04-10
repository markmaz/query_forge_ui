import type {
  PlannerDomainSelectionFeatureKey,
  PlannerPolicyCandidateReviewStatus,
  PlannerPolicyCandidateSourceType,
  PlannerPolicyCapabilityKey,
  PlannerPolicyScopeType,
  PlannerPolicySignalKey,
  PlannerPolicySourceType,
  PlannerPolicySupportLevel,
  PlannerPromptIntentActionKey,
  PlannerRetrievalQuerySource,
  PlannerSignalHelperName,
  PlannerSignalMatchType,
} from "@/features/system-admin/types";

import type { PlannerPoliciesTab } from "./types";
import type { DrawerState } from "./types";

export const TABS: { key: PlannerPoliciesTab; label: string }[] = [
  { key: "capabilities", label: "Capabilities" },
  { key: "policies", label: "Policies" },
  { key: "projection", label: "Projection Policies" },
  { key: "signal", label: "Signal Policies" },
  { key: "prompt_intent", label: "Prompt Intent Policies" },
  { key: "retrieval", label: "Retrieval Policies" },
  { key: "domain_selection", label: "Domain Selection Policies" },
  { key: "candidates", label: "Candidates" },
];

export const CAPABILITY_OPTIONS: PlannerPolicyCapabilityKey[] = [
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
];

export const PROJECTION_CONCEPT_OPTIONS = [
  "STUDENT_ID",
  "ID",
  "STUDENT_FIRST_NAME",
  "FIRST_NAME",
  "STUDENT_LAST_NAME",
  "LAST_NAME",
  "SCHOOL_NAME",
  "SCHOOL_ID",
  "DISTRICT_NAME",
  "STAFF_ROLE",
  "STAFF_CLASSIFICATION",
];

export const PROJECTION_COLUMN_NAME_OPTIONS = [
  "school_name",
  "lea_name",
  "school_number",
  "position_title",
  "classroom_position",
  "job_title",
  "role_title",
  "staff_role",
  "staff_classification",
];

export const PROJECTION_JOIN_TABLE_OPTIONS = [
  "dim_student",
  "dim_school",
  "dim_staff",
  "fct_student_school_association",
  "fct_staff_school_assignment",
];

export const SIGNAL_OPTIONS: PlannerPolicySignalKey[] = [
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
];

export const SCOPE_OPTIONS: PlannerPolicyScopeType[] = [
  "workspace_domain",
  "workspace",
  "vertical_domain",
  "vertical",
  "global_domain",
  "global",
];

export const GLOBAL_WORKSPACE_SCOPE_OPTIONS: PlannerPolicyScopeType[] = ["workspace", "global"];

export const SIGNAL_MATCH_TYPE_OPTIONS: PlannerSignalMatchType[] = [
  "regex",
  "regex_all",
  "substring_any",
  "helper",
  "school_literal",
];

export const SIGNAL_HELPER_OPTIONS: PlannerSignalHelperName[] = [
  "prompt_implies_staff_work_context",
  "prompt_implies_student_school_context",
  "prompt_has_adm_intent",
  "prompt_mentions_school_or_district",
  "prompt_has_city_state_pattern",
  "prompt_has_nativity",
  "prompt_has_name_constraint",
  "prompt_prefers_canonical_name_columns",
  "prompt_explicitly_requests_preferred_name",
];

export const PROMPT_INTENT_ACTION_OPTIONS: PlannerPromptIntentActionKey[] = [
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
];

export const RETRIEVAL_QUERY_SOURCE_OPTIONS: PlannerRetrievalQuerySource[] = ["vector", "semantic_vector"];

export const DOMAIN_SELECTION_FEATURE_OPTIONS: PlannerDomainSelectionFeatureKey[] = [
  "SUBGROUP_COLUMN",
  "STUDENT_IDENTITY_COLUMN",
  "STAFF_IDENTITY_COLUMN",
  "ADM_SIGNAL_COLUMN",
  "ADM_METRIC",
  "BIRTH_DATE_COLUMN",
  "AGE_COLUMN",
  "CALENDAR_DAY_COLUMN",
  "SCHOOL_DAY_FLAG_COLUMN",
];

export const SUPPORT_LEVEL_OPTIONS: PlannerPolicySupportLevel[] = ["direct", "derived", "partial"];

export const SOURCE_TYPE_OPTIONS: PlannerPolicySourceType[] = [
  "semantic_concept",
  "dimension",
  "filter",
  "metric",
  "derived_condition",
  "heuristic_inference",
];

export const CANDIDATE_SOURCE_OPTIONS: PlannerPolicyCandidateSourceType[] = [
  "manual",
  "ai_recommendation",
  "trace_review",
];

export const CANDIDATE_REVIEW_FILTERS: Array<PlannerPolicyCandidateReviewStatus | ""> = [
  "",
  "pending",
  "approved",
  "rejected",
];

export const TAB_COUNT_LABEL: Record<PlannerPoliciesTab, string> = {
  capabilities: "capability",
  policies: "policy",
  projection: "projection policy",
  signal: "signal policy",
  prompt_intent: "prompt intent policy",
  retrieval: "retrieval policy",
  domain_selection: "domain selection policy",
  candidates: "candidate",
};

export function getDrawerTitle(drawerState: Exclude<DrawerState, null>): string {
  if (drawerState.kind === "candidate_suggest") {
    return "Suggest Candidate With AI";
  }

  const label =
    drawerState.kind === "capabilities"
      ? "Capability"
      : drawerState.kind === "policies"
        ? "Policy"
        : drawerState.kind === "projection"
          ? "Projection Policy"
          : drawerState.kind === "signal"
            ? "Signal Policy"
            : drawerState.kind === "prompt_intent"
              ? "Prompt Intent Policy"
              : drawerState.kind === "retrieval"
                ? "Retrieval Policy"
                : drawerState.kind === "domain_selection"
                  ? "Domain Selection Policy"
                  : "Candidate";

  return `${drawerState.mode === "create" ? "Add" : "Edit"} ${label}`;
}

export function getDrawerFormId(drawerState: Exclude<DrawerState, null>): string {
  if (drawerState.kind === "candidate_suggest") return "planner-policies-candidate-suggest-form";
  if (drawerState.kind === "projection") return "planner-policies-projection-form";
  if (drawerState.kind === "signal") return "planner-policies-signal-form";
  if (drawerState.kind === "prompt_intent") return "planner-policies-prompt-intent-form";
  if (drawerState.kind === "retrieval") return "planner-policies-retrieval-form";
  if (drawerState.kind === "domain_selection") return "planner-policies-domain-selection-form";
  return `planner-policies-${drawerState.kind}-form`;
}
