import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { fetchDomains, type Domain } from "@/shared/services/queryStudioAdminApi";
import {
  useDeletePlannerDomainSelectionPolicy,
  useApprovePlannerRerankPolicyCandidate,
  useCreatePlannerRerankPolicyCandidate,
  useDeletePlannerDomainCapability,
  useDeletePlannerPromptIntentPolicy,
  useDeletePlannerProjectionPolicy,
  useDeletePlannerRetrievalPolicy,
  useDeletePlannerRerankPolicy,
  useDeletePlannerRerankPolicyCandidate,
  useDeletePlannerSignalPolicy,
  usePlannerDomainSelectionPolicies,
  usePlannerDomainCapabilities,
  usePlannerPromptIntentPolicies,
  usePlannerProjectionPolicies,
  usePlannerRetrievalPolicies,
  usePlannerRerankPolicies,
  usePlannerRerankPolicyCandidates,
  usePlannerSignalPolicies,
  useSuggestPlannerRerankPolicyCandidate,
  useUpsertPlannerDomainSelectionPolicy,
  useUpsertPlannerDomainCapability,
  useUpsertPlannerPromptIntentPolicy,
  useUpsertPlannerProjectionPolicy,
  useUpsertPlannerRetrievalPolicy,
  useUpsertPlannerRerankPolicy,
  useUpsertPlannerSignalPolicy,
} from "@/features/system-admin/hooks";
import type {
  PlannerDomainSelectionFeatureKey,
  PlannerDomainSelectionPolicyRow,
  PlannerDomainSelectionPolicyRule,
  PlannerDomainSelectionPolicyUpsertRequest,
  PlannerDomainCapabilityRow,
  PlannerDomainCapabilityUpsertRequest,
  PlannerPolicyCandidateReviewStatus,
  PlannerPolicyCandidateSourceType,
  PlannerPolicyCapabilityKey,
  PlannerPromptIntentActionKey,
  PlannerPromptIntentPolicyRow,
  PlannerPromptIntentPolicyRule,
  PlannerPromptIntentPolicyUpsertRequest,
  PlannerPolicyScopeType,
  PlannerSignalHelperName,
  PlannerSignalMatchType,
  PlannerSignalPolicyRow,
  PlannerSignalPolicyRule,
  PlannerSignalPolicyUpsertRequest,
  PlannerPolicySignalKey,
  PlannerPolicySourceType,
  PlannerPolicySupportLevel,
  PlannerProjectionMode,
  PlannerProjectionPolicyRow,
  PlannerProjectionPolicyRule,
  PlannerProjectionPolicyUpsertRequest,
  PlannerRetrievalPolicyRow,
  PlannerRetrievalPolicyRule,
  PlannerRetrievalPolicyUpsertRequest,
  PlannerRetrievalQuerySource,
  PlannerRerankPolicyCandidateCreateRequest,
  PlannerRerankPolicyCandidateSuggestRequest,
  PlannerRerankPolicyCandidateRow,
  PlannerRerankPolicyRow,
  PlannerRerankPolicyRule,
  PlannerRerankPolicyUpsertRequest,
} from "@/features/system-admin/types";
import "../systemAdmin.css";

type PlannerPoliciesTab =
  | "capabilities"
  | "policies"
  | "projection"
  | "signal"
  | "prompt_intent"
  | "retrieval"
  | "domain_selection"
  | "candidates";

type RuleFormState = {
  whenSignalsAll: PlannerPolicySignalKey[];
  whenSignalsAny: PlannerPolicySignalKey[];
  excludeSignalsAny: PlannerPolicySignalKey[];
  preferCapabilities: PlannerPolicyCapabilityKey[];
  penalizeMissing: PlannerPolicyCapabilityKey[];
  requireForBonus: PlannerPolicyCapabilityKey[];
  boost: string;
  penalty: string;
  maxEffect: string;
};

type CapabilityFormState = {
  id?: number;
  capabilityKey: PlannerPolicyCapabilityKey;
  scopeType: PlannerPolicyScopeType;
  supportLevel: PlannerPolicySupportLevel;
  sourceType: PlannerPolicySourceType;
  sourceRef: string;
  confidence: string;
  notes: string;
  isActive: boolean;
};

type PolicyFormState = {
  id?: number;
  policyKey: string;
  name: string;
  description: string;
  scopeType: PlannerPolicyScopeType;
  priority: string;
  isActive: boolean;
  stopOnMatch: boolean;
  rule: RuleFormState;
};

type ProjectionRuleFormState = {
  whenSignalsAll: PlannerPolicySignalKey[];
  whenSignalsAny: PlannerPolicySignalKey[];
  excludeSignalsAny: PlannerPolicySignalKey[];
  projectionMode: PlannerProjectionMode;
  requiredConceptKeys: string[];
  excludedConceptKeys: string[];
  requiredColumnNames: string[];
  excludedColumnNames: string[];
  requiredFilterConceptKeys: string[];
  requiredJoinTables: string[];
};

type ProjectionPolicyFormState = {
  id?: number;
  policyKey: string;
  name: string;
  description: string;
  scopeType: PlannerPolicyScopeType;
  priority: string;
  isActive: boolean;
  stopOnMatch: boolean;
  rule: ProjectionRuleFormState;
};

type SignalRuleFormState = {
  signalKeys: PlannerPolicySignalKey[];
  matchType: PlannerSignalMatchType;
  patterns: string[];
  helperName: PlannerSignalHelperName | "";
  suffixes: string[];
  stopwords: string[];
  caseSensitive: boolean;
};

type SignalPolicyFormState = {
  id?: number;
  policyKey: string;
  name: string;
  description: string;
  scopeType: PlannerPolicyScopeType;
  priority: string;
  isActive: boolean;
  stopOnMatch: boolean;
  rule: SignalRuleFormState;
};

type PromptIntentRuleFormState = {
  actionKey: PlannerPromptIntentActionKey;
  regexPatterns: string[];
  substringPatterns: string[];
  stateCodes: string[];
};

type PromptIntentPolicyFormState = {
  id?: number;
  policyKey: string;
  name: string;
  description: string;
  scopeType: PlannerPolicyScopeType;
  priority: string;
  isActive: boolean;
  stopOnMatch: boolean;
  rule: PromptIntentRuleFormState;
};

type RetrievalRuleFormState = {
  whenSignalsAll: PlannerPolicySignalKey[];
  whenSignalsAny: PlannerPolicySignalKey[];
  excludeSignalsAny: PlannerPolicySignalKey[];
  whenConceptKeyPatternsAny: string[];
  querySpecsJson: string;
  domainNamePreferTokens: string[];
  domainNameAvoidTokens: string[];
  domainNamePositiveBias: string;
  domainNameNegativeBias: string;
};

type RetrievalPolicyFormState = {
  id?: number;
  policyKey: string;
  name: string;
  description: string;
  scopeType: PlannerPolicyScopeType;
  priority: string;
  isActive: boolean;
  stopOnMatch: boolean;
  rule: RetrievalRuleFormState;
};

type DomainSelectionRuleFormState = {
  whenSignalsAll: PlannerPolicySignalKey[];
  whenSignalsAny: PlannerPolicySignalKey[];
  excludeSignalsAny: PlannerPolicySignalKey[];
  requiredShortlistFeatures: PlannerDomainSelectionFeatureKey[];
  requiredCapabilityFeatures: PlannerDomainSelectionFeatureKey[];
  scoreDelta: string;
};

type DomainSelectionPolicyFormState = {
  id?: number;
  policyKey: string;
  name: string;
  description: string;
  scopeType: PlannerPolicyScopeType;
  priority: string;
  isActive: boolean;
  stopOnMatch: boolean;
  rule: DomainSelectionRuleFormState;
};

type CandidateFormState = {
  id?: number;
  candidateKey: string;
  sourceType: PlannerPolicyCandidateSourceType;
  confidence: string;
  rationaleJson: string;
  rule: RuleFormState;
};

type SuggestFormState = {
  prompt: string;
  observedDomainId: string;
  candidateKey: string;
  notes: string;
};

type DrawerState =
  | { kind: "capabilities"; mode: "create" | "edit" }
  | { kind: "policies"; mode: "create" | "edit" }
  | { kind: "projection"; mode: "create" | "edit" }
  | { kind: "signal"; mode: "create" | "edit" }
  | { kind: "prompt_intent"; mode: "create" | "edit" }
  | { kind: "retrieval"; mode: "create" | "edit" }
  | { kind: "domain_selection"; mode: "create" | "edit" }
  | { kind: "candidates"; mode: "create" | "edit" }
  | { kind: "candidate_suggest"; mode: "create" }
  | null;

type DeleteDialogState =
  | { kind: "capability"; id: number; label: string }
  | { kind: "policy"; id: number; label: string }
  | { kind: "projection_policy"; id: number; label: string }
  | { kind: "signal_policy"; id: number; label: string }
  | { kind: "prompt_intent_policy"; id: number; label: string }
  | { kind: "retrieval_policy"; id: number; label: string }
  | { kind: "domain_selection_policy"; id: number; label: string }
  | { kind: "candidate"; id: number; label: string }
  | null;

const TABS: { key: PlannerPoliciesTab; label: string }[] = [
  { key: "capabilities", label: "Capabilities" },
  { key: "policies", label: "Policies" },
  { key: "projection", label: "Projection Policies" },
  { key: "signal", label: "Signal Policies" },
  { key: "prompt_intent", label: "Prompt Intent Policies" },
  { key: "retrieval", label: "Retrieval Policies" },
  { key: "domain_selection", label: "Domain Selection Policies" },
  { key: "candidates", label: "Candidates" },
];

const CAPABILITY_OPTIONS: PlannerPolicyCapabilityKey[] = [
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

const PROJECTION_CONCEPT_OPTIONS = [
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

const PROJECTION_COLUMN_NAME_OPTIONS = [
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

const PROJECTION_JOIN_TABLE_OPTIONS = [
  "dim_student",
  "dim_school",
  "dim_staff",
  "fct_student_school_association",
  "fct_staff_school_assignment",
];

const SIGNAL_OPTIONS: PlannerPolicySignalKey[] = [
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

const SCOPE_OPTIONS: PlannerPolicyScopeType[] = [
  "workspace_domain",
  "workspace",
  "vertical_domain",
  "vertical",
  "global_domain",
  "global",
];

const GLOBAL_WORKSPACE_SCOPE_OPTIONS: PlannerPolicyScopeType[] = ["workspace", "global"];

const SIGNAL_MATCH_TYPE_OPTIONS: PlannerSignalMatchType[] = [
  "regex",
  "regex_all",
  "substring_any",
  "helper",
  "school_literal",
];

const SIGNAL_HELPER_OPTIONS: PlannerSignalHelperName[] = [
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

const PROMPT_INTENT_ACTION_OPTIONS: PlannerPromptIntentActionKey[] = [
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
const RETRIEVAL_QUERY_SOURCE_OPTIONS: PlannerRetrievalQuerySource[] = ["vector", "semantic_vector"];
const DOMAIN_SELECTION_FEATURE_OPTIONS: PlannerDomainSelectionFeatureKey[] = [
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

const SUPPORT_LEVEL_OPTIONS: PlannerPolicySupportLevel[] = ["direct", "derived", "partial"];
const SOURCE_TYPE_OPTIONS: PlannerPolicySourceType[] = [
  "semantic_concept",
  "dimension",
  "filter",
  "metric",
  "derived_condition",
  "heuristic_inference",
];
const CANDIDATE_SOURCE_OPTIONS: PlannerPolicyCandidateSourceType[] = [
  "manual",
  "ai_recommendation",
  "trace_review",
];
const CANDIDATE_REVIEW_FILTERS: Array<PlannerPolicyCandidateReviewStatus | ""> = ["", "pending", "approved", "rejected"];
const TAB_COUNT_LABEL: Record<PlannerPoliciesTab, string> = {
  capabilities: "capability",
  policies: "policy",
  projection: "projection policy",
  signal: "signal policy",
  prompt_intent: "prompt intent policy",
  retrieval: "retrieval policy",
  domain_selection: "domain selection policy",
  candidates: "candidate",
};

function defaultRuleForm(): RuleFormState {
  return {
    whenSignalsAll: [],
    whenSignalsAny: [],
    excludeSignalsAny: [],
    preferCapabilities: [],
    penalizeMissing: [],
    requireForBonus: [],
    boost: "0.20",
    penalty: "0.20",
    maxEffect: "0.30",
  };
}

function defaultCapabilityForm(): CapabilityFormState {
  return {
    capabilityKey: "SCHOOL_NAME",
    scopeType: "workspace_domain",
    supportLevel: "direct",
    sourceType: "semantic_concept",
    sourceRef: "",
    confidence: "1.0",
    notes: "",
    isActive: true,
  };
}

function defaultPolicyForm(): PolicyFormState {
  return {
    policyKey: "",
    name: "",
    description: "",
    scopeType: "workspace_domain",
    priority: "100",
    isActive: true,
    stopOnMatch: false,
    rule: defaultRuleForm(),
  };
}

function defaultProjectionRuleForm(): ProjectionRuleFormState {
  return {
    whenSignalsAll: [],
    whenSignalsAny: [],
    excludeSignalsAny: [],
    projectionMode: "prepend",
    requiredConceptKeys: [],
    excludedConceptKeys: [],
    requiredColumnNames: [],
    excludedColumnNames: [],
    requiredFilterConceptKeys: [],
    requiredJoinTables: [],
  };
}

function defaultProjectionPolicyForm(): ProjectionPolicyFormState {
  return {
    policyKey: "",
    name: "",
    description: "",
    scopeType: "workspace_domain",
    priority: "100",
    isActive: true,
    stopOnMatch: false,
    rule: defaultProjectionRuleForm(),
  };
}

function defaultSignalRuleForm(): SignalRuleFormState {
  return {
    signalKeys: [],
    matchType: "regex",
    patterns: [],
    helperName: "",
    suffixes: [],
    stopwords: [],
    caseSensitive: false,
  };
}

function defaultSignalPolicyForm(): SignalPolicyFormState {
  return {
    policyKey: "",
    name: "",
    description: "",
    scopeType: "workspace",
    priority: "100",
    isActive: true,
    stopOnMatch: false,
    rule: defaultSignalRuleForm(),
  };
}

function defaultPromptIntentRuleForm(): PromptIntentRuleFormState {
  return {
    actionKey: "list_students",
    regexPatterns: [],
    substringPatterns: [],
    stateCodes: [],
  };
}

function defaultPromptIntentPolicyForm(): PromptIntentPolicyFormState {
  return {
    policyKey: "",
    name: "",
    description: "",
    scopeType: "workspace",
    priority: "100",
    isActive: true,
    stopOnMatch: false,
    rule: defaultPromptIntentRuleForm(),
  };
}

function defaultRetrievalRuleForm(): RetrievalRuleFormState {
  return {
    whenSignalsAll: [],
    whenSignalsAny: [],
    excludeSignalsAny: [],
    whenConceptKeyPatternsAny: [],
    querySpecsJson: "[]",
    domainNamePreferTokens: [],
    domainNameAvoidTokens: [],
    domainNamePositiveBias: "0.00",
    domainNameNegativeBias: "0.00",
  };
}

function defaultRetrievalPolicyForm(): RetrievalPolicyFormState {
  return {
    policyKey: "",
    name: "",
    description: "",
    scopeType: "workspace",
    priority: "100",
    isActive: true,
    stopOnMatch: false,
    rule: defaultRetrievalRuleForm(),
  };
}

function defaultDomainSelectionRuleForm(): DomainSelectionRuleFormState {
  return {
    whenSignalsAll: [],
    whenSignalsAny: [],
    excludeSignalsAny: [],
    requiredShortlistFeatures: [],
    requiredCapabilityFeatures: [],
    scoreDelta: "0.10",
  };
}

function defaultDomainSelectionPolicyForm(): DomainSelectionPolicyFormState {
  return {
    policyKey: "",
    name: "",
    description: "",
    scopeType: "workspace",
    priority: "100",
    isActive: true,
    stopOnMatch: false,
    rule: defaultDomainSelectionRuleForm(),
  };
}

function defaultCandidateForm(): CandidateFormState {
  return {
    candidateKey: "",
    sourceType: "manual",
    confidence: "0.8",
    rationaleJson: "",
    rule: defaultRuleForm(),
  };
}

function defaultSuggestForm(): SuggestFormState {
  return {
    prompt: "",
    observedDomainId: "",
    candidateKey: "",
    notes: "",
  };
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function dedupeValues<T extends string>(values: readonly T[] | null | undefined): T[] {
  return Array.from(new Set(values ?? [])) as T[];
}

function clampUnit(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function ruleToForm(rule?: PlannerRerankPolicyRule | null): RuleFormState {
  return {
    whenSignalsAll: dedupeValues(rule?.when_signals_all),
    whenSignalsAny: dedupeValues(rule?.when_signals_any),
    excludeSignalsAny: dedupeValues(rule?.exclude_signals_any),
    preferCapabilities: dedupeValues(rule?.prefer_capabilities),
    penalizeMissing: dedupeValues(rule?.penalize_missing),
    requireForBonus: dedupeValues(rule?.require_for_bonus),
    boost: String(rule?.boost ?? 0.2),
    penalty: String(rule?.penalty ?? 0.2),
    maxEffect: String(rule?.max_effect ?? 0.3),
  };
}

function formToRule(form: RuleFormState): PlannerRerankPolicyRule {
  return {
    version: 1,
    when_signals_all: dedupeValues(form.whenSignalsAll),
    when_signals_any: dedupeValues(form.whenSignalsAny),
    exclude_signals_any: dedupeValues(form.excludeSignalsAny),
    prefer_capabilities: dedupeValues(form.preferCapabilities).map((entry) => entry.toUpperCase()) as PlannerPolicyCapabilityKey[],
    penalize_missing: dedupeValues(form.penalizeMissing).map((entry) => entry.toUpperCase()) as PlannerPolicyCapabilityKey[],
    require_for_bonus: dedupeValues(form.requireForBonus).map((entry) => entry.toUpperCase()) as PlannerPolicyCapabilityKey[],
    boost: clampUnit(Number(form.boost), 0),
    penalty: clampUnit(Number(form.penalty), 0),
    max_effect: clampUnit(Number(form.maxEffect), 0.3),
  };
}

function projectionRuleToForm(rule?: PlannerProjectionPolicyRule | null): ProjectionRuleFormState {
  return {
    whenSignalsAll: dedupeValues(rule?.when_signals_all),
    whenSignalsAny: dedupeValues(rule?.when_signals_any),
    excludeSignalsAny: dedupeValues(rule?.exclude_signals_any),
    projectionMode: rule?.projection_mode === "append" ? "append" : "prepend",
    requiredConceptKeys: dedupeValues(rule?.required_concept_keys),
    excludedConceptKeys: dedupeValues(rule?.excluded_concept_keys),
    requiredColumnNames: dedupeValues(rule?.required_column_names),
    excludedColumnNames: dedupeValues(rule?.excluded_column_names),
    requiredFilterConceptKeys: dedupeValues(rule?.required_filter_concept_keys),
    requiredJoinTables: dedupeValues(rule?.required_join_tables),
  };
}

function formToProjectionRule(form: ProjectionRuleFormState): PlannerProjectionPolicyRule {
  return {
    version: 1,
    when_signals_all: dedupeValues(form.whenSignalsAll),
    when_signals_any: dedupeValues(form.whenSignalsAny),
    exclude_signals_any: dedupeValues(form.excludeSignalsAny),
    projection_mode: form.projectionMode,
    required_concept_keys: dedupeValues(form.requiredConceptKeys).map((entry) => entry.toUpperCase()),
    excluded_concept_keys: dedupeValues(form.excludedConceptKeys).map((entry) => entry.toUpperCase()),
    required_column_names: dedupeValues(form.requiredColumnNames).map((entry) => entry.toLowerCase()),
    excluded_column_names: dedupeValues(form.excludedColumnNames).map((entry) => entry.toLowerCase()),
    required_filter_concept_keys: dedupeValues(form.requiredFilterConceptKeys).map((entry) => entry.toUpperCase()),
    required_join_tables: dedupeValues(form.requiredJoinTables).map((entry) => entry.toLowerCase()),
  };
}

function signalRuleToForm(rule?: PlannerSignalPolicyRule | null): SignalRuleFormState {
  return {
    signalKeys: dedupeValues(rule?.signal_keys),
    matchType: rule?.match_type ?? "regex",
    patterns: dedupeValues(rule?.patterns),
    helperName: rule?.helper_name ?? "",
    suffixes: dedupeValues(rule?.suffixes),
    stopwords: dedupeValues(rule?.stopwords),
    caseSensitive: Boolean(rule?.case_sensitive),
  };
}

function formToSignalRule(form: SignalRuleFormState): PlannerSignalPolicyRule {
  return {
    version: 1,
    signal_keys: dedupeValues(form.signalKeys),
    match_type: form.matchType,
    patterns: dedupeValues(form.patterns),
    helper_name: form.helperName || null,
    suffixes: dedupeValues(form.suffixes).map((entry) => entry.toLowerCase()),
    stopwords: dedupeValues(form.stopwords).map((entry) => entry.toLowerCase()),
    case_sensitive: form.caseSensitive,
  };
}

function promptIntentRuleToForm(rule?: PlannerPromptIntentPolicyRule | null): PromptIntentRuleFormState {
  return {
    actionKey: rule?.action_key ?? "list_students",
    regexPatterns: dedupeValues(rule?.regex_patterns),
    substringPatterns: dedupeValues(rule?.substring_patterns),
    stateCodes: dedupeValues(rule?.state_codes),
  };
}

function formToPromptIntentRule(form: PromptIntentRuleFormState): PlannerPromptIntentPolicyRule {
  return {
    version: 1,
    action_key: form.actionKey,
    regex_patterns: dedupeValues(form.regexPatterns),
    substring_patterns: dedupeValues(form.substringPatterns),
    state_codes: dedupeValues(form.stateCodes).map((entry) => entry.toLowerCase()),
  };
}

function retrievalRuleToForm(rule?: PlannerRetrievalPolicyRule | null): RetrievalRuleFormState {
  return {
    whenSignalsAll: dedupeValues(rule?.when_signals_all),
    whenSignalsAny: dedupeValues(rule?.when_signals_any),
    excludeSignalsAny: dedupeValues(rule?.exclude_signals_any),
    whenConceptKeyPatternsAny: dedupeValues(rule?.when_concept_key_patterns_any),
    querySpecsJson: JSON.stringify(rule?.query_specs ?? [], null, 2),
    domainNamePreferTokens: dedupeValues(rule?.domain_name_prefer_tokens),
    domainNameAvoidTokens: dedupeValues(rule?.domain_name_avoid_tokens),
    domainNamePositiveBias: String(rule?.domain_name_positive_bias ?? 0),
    domainNameNegativeBias: String(rule?.domain_name_negative_bias ?? 0),
  };
}

function formToRetrievalRule(form: RetrievalRuleFormState): PlannerRetrievalPolicyRule {
  let querySpecs: PlannerRetrievalPolicyRule["query_specs"] = [];
  const raw = form.querySpecsJson.trim();
  if (raw) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Query specs JSON must be an array.");
    }
    querySpecs = parsed.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error("Each query spec must be an object.");
      }
      const record = entry as Record<string, unknown>;
      const query = String(record.query ?? "").trim();
      if (!query) {
        throw new Error("Each query spec requires a query.");
      }
      const source = String(record.source ?? "vector").trim().toLowerCase();
      if (!RETRIEVAL_QUERY_SOURCE_OPTIONS.includes(source as PlannerRetrievalQuerySource)) {
        throw new Error(`Invalid retrieval query source: ${source}`);
      }
      const reasons = Array.isArray(record.reasons)
        ? Array.from(new Set(record.reasons.map((item) => String(item ?? "").trim()).filter(Boolean)))
        : [];
      return {
        query,
        score_boost: clampUnit(Number(record.score_boost ?? 0), 0),
        reasons,
        source: source as PlannerRetrievalQuerySource,
      };
    });
  }

  return {
    version: 1,
    when_signals_all: dedupeValues(form.whenSignalsAll),
    when_signals_any: dedupeValues(form.whenSignalsAny),
    exclude_signals_any: dedupeValues(form.excludeSignalsAny),
    when_concept_key_patterns_any: dedupeValues(form.whenConceptKeyPatternsAny).map((entry) => entry.toUpperCase()),
    query_specs: querySpecs,
    domain_name_prefer_tokens: dedupeValues(form.domainNamePreferTokens).map((entry) => entry.toLowerCase()),
    domain_name_avoid_tokens: dedupeValues(form.domainNameAvoidTokens).map((entry) => entry.toLowerCase()),
    domain_name_positive_bias: clampUnit(Number(form.domainNamePositiveBias), 0),
    domain_name_negative_bias: clampUnit(Number(form.domainNameNegativeBias), 0),
  };
}

function domainSelectionRuleToForm(rule?: PlannerDomainSelectionPolicyRule | null): DomainSelectionRuleFormState {
  return {
    whenSignalsAll: dedupeValues(rule?.when_signals_all),
    whenSignalsAny: dedupeValues(rule?.when_signals_any),
    excludeSignalsAny: dedupeValues(rule?.exclude_signals_any),
    requiredShortlistFeatures: dedupeValues(rule?.required_shortlist_features),
    requiredCapabilityFeatures: dedupeValues(rule?.required_capability_features),
    scoreDelta: String(rule?.score_delta ?? 0.1),
  };
}

function formToDomainSelectionRule(form: DomainSelectionRuleFormState): PlannerDomainSelectionPolicyRule {
  return {
    version: 1,
    when_signals_all: dedupeValues(form.whenSignalsAll),
    when_signals_any: dedupeValues(form.whenSignalsAny),
    exclude_signals_any: dedupeValues(form.excludeSignalsAny),
    required_shortlist_features: dedupeValues(form.requiredShortlistFeatures),
    required_capability_features: dedupeValues(form.requiredCapabilityFeatures),
    score_delta: clampUnit(Number(form.scoreDelta), 0.1),
  };
}

function MultiSelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: T[];
  options: readonly T[];
  onChange: (next: T[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selected = dedupeValues(value);
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map(humanizeKey).join(", ")
        : `${selected.length} selected`;

  function toggleOption(option: T) {
    if (selected.includes(option)) {
      onChange(selected.filter((entry) => entry !== option));
      return;
    }
    onChange([...selected, option]);
  }

  return (
    <div className="sa-multiselect" ref={rootRef}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        className="form-control sa-multiselect-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={selected.length === 0 ? "sa-multiselect-placeholder" : "sa-multiselect-value"}>
          {summary}
        </span>
        <i className={`fa fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="sa-multiselect-menu" role="listbox" id={menuId} aria-label={label} aria-multiselectable="true">
          <div className="sa-multiselect-actions">
            <button type="button" className="btn btn-sm btn-light" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          <div className="sa-multiselect-options">
            {options.map((option) => {
              const checked = selected.includes(option);
              return (
                <label key={option} className={`sa-multiselect-option ${checked ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(option)}
                  />
                  <span>{humanizeKey(option)}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TokenListField({
  id,
  label,
  value,
  onChange,
  placeholder,
  suggestions = [],
  normalize,
  hint,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  suggestions?: readonly string[];
  normalize?: (value: string) => string;
  hint?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  function commit(raw: string) {
    const cleaned = (normalize ? normalize(raw) : raw).trim();
    if (!cleaned) return;
    if (value.includes(cleaned)) {
      setDraft("");
      return;
    }
    onChange([...value, cleaned]);
    setDraft("");
  }

  function remove(token: string) {
    onChange(value.filter((entry) => entry !== token));
  }

  return (
    <div className="sa-token-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div
        className="form-control sa-token-field__control"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="sa-token-field__chips">
          {value.map((token) => (
            <span key={token} className="sa-token-field__chip">
              <span>{token}</span>
              <button type="button" aria-label={`Remove ${token}`} onClick={() => remove(token)}>
                <i className="fa fa-times" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={id}
            className="sa-token-field__input"
            value={draft}
            list={suggestions.length > 0 ? listId : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commit(draft);
              } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
                remove(value[value.length - 1] ?? "");
              }
            }}
            onBlur={() => commit(draft)}
            placeholder={value.length === 0 ? placeholder : ""}
          />
        </div>
      </div>
      {suggestions.length > 0 ? (
        <datalist id={listId}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
      {hint ? <div className="small text-muted">{hint}</div> : null}
    </div>
  );
}

function statusBadgeClass(active: boolean): string {
  return active ? "badge text-bg-success" : "badge text-bg-secondary";
}

function candidateStatusBadgeClass(status: PlannerPolicyCandidateReviewStatus): string {
  if (status === "approved") return "badge text-bg-success";
  if (status === "rejected") return "badge text-bg-danger";
  return "badge text-bg-warning";
}

function RuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: RuleFormState;
  onChange: (next: RuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof RuleFormState>(key: K, nextValue: RuleFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-all`}
          label="All Signals"
          value={value.whenSignalsAll}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAll", next)}
          placeholder="Select required signals"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-any`}
          label="Any Signals"
          value={value.whenSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAny", next)}
          placeholder="Select optional signals"
        />
      </div>
      <div className="col-12">
        <MultiSelectField
          id={`${prefix}-signals-exclude`}
          label="Exclude Signals"
          value={value.excludeSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("excludeSignalsAny", next)}
          placeholder="Select excluded signals"
        />
      </div>
      <div className="col-md-4">
        <MultiSelectField
          id={`${prefix}-prefer-capabilities`}
          label="Prefer Capabilities"
          value={value.preferCapabilities}
          options={CAPABILITY_OPTIONS}
          onChange={(next) => update("preferCapabilities", next)}
          placeholder="Select preferred capabilities"
        />
      </div>
      <div className="col-md-4">
        <MultiSelectField
          id={`${prefix}-penalize-missing`}
          label="Penalize Missing"
          value={value.penalizeMissing}
          options={CAPABILITY_OPTIONS}
          onChange={(next) => update("penalizeMissing", next)}
          placeholder="Select missing-capability penalties"
        />
      </div>
      <div className="col-md-4">
        <MultiSelectField
          id={`${prefix}-require-for-bonus`}
          label="Require For Bonus"
          value={value.requireForBonus}
          options={CAPABILITY_OPTIONS}
          onChange={(next) => update("requireForBonus", next)}
          placeholder="Select bonus prerequisites"
        />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${prefix}-boost`}>Boost</label>
        <input
          id={`${prefix}-boost`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.boost}
          onChange={(event) => update("boost", event.target.value)}
        />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${prefix}-penalty`}>Penalty</label>
        <input
          id={`${prefix}-penalty`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.penalty}
          onChange={(event) => update("penalty", event.target.value)}
        />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${prefix}-max-effect`}>Max Effect</label>
        <input
          id={`${prefix}-max-effect`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.maxEffect}
          onChange={(event) => update("maxEffect", event.target.value)}
        />
      </div>
      <div className="col-12">
        <div className="small text-muted">Known signals: {SIGNAL_OPTIONS.join(", ")}</div>
        <div className="small text-muted">Known capabilities: {CAPABILITY_OPTIONS.join(", ")}</div>
      </div>
    </div>
  );
}

function ProjectionRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: ProjectionRuleFormState;
  onChange: (next: ProjectionRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof ProjectionRuleFormState>(key: K, nextValue: ProjectionRuleFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-all`}
          label="All Signals"
          value={value.whenSignalsAll}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAll", next)}
          placeholder="Select required signals"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-any`}
          label="Any Signals"
          value={value.whenSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAny", next)}
          placeholder="Select optional signals"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-exclude`}
          label="Exclude Signals"
          value={value.excludeSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("excludeSignalsAny", next)}
          placeholder="Select excluded signals"
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-projection-mode`}>Projection Mode</label>
        <select
          id={`${prefix}-projection-mode`}
          className="form-select"
          value={value.projectionMode}
          onChange={(event) => update("projectionMode", event.target.value as PlannerProjectionMode)}
        >
          <option value="prepend">Prepend</option>
          <option value="append">Append</option>
        </select>
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-required-concepts`}
          label="Required Concepts"
          value={value.requiredConceptKeys}
          onChange={(next) => update("requiredConceptKeys", next)}
          placeholder="STUDENT_ID, STUDENT_FIRST_NAME"
          suggestions={PROJECTION_CONCEPT_OPTIONS}
          normalize={(entry) => entry.toUpperCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-excluded-concepts`}
          label="Excluded Concepts"
          value={value.excludedConceptKeys}
          onChange={(next) => update("excludedConceptKeys", next)}
          placeholder="SCHOOL_ID"
          suggestions={PROJECTION_CONCEPT_OPTIONS}
          normalize={(entry) => entry.toUpperCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-required-columns`}
          label="Required Columns"
          value={value.requiredColumnNames}
          onChange={(next) => update("requiredColumnNames", next)}
          placeholder="school_name, lea_name"
          suggestions={PROJECTION_COLUMN_NAME_OPTIONS}
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-excluded-columns`}
          label="Excluded Columns"
          value={value.excludedColumnNames}
          onChange={(next) => update("excludedColumnNames", next)}
          placeholder="staff_classification"
          suggestions={PROJECTION_COLUMN_NAME_OPTIONS}
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-required-filter-concepts`}
          label="Required Filter Concepts"
          value={value.requiredFilterConceptKeys}
          onChange={(next) => update("requiredFilterConceptKeys", next)}
          placeholder="SCHOOL_NAME"
          suggestions={PROJECTION_CONCEPT_OPTIONS}
          normalize={(entry) => entry.toUpperCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-required-joins`}
          label="Required Join Tables"
          value={value.requiredJoinTables}
          onChange={(next) => update("requiredJoinTables", next)}
          placeholder="dim_school"
          suggestions={PROJECTION_JOIN_TABLE_OPTIONS}
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-12">
        <div className="small text-muted">Use Enter or comma to add chips. Known concepts and join tables are suggested, but you can still add custom values.</div>
      </div>
    </div>
  );
}

function SignalRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: SignalRuleFormState;
  onChange: (next: SignalRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof SignalRuleFormState>(key: K, nextValue: SignalRuleFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signal-keys`}
          label="Signal Keys"
          value={value.signalKeys}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("signalKeys", next)}
          placeholder="Select emitted signals"
        />
      </div>
      <div className="col-md-3">
        <label className="form-label" htmlFor={`${prefix}-match-type`}>Match Type</label>
        <select
          id={`${prefix}-match-type`}
          className="form-select"
          value={value.matchType}
          onChange={(event) => update("matchType", event.target.value as PlannerSignalMatchType)}
        >
          {SIGNAL_MATCH_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="col-md-3 d-flex align-items-end">
        <div className="form-check mb-2">
          <input
            id={`${prefix}-case-sensitive`}
            className="form-check-input"
            type="checkbox"
            checked={value.caseSensitive}
            onChange={(event) => update("caseSensitive", event.target.checked)}
          />
          <label className="form-check-label" htmlFor={`${prefix}-case-sensitive`}>Case Sensitive</label>
        </div>
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-patterns`}
          label="Patterns"
          value={value.patterns}
          onChange={(next) => update("patterns", next)}
          placeholder="Regex or substring patterns"
          hint="Used for regex, regex_all, and substring_any match types."
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-helper-name`}>Helper Name</label>
        <select
          id={`${prefix}-helper-name`}
          className="form-select"
          value={value.helperName}
          onChange={(event) => update("helperName", event.target.value as PlannerSignalHelperName | "")}
        >
          <option value="">None</option>
          {SIGNAL_HELPER_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-suffixes`}
          label="Suffixes"
          value={value.suffixes}
          onChange={(next) => update("suffixes", next)}
          placeholder="elementary, middle, high"
          normalize={(entry) => entry.toLowerCase()}
          hint="Used for school_literal rules."
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-stopwords`}
          label="Stopwords"
          value={value.stopwords}
          onChange={(next) => update("stopwords", next)}
          placeholder="the, show, list"
          normalize={(entry) => entry.toLowerCase()}
          hint="Used for school_literal rules."
        />
      </div>
    </div>
  );
}

function PromptIntentRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: PromptIntentRuleFormState;
  onChange: (next: PromptIntentRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof PromptIntentRuleFormState>(key: K, nextValue: PromptIntentRuleFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-action-key`}>Action Key</label>
        <select
          id={`${prefix}-action-key`}
          className="form-select"
          value={value.actionKey}
          onChange={(event) => update("actionKey", event.target.value as PlannerPromptIntentActionKey)}
        >
          {PROMPT_INTENT_ACTION_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-state-codes`}
          label="State Codes"
          value={value.stateCodes}
          onChange={(next) => update("stateCodes", next)}
          placeholder="tn, tx"
          normalize={(entry) => entry.toLowerCase()}
          hint="Used for city_state_abbr rules."
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-regex-patterns`}
          label="Regex Patterns"
          value={value.regexPatterns}
          onChange={(next) => update("regexPatterns", next)}
          placeholder="Regex patterns"
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-substring-patterns`}
          label="Substring Patterns"
          value={value.substringPatterns}
          onChange={(next) => update("substringPatterns", next)}
          placeholder="Plain-text substrings"
        />
      </div>
    </div>
  );
}

function RetrievalRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: RetrievalRuleFormState;
  onChange: (next: RetrievalRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof RetrievalRuleFormState>(key: K, nextValue: RetrievalRuleFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-all`}
          label="All Signals"
          value={value.whenSignalsAll}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAll", next)}
          placeholder="Select required signals"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-any`}
          label="Any Signals"
          value={value.whenSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAny", next)}
          placeholder="Select optional signals"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-exclude`}
          label="Exclude Signals"
          value={value.excludeSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("excludeSignalsAny", next)}
          placeholder="Select excluded signals"
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-concept-patterns`}
          label="Concept Key Patterns"
          value={value.whenConceptKeyPatternsAny}
          onChange={(next) => update("whenConceptKeyPatternsAny", next)}
          placeholder="SCHOOL_YEAR, TERM"
          normalize={(entry) => entry.toUpperCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-prefer-tokens`}
          label="Prefer Name Tokens"
          value={value.domainNamePreferTokens}
          onChange={(next) => update("domainNamePreferTokens", next)}
          placeholder="provider, territory"
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-md-6">
        <TokenListField
          id={`${prefix}-avoid-tokens`}
          label="Avoid Name Tokens"
          value={value.domainNameAvoidTokens}
          onChange={(next) => update("domainNameAvoidTokens", next)}
          placeholder="student, discipline"
          normalize={(entry) => entry.toLowerCase()}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-positive-bias`}>Positive Bias</label>
        <input
          id={`${prefix}-positive-bias`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.domainNamePositiveBias}
          onChange={(event) => update("domainNamePositiveBias", event.target.value)}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${prefix}-negative-bias`}>Negative Bias</label>
        <input
          id={`${prefix}-negative-bias`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.domainNameNegativeBias}
          onChange={(event) => update("domainNameNegativeBias", event.target.value)}
        />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={`${prefix}-query-specs`}>Query Specs JSON</label>
        <textarea
          id={`${prefix}-query-specs`}
          className="form-control"
          rows={8}
          value={value.querySpecsJson}
          onChange={(event) => update("querySpecsJson", event.target.value)}
        />
        <div className="small text-muted">
          Array of objects like
          {" "}
          <code>[{"{"}"query":"provider territory","source":"vector","score_boost":0.1,"reasons":["semantic_query:provider"]{"}"}]</code>
        </div>
      </div>
    </div>
  );
}

function DomainSelectionRuleEditorFields({
  value,
  onChange,
  prefix,
}: {
  value: DomainSelectionRuleFormState;
  onChange: (next: DomainSelectionRuleFormState) => void;
  prefix: string;
}) {
  function update<K extends keyof DomainSelectionRuleFormState>(key: K, nextValue: DomainSelectionRuleFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-all`}
          label="All Signals"
          value={value.whenSignalsAll}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAll", next)}
          placeholder="Select required signals"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-signals-any`}
          label="Any Signals"
          value={value.whenSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("whenSignalsAny", next)}
          placeholder="Select optional signals"
        />
      </div>
      <div className="col-12">
        <MultiSelectField
          id={`${prefix}-signals-exclude`}
          label="Exclude Signals"
          value={value.excludeSignalsAny}
          options={SIGNAL_OPTIONS}
          onChange={(next) => update("excludeSignalsAny", next)}
          placeholder="Select excluded signals"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-shortlist-features`}
          label="Required Shortlist Features"
          value={value.requiredShortlistFeatures}
          options={DOMAIN_SELECTION_FEATURE_OPTIONS}
          onChange={(next) => update("requiredShortlistFeatures", next)}
          placeholder="Select shortlist features"
        />
      </div>
      <div className="col-md-6">
        <MultiSelectField
          id={`${prefix}-capability-features`}
          label="Required Capability Features"
          value={value.requiredCapabilityFeatures}
          options={DOMAIN_SELECTION_FEATURE_OPTIONS}
          onChange={(next) => update("requiredCapabilityFeatures", next)}
          placeholder="Select capability features"
        />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${prefix}-score-delta`}>Score Delta</label>
        <input
          id={`${prefix}-score-delta`}
          className="form-control"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value.scoreDelta}
          onChange={(event) => update("scoreDelta", event.target.value)}
        />
      </div>
    </div>
  );
}

function PlannerPolicyDrawer({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onClose} />
      <aside className="sa-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sa-drawer-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-sm btn-light" aria-label="Close planner policy drawer" onClick={onClose}>
            <i className="fa fa-times" />
          </button>
        </div>
        <div className="sa-drawer-body">{children}</div>
        <div className="sa-drawer-footer">{footer}</div>
      </aside>
    </>
  );
}

export default function PlannerPoliciesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [verticalNorm, setVerticalNorm] = useState(searchParams.get("vertical") || "education");
  const [includeInactive, setIncludeInactive] = useState(searchParams.get("inactive") === "1");
  const [candidateFilter, setCandidateFilter] = useState<PlannerPolicyCandidateReviewStatus | "">(
    (searchParams.get("candidate_status") as PlannerPolicyCandidateReviewStatus | "") || "pending",
  );
  const [activeTab, setActiveTab] = useState<PlannerPoliciesTab>(
    (searchParams.get("tab") as PlannerPoliciesTab) || "capabilities",
  );
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(
    Number(searchParams.get("domain_id") || "") || null,
  );

  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [capabilityForm, setCapabilityForm] = useState<CapabilityFormState>(defaultCapabilityForm());
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(defaultPolicyForm());
  const [projectionPolicyForm, setProjectionPolicyForm] = useState<ProjectionPolicyFormState>(defaultProjectionPolicyForm());
  const [signalPolicyForm, setSignalPolicyForm] = useState<SignalPolicyFormState>(defaultSignalPolicyForm());
  const [promptIntentPolicyForm, setPromptIntentPolicyForm] = useState<PromptIntentPolicyFormState>(defaultPromptIntentPolicyForm());
  const [retrievalPolicyForm, setRetrievalPolicyForm] = useState<RetrievalPolicyFormState>(defaultRetrievalPolicyForm());
  const [domainSelectionPolicyForm, setDomainSelectionPolicyForm] = useState<DomainSelectionPolicyFormState>(defaultDomainSelectionPolicyForm());
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(defaultCandidateForm());
  const [suggestForm, setSuggestForm] = useState<SuggestFormState>(defaultSuggestForm());

  const domainsQuery = useQuery({
    queryKey: ["admin", "domains", "planner-policies"],
    queryFn: fetchDomains,
    staleTime: 30_000,
  });
  const domains = useMemo(
    () => (domainsQuery.data?.rows ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [domainsQuery.data],
  );

  useEffect(() => {
    if (!selectedDomainId && domains.length > 0) {
      setSelectedDomainId(domains[0]?.id ?? null);
    }
  }, [domains, selectedDomainId]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedDomainId) next.set("domain_id", String(selectedDomainId));
    next.set("tab", activeTab);
    next.set("vertical", verticalNorm);
    if (candidateFilter) next.set("candidate_status", candidateFilter);
    if (includeInactive) next.set("inactive", "1");
    setSearchParams(next, { replace: true });
  }, [activeTab, candidateFilter, includeInactive, selectedDomainId, setSearchParams, verticalNorm]);

  const capabilitiesQuery = usePlannerDomainCapabilities(selectedDomainId, verticalNorm, includeInactive);
  const policiesQuery = usePlannerRerankPolicies(selectedDomainId, verticalNorm, includeInactive);
  const projectionPoliciesQuery = usePlannerProjectionPolicies(selectedDomainId, verticalNorm, includeInactive);
  const signalPoliciesQuery = usePlannerSignalPolicies(includeInactive);
  const promptIntentPoliciesQuery = usePlannerPromptIntentPolicies(includeInactive);
  const retrievalPoliciesQuery = usePlannerRetrievalPolicies(includeInactive);
  const domainSelectionPoliciesQuery = usePlannerDomainSelectionPolicies(includeInactive);
  const candidatesQuery = usePlannerRerankPolicyCandidates(candidateFilter, verticalNorm);

  const upsertCapability = useUpsertPlannerDomainCapability();
  const deleteCapability = useDeletePlannerDomainCapability();
  const upsertPolicy = useUpsertPlannerRerankPolicy();
  const deletePolicy = useDeletePlannerRerankPolicy();
  const upsertProjectionPolicy = useUpsertPlannerProjectionPolicy();
  const deleteProjectionPolicy = useDeletePlannerProjectionPolicy();
  const upsertSignalPolicy = useUpsertPlannerSignalPolicy();
  const deleteSignalPolicy = useDeletePlannerSignalPolicy();
  const upsertPromptIntentPolicy = useUpsertPlannerPromptIntentPolicy();
  const deletePromptIntentPolicy = useDeletePlannerPromptIntentPolicy();
  const upsertRetrievalPolicy = useUpsertPlannerRetrievalPolicy();
  const deleteRetrievalPolicy = useDeletePlannerRetrievalPolicy();
  const upsertDomainSelectionPolicy = useUpsertPlannerDomainSelectionPolicy();
  const deleteDomainSelectionPolicy = useDeletePlannerDomainSelectionPolicy();
  const saveCandidate = useCreatePlannerRerankPolicyCandidate();
  const deleteCandidate = useDeletePlannerRerankPolicyCandidate();
  const suggestCandidate = useSuggestPlannerRerankPolicyCandidate();
  const approveCandidate = useApprovePlannerRerankPolicyCandidate();

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? null,
    [domains, selectedDomainId],
  );

  const drawerBusy =
    upsertCapability.isPending ||
    upsertPolicy.isPending ||
    upsertProjectionPolicy.isPending ||
    upsertSignalPolicy.isPending ||
    upsertPromptIntentPolicy.isPending ||
    upsertRetrievalPolicy.isPending ||
    upsertDomainSelectionPolicy.isPending ||
    saveCandidate.isPending ||
    suggestCandidate.isPending ||
    approveCandidate.isPending;
  const deleteBusy =
    deleteCapability.isPending ||
    deletePolicy.isPending ||
    deleteProjectionPolicy.isPending ||
    deleteSignalPolicy.isPending ||
    deletePromptIntentPolicy.isPending ||
    deleteRetrievalPolicy.isPending ||
    deleteDomainSelectionPolicy.isPending ||
    deleteCandidate.isPending;

  function closeDrawer() {
    setDrawerState(null);
  }

  function openCreateCapability() {
    setActiveTab("capabilities");
    setCapabilityForm(defaultCapabilityForm());
    setDrawerState({ kind: "capabilities", mode: "create" });
  }

  function openEditCapability(row: PlannerDomainCapabilityRow) {
    setActiveTab("capabilities");
    setCapabilityForm({
      id: row.id,
      capabilityKey: row.capability_key,
      scopeType: row.scope_type,
      supportLevel: row.support_level,
      sourceType: row.source_type,
      sourceRef: row.source_ref ?? "",
      confidence: String(row.confidence ?? 1),
      notes: row.notes ?? "",
      isActive: row.is_active,
    });
    setDrawerState({ kind: "capabilities", mode: "edit" });
  }

  function openCreatePolicy() {
    setActiveTab("policies");
    setPolicyForm(defaultPolicyForm());
    setDrawerState({ kind: "policies", mode: "create" });
  }

  function openEditPolicy(row: PlannerRerankPolicyRow) {
    setActiveTab("policies");
    setPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: ruleToForm(row.policy_json),
    });
    setDrawerState({ kind: "policies", mode: "edit" });
  }

  function openCreateProjectionPolicy() {
    setActiveTab("projection");
    setProjectionPolicyForm(defaultProjectionPolicyForm());
    setDrawerState({ kind: "projection", mode: "create" });
  }

  function openCreateSignalPolicy() {
    setActiveTab("signal");
    setSignalPolicyForm(defaultSignalPolicyForm());
    setDrawerState({ kind: "signal", mode: "create" });
  }

  function openEditSignalPolicy(row: PlannerSignalPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("signal");
    setSignalPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: signalRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "signal", mode: "edit" });
  }

  function openCreatePromptIntentPolicy() {
    setActiveTab("prompt_intent");
    setPromptIntentPolicyForm(defaultPromptIntentPolicyForm());
    setDrawerState({ kind: "prompt_intent", mode: "create" });
  }

  function openEditPromptIntentPolicy(row: PlannerPromptIntentPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("prompt_intent");
    setPromptIntentPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: promptIntentRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "prompt_intent", mode: "edit" });
  }

  function openCreateRetrievalPolicy() {
    setActiveTab("retrieval");
    setRetrievalPolicyForm(defaultRetrievalPolicyForm());
    setDrawerState({ kind: "retrieval", mode: "create" });
  }

  function openEditRetrievalPolicy(row: PlannerRetrievalPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("retrieval");
    setRetrievalPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: retrievalRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "retrieval", mode: "edit" });
  }

  function openCreateDomainSelectionPolicy() {
    setActiveTab("domain_selection");
    setDomainSelectionPolicyForm(defaultDomainSelectionPolicyForm());
    setDrawerState({ kind: "domain_selection", mode: "create" });
  }

  function openEditDomainSelectionPolicy(row: PlannerDomainSelectionPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("domain_selection");
    setDomainSelectionPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: domainSelectionRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "domain_selection", mode: "edit" });
  }

  function openEditProjectionPolicy(row: PlannerProjectionPolicyRow) {
    if (row.can_edit === false) return;
    setActiveTab("projection");
    setProjectionPolicyForm({
      id: row.id,
      policyKey: row.policy_key,
      name: row.name,
      description: row.description ?? "",
      scopeType: row.scope_type,
      priority: String(row.priority ?? 100),
      isActive: row.is_active,
      stopOnMatch: row.stop_on_match,
      rule: projectionRuleToForm(row.policy_json),
    });
    setDrawerState({ kind: "projection", mode: "edit" });
  }

  function openCreateCandidate() {
    setActiveTab("candidates");
    setCandidateForm(defaultCandidateForm());
    setDrawerState({ kind: "candidates", mode: "create" });
  }

  function openSuggestCandidate() {
    setActiveTab("candidates");
    setSuggestForm(defaultSuggestForm());
    setDrawerState({ kind: "candidate_suggest", mode: "create" });
  }

  function openEditCandidate(row: PlannerRerankPolicyCandidateRow) {
    setActiveTab("candidates");
    setCandidateForm({
      id: row.id,
      candidateKey: row.candidate_key,
      sourceType: row.source_type,
      confidence: String(row.confidence ?? 0.8),
      rationaleJson: row.rationale_json ? JSON.stringify(row.rationale_json, null, 2) : "",
      rule: ruleToForm(row.candidate_json),
    });
    setDrawerState({ kind: "candidates", mode: "edit" });
  }

  async function handleSaveCapability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    const payload: PlannerDomainCapabilityUpsertRequest = {
      id: capabilityForm.id,
      scope_type: capabilityForm.scopeType,
      scope_vertical_norm: capabilityForm.scopeType.includes("vertical")
        ? verticalNorm.trim() || null
        : null,
      base_domain_id: selectedDomainId,
      capability_key: capabilityForm.capabilityKey,
      support_level: capabilityForm.supportLevel,
      source_type: capabilityForm.sourceType,
      source_ref: capabilityForm.sourceRef.trim() || null,
      confidence: clampUnit(Number(capabilityForm.confidence), 1),
      notes: capabilityForm.notes.trim() || null,
      is_active: capabilityForm.isActive,
    };
    try {
      await upsertCapability.mutateAsync(payload);
      toast.success(capabilityForm.id ? "Capability updated." : "Capability created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save capability.");
    }
  }

  async function handleSavePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    const payload: PlannerRerankPolicyUpsertRequest = {
      id: policyForm.id,
      policy_key: policyForm.policyKey.trim(),
      name: policyForm.name.trim(),
      description: policyForm.description.trim() || null,
      scope_type: policyForm.scopeType,
      scope_vertical_norm: policyForm.scopeType.includes("vertical")
        ? verticalNorm.trim() || null
        : null,
      scope_base_domain_id: policyForm.scopeType.includes("domain") ? selectedDomainId : null,
      priority: Number(policyForm.priority) || 100,
      is_active: policyForm.isActive,
      stop_on_match: policyForm.stopOnMatch,
      policy_json: formToRule(policyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertPolicy.mutateAsync(payload);
      toast.success(policyForm.id ? "Policy updated." : "Policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save policy.");
    }
  }

  async function handleSaveProjectionPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    const payload: PlannerProjectionPolicyUpsertRequest = {
      id: projectionPolicyForm.id,
      policy_key: projectionPolicyForm.policyKey.trim(),
      name: projectionPolicyForm.name.trim(),
      description: projectionPolicyForm.description.trim() || null,
      scope_type: projectionPolicyForm.scopeType,
      scope_vertical_norm: projectionPolicyForm.scopeType.includes("vertical")
        ? verticalNorm.trim() || null
        : null,
      scope_base_domain_id: projectionPolicyForm.scopeType.includes("domain") ? selectedDomainId : null,
      priority: Number(projectionPolicyForm.priority) || 100,
      is_active: projectionPolicyForm.isActive,
      stop_on_match: projectionPolicyForm.stopOnMatch,
      policy_json: formToProjectionRule(projectionPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertProjectionPolicy.mutateAsync(payload);
      toast.success(projectionPolicyForm.id ? "Projection policy updated." : "Projection policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save projection policy.");
    }
  }

  async function handleSaveSignalPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: PlannerSignalPolicyUpsertRequest = {
      id: signalPolicyForm.id,
      policy_key: signalPolicyForm.policyKey.trim(),
      name: signalPolicyForm.name.trim(),
      description: signalPolicyForm.description.trim() || null,
      scope_type: signalPolicyForm.scopeType,
      priority: Number(signalPolicyForm.priority) || 100,
      is_active: signalPolicyForm.isActive,
      stop_on_match: signalPolicyForm.stopOnMatch,
      policy_json: formToSignalRule(signalPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertSignalPolicy.mutateAsync(payload);
      toast.success(signalPolicyForm.id ? "Signal policy updated." : "Signal policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save signal policy.");
    }
  }

  async function handleSavePromptIntentPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: PlannerPromptIntentPolicyUpsertRequest = {
      id: promptIntentPolicyForm.id,
      policy_key: promptIntentPolicyForm.policyKey.trim(),
      name: promptIntentPolicyForm.name.trim(),
      description: promptIntentPolicyForm.description.trim() || null,
      scope_type: promptIntentPolicyForm.scopeType,
      priority: Number(promptIntentPolicyForm.priority) || 100,
      is_active: promptIntentPolicyForm.isActive,
      stop_on_match: promptIntentPolicyForm.stopOnMatch,
      policy_json: formToPromptIntentRule(promptIntentPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertPromptIntentPolicy.mutateAsync(payload);
      toast.success(promptIntentPolicyForm.id ? "Prompt intent policy updated." : "Prompt intent policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save prompt intent policy.");
    }
  }

  async function handleSaveRetrievalPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: PlannerRetrievalPolicyUpsertRequest = {
      id: retrievalPolicyForm.id,
      policy_key: retrievalPolicyForm.policyKey.trim(),
      name: retrievalPolicyForm.name.trim(),
      description: retrievalPolicyForm.description.trim() || null,
      scope_type: retrievalPolicyForm.scopeType,
      priority: Number(retrievalPolicyForm.priority) || 100,
      is_active: retrievalPolicyForm.isActive,
      stop_on_match: retrievalPolicyForm.stopOnMatch,
      policy_json: formToRetrievalRule(retrievalPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertRetrievalPolicy.mutateAsync(payload);
      toast.success(retrievalPolicyForm.id ? "Retrieval policy updated." : "Retrieval policy created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save retrieval policy.");
    }
  }

  async function handleSaveDomainSelectionPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: PlannerDomainSelectionPolicyUpsertRequest = {
      id: domainSelectionPolicyForm.id,
      policy_key: domainSelectionPolicyForm.policyKey.trim(),
      name: domainSelectionPolicyForm.name.trim(),
      description: domainSelectionPolicyForm.description.trim() || null,
      scope_type: domainSelectionPolicyForm.scopeType,
      priority: Number(domainSelectionPolicyForm.priority) || 100,
      is_active: domainSelectionPolicyForm.isActive,
      stop_on_match: domainSelectionPolicyForm.stopOnMatch,
      policy_json: formToDomainSelectionRule(domainSelectionPolicyForm.rule),
    };
    if (!payload.policy_key || !payload.name) {
      toast.error("Policy key and name are required.");
      return;
    }
    try {
      await upsertDomainSelectionPolicy.mutateAsync(payload);
      toast.success(
        domainSelectionPolicyForm.id ? "Domain selection policy updated." : "Domain selection policy created.",
      );
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save domain selection policy.");
    }
  }

  async function handleSaveCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidateKey = candidateForm.candidateKey.trim();
    if (!candidateKey) {
      toast.error("Candidate key is required.");
      return;
    }
    let rationaleJson: Record<string, unknown> | null = null;
    if (candidateForm.rationaleJson.trim()) {
      try {
        const parsed = JSON.parse(candidateForm.rationaleJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Rationale JSON must be an object.");
        }
        rationaleJson = parsed as Record<string, unknown>;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Invalid rationale JSON.");
        return;
      }
    }
    const payload: PlannerRerankPolicyCandidateCreateRequest = {
      id: candidateForm.id,
      candidate_key: candidateKey,
      source_type: candidateForm.sourceType,
      vertical_norm: verticalNorm.trim() || null,
      candidate_policy: formToRule(candidateForm.rule),
      rationale_json: rationaleJson,
      confidence: clampUnit(Number(candidateForm.confidence), 0.8),
    };
    try {
      await saveCandidate.mutateAsync(payload);
      toast.success(candidateForm.id ? "Candidate updated." : "Candidate created.");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save candidate.");
    }
  }

  async function handleSuggestCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    const prompt = suggestForm.prompt.trim();
    if (!prompt) {
      toast.error("Example prompt is required.");
      return;
    }
    const payload: PlannerRerankPolicyCandidateSuggestRequest = {
      prompt,
      vertical_norm: verticalNorm.trim() || null,
      expected_base_domain_id: selectedDomainId,
      observed_base_domain_id: Number(suggestForm.observedDomainId) || null,
      candidate_key: suggestForm.candidateKey.trim() || null,
      notes: suggestForm.notes.trim() || null,
    };
    try {
      const response = await suggestCandidate.mutateAsync(payload);
      toast.success(`AI candidate created: ${response.candidate.candidate_key}`);
      setCandidateFilter("pending");
      closeDrawer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to suggest candidate.");
    }
  }

  async function handleApproveCandidate(row: PlannerRerankPolicyCandidateRow) {
    if (!selectedDomainId) {
      toast.error("Select a domain first.");
      return;
    }
    try {
      await approveCandidate.mutateAsync({
        candidateId: row.id,
        payload: {
          name: humanizeKey(row.candidate_key),
          policy_key: row.candidate_key,
          scope_type: "workspace_domain",
          scope_base_domain_id: selectedDomainId,
          scope_vertical_norm: verticalNorm.trim() || null,
        },
      });
      toast.success("Candidate approved into planner policy.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve candidate.");
    }
  }

  async function handleDeleteCapability(row: PlannerDomainCapabilityRow) {
    if (!row.id) return;
    setDeleteDialog({ kind: "capability", id: row.id, label: row.capability_key });
  }

  async function handleDeletePolicy(row: PlannerRerankPolicyRow) {
    if (!row.id) return;
    setDeleteDialog({ kind: "policy", id: row.id, label: row.name });
  }

  async function handleDeleteProjectionPolicy(row: PlannerProjectionPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "projection_policy", id: row.id, label: row.name });
  }

  async function handleDeleteSignalPolicy(row: PlannerSignalPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "signal_policy", id: row.id, label: row.name });
  }

  async function handleDeletePromptIntentPolicy(row: PlannerPromptIntentPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "prompt_intent_policy", id: row.id, label: row.name });
  }

  async function handleDeleteRetrievalPolicy(row: PlannerRetrievalPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "retrieval_policy", id: row.id, label: row.name });
  }

  async function handleDeleteDomainSelectionPolicy(row: PlannerDomainSelectionPolicyRow) {
    if (!row.id || row.can_delete === false) return;
    setDeleteDialog({ kind: "domain_selection_policy", id: row.id, label: row.name });
  }

  async function handleDeleteCandidate(row: PlannerRerankPolicyCandidateRow) {
    setDeleteDialog({ kind: "candidate", id: row.id, label: row.candidate_key });
  }

  async function handleConfirmDelete() {
    if (!deleteDialog) return;
    try {
      if (deleteDialog.kind === "capability") {
        await deleteCapability.mutateAsync(deleteDialog.id);
        toast.success("Capability deleted.");
      } else if (deleteDialog.kind === "policy") {
        await deletePolicy.mutateAsync(deleteDialog.id);
        toast.success("Policy deleted.");
      } else if (deleteDialog.kind === "projection_policy") {
        await deleteProjectionPolicy.mutateAsync(deleteDialog.id);
        toast.success("Projection policy deleted.");
      } else if (deleteDialog.kind === "signal_policy") {
        await deleteSignalPolicy.mutateAsync(deleteDialog.id);
        toast.success("Signal policy deleted.");
      } else if (deleteDialog.kind === "prompt_intent_policy") {
        await deletePromptIntentPolicy.mutateAsync(deleteDialog.id);
        toast.success("Prompt intent policy deleted.");
      } else if (deleteDialog.kind === "retrieval_policy") {
        await deleteRetrievalPolicy.mutateAsync(deleteDialog.id);
        toast.success("Retrieval policy deleted.");
      } else if (deleteDialog.kind === "domain_selection_policy") {
        await deleteDomainSelectionPolicy.mutateAsync(deleteDialog.id);
        toast.success("Domain selection policy deleted.");
      } else {
        await deleteCandidate.mutateAsync(deleteDialog.id);
        toast.success("Candidate deleted.");
      }
      setDeleteDialog(null);
    } catch (error) {
      const fallback =
        deleteDialog.kind === "capability"
          ? "Unable to delete capability."
          : deleteDialog.kind === "policy"
            ? "Unable to delete policy."
            : deleteDialog.kind === "projection_policy"
              ? "Unable to delete projection policy."
              : deleteDialog.kind === "signal_policy"
                ? "Unable to delete signal policy."
                : deleteDialog.kind === "prompt_intent_policy"
                  ? "Unable to delete prompt intent policy."
                  : deleteDialog.kind === "retrieval_policy"
                    ? "Unable to delete retrieval policy."
                    : deleteDialog.kind === "domain_selection_policy"
                      ? "Unable to delete domain selection policy."
            : "Unable to delete candidate.";
      toast.error(error instanceof Error ? error.message : fallback);
    }
  }

  const activeCount =
    activeTab === "capabilities"
      ? capabilitiesQuery.data?.capabilities.length ?? 0
      : activeTab === "policies"
        ? policiesQuery.data?.policies.length ?? 0
        : activeTab === "projection"
          ? projectionPoliciesQuery.data?.policies.length ?? 0
          : activeTab === "signal"
            ? signalPoliciesQuery.data?.policies.length ?? 0
            : activeTab === "prompt_intent"
              ? promptIntentPoliciesQuery.data?.policies.length ?? 0
              : activeTab === "retrieval"
                ? retrievalPoliciesQuery.data?.policies.length ?? 0
                : activeTab === "domain_selection"
                  ? domainSelectionPoliciesQuery.data?.policies.length ?? 0
        : candidatesQuery.data?.candidates.length ?? 0;

  const drawerTitle =
    drawerState?.kind === "capabilities"
      ? drawerState.mode === "create"
        ? "Add Capability"
        : "Edit Capability"
      : drawerState?.kind === "policies"
        ? drawerState.mode === "create"
          ? "Add Policy"
          : "Edit Policy"
        : drawerState?.kind === "projection"
        ? drawerState.mode === "create"
          ? "Add Projection Policy"
          : "Edit Projection Policy"
        : drawerState?.kind === "signal"
          ? drawerState.mode === "create"
            ? "Add Signal Policy"
            : "Edit Signal Policy"
        : drawerState?.kind === "prompt_intent"
          ? drawerState.mode === "create"
            ? "Add Prompt Intent Policy"
            : "Edit Prompt Intent Policy"
        : drawerState?.kind === "retrieval"
          ? drawerState.mode === "create"
            ? "Add Retrieval Policy"
            : "Edit Retrieval Policy"
        : drawerState?.kind === "domain_selection"
          ? drawerState.mode === "create"
            ? "Add Domain Selection Policy"
            : "Edit Domain Selection Policy"
        : drawerState?.kind === "candidates"
          ? drawerState.mode === "create"
            ? "Add Candidate"
            : "Edit Candidate"
          : drawerState?.kind === "candidate_suggest"
            ? "Suggest Candidate With AI"
          : "";

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <div>
          <h1>Planner Policies</h1>
          <p className="sa-page-subtitle">
            Tune planner-domain reranking and deterministic projection behavior with semantic capabilities, scoped policies, and candidate review.
          </p>
        </div>
      </header>

      <section className="sa-card mb-3">
        <div className="row g-3 align-items-end">
          <div className="col-lg-4">
            <label className="form-label" htmlFor="planner-policies-domain">Domain</label>
            <select
              id="planner-policies-domain"
              className="form-select"
              value={selectedDomainId ?? ""}
              onChange={(event) => setSelectedDomainId(Number(event.target.value) || null)}
            >
              <option value="">Select a domain</option>
              {domains.map((domain: Domain) => (
                <option value={domain.id} key={domain.id}>
                  {domain.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-3">
            <label className="form-label" htmlFor="planner-policies-vertical">Vertical Norm</label>
            <input
              id="planner-policies-vertical"
              className="form-control"
              value={verticalNorm}
              onChange={(event) => setVerticalNorm(event.target.value)}
              placeholder="education"
            />
          </div>
          <div className="col-lg-3">
            <label className="form-label" htmlFor="planner-policies-candidate-filter">Candidate Status</label>
            <select
              id="planner-policies-candidate-filter"
              className="form-select"
              value={candidateFilter}
              onChange={(event) => setCandidateFilter(event.target.value as PlannerPolicyCandidateReviewStatus | "")}
            >
              {CANDIDATE_REVIEW_FILTERS.map((value) => (
                <option value={value} key={value || "all"}>
                  {value ? humanizeKey(value) : "All"}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-2">
            <div className="form-check mt-4 pt-2">
              <input
                id="planner-policies-include-inactive"
                className="form-check-input"
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              <label className="form-check-label" htmlFor="planner-policies-include-inactive">
                Include inactive
              </label>
            </div>
          </div>
        </div>
        {selectedDomain ? (
          <div className="small text-muted mt-3">
            Selected domain: <strong>{selectedDomain.name}</strong>
          </div>
        ) : null}
      </section>

      <section className="sa-card mb-3">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <ul className="nav nav-tabs" role="tablist" aria-label="Planner policy tabs">
            {TABS.map((tab) => {
              const active = tab.key === activeTab;
              const count =
                tab.key === "capabilities"
                  ? capabilitiesQuery.data?.capabilities.length ?? 0
                  : tab.key === "policies"
                    ? policiesQuery.data?.policies.length ?? 0
                    : tab.key === "projection"
                      ? projectionPoliciesQuery.data?.policies.length ?? 0
                      : tab.key === "signal"
                        ? signalPoliciesQuery.data?.policies.length ?? 0
                        : tab.key === "prompt_intent"
                          ? promptIntentPoliciesQuery.data?.policies.length ?? 0
                          : tab.key === "retrieval"
                            ? retrievalPoliciesQuery.data?.policies.length ?? 0
                            : tab.key === "domain_selection"
                              ? domainSelectionPoliciesQuery.data?.policies.length ?? 0
                    : candidatesQuery.data?.candidates.length ?? 0;
              return (
                <li className="nav-item" role="presentation" key={tab.key}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`nav-link ${active ? "active" : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label} ({count})
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreateCapability}>
              Add New Capability
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreatePolicy}>
              Add New Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreateProjectionPolicy}>
              Add New Projection Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreateSignalPolicy}>
              Add New Signal Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreatePromptIntentPolicy}>
              Add New Prompt Intent Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreateRetrievalPolicy}>
              Add New Retrieval Policy
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openCreateDomainSelectionPolicy}>
              Add New Domain Selection Policy
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={openCreateCandidate}>
              Add New Candidate
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={openSuggestCandidate}>
              Suggest With AI
            </button>
          </div>
        </div>

        <div className="small text-muted mb-3">
          {activeCount} {TAB_COUNT_LABEL[activeTab]}{activeCount === 1 ? "" : "s"} shown
        </div>

        {activeTab === "capabilities" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Scope</th>
                  <th>Support</th>
                  <th>Source</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {capabilitiesQuery.isLoading ? (
                  <tr><td colSpan={7} className="text-muted">Loading capabilities...</td></tr>
                ) : (capabilitiesQuery.data?.capabilities.length ?? 0) === 0 ? (
                  <tr><td colSpan={7} className="text-muted">No capabilities configured for this scope.</td></tr>
                ) : (
                  capabilitiesQuery.data?.capabilities.map((row) => (
                    <tr key={`${row.id ?? row.capability_key}-${row.source_ref ?? "row"}`} className="sa-row-clickable" onClick={() => openEditCapability(row)}>
                      <td>
                        <div className="fw-semibold">{row.capability_key}</div>
                        {row.notes ? <div className="small text-muted">{row.notes}</div> : null}
                      </td>
                      <td>{row.scope_type}</td>
                      <td>{row.support_level}</td>
                      <td>
                        {row.source_type}
                        {row.source_ref ? <div className="small text-muted">{row.source_ref}</div> : null}
                      </td>
                      <td>{row.confidence.toFixed(2)}</td>
                      <td>
                        <span className={statusBadgeClass(row.is_active)}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                        {row.is_inherited ? <div className="small text-muted">Inherited</div> : null}
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete capability ${row.capability_key}`} onClick={() => void handleDeleteCapability(row)}>
                            <i className="fa fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "policies" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Priority</th>
                  <th>Rule Summary</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {policiesQuery.isLoading ? (
                  <tr><td colSpan={6} className="text-muted">Loading policies...</td></tr>
                ) : (policiesQuery.data?.policies.length ?? 0) === 0 ? (
                  <tr><td colSpan={6} className="text-muted">No rerank policies configured for this scope.</td></tr>
                ) : (
                  policiesQuery.data?.policies.map((row) => (
                    <tr key={row.id ?? row.policy_key} className="sa-row-clickable" onClick={() => openEditPolicy(row)}>
                      <td>
                        <div className="fw-semibold">{row.name}</div>
                        <div className="small text-muted">{row.policy_key}</div>
                      </td>
                      <td>{row.scope_type}</td>
                      <td>{row.priority}</td>
                      <td>
                        <div className="small">
                          Signals: {row.policy_json.when_signals_all.concat(row.policy_json.when_signals_any).join(", ") || "None"}
                        </div>
                        <div className="small text-muted">
                          Prefer: {row.policy_json.prefer_capabilities.join(", ") || "None"}
                        </div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(row.is_active)}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                        {row.is_inherited ? <div className="small text-muted">Inherited</div> : null}
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete policy ${row.name}`} onClick={() => void handleDeletePolicy(row)}>
                            <i className="fa fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "projection" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Priority</th>
                  <th>Rule Summary</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projectionPoliciesQuery.isLoading ? (
                  <tr><td colSpan={6} className="text-muted">Loading projection policies...</td></tr>
                ) : (projectionPoliciesQuery.data?.policies.length ?? 0) === 0 ? (
                  <tr><td colSpan={6} className="text-muted">No projection policies configured for this scope.</td></tr>
                ) : (
                  projectionPoliciesQuery.data?.policies.map((row) => (
                    <tr
                      key={`${row.id ?? 0}-${row.policy_key}`}
                      className={row.can_edit === false ? "" : "sa-row-clickable"}
                      onClick={() => openEditProjectionPolicy(row)}
                    >
                      <td>
                        <div className="fw-semibold">{row.name}</div>
                        <div className="small text-muted">{row.policy_key}</div>
                      </td>
                      <td>{row.scope_type}</td>
                      <td>{row.priority}</td>
                      <td>
                        <div className="small">
                          Signals: {row.policy_json.when_signals_all.concat(row.policy_json.when_signals_any).join(", ") || "None"}
                        </div>
                        <div className="small text-muted">
                          Require: {row.policy_json.required_concept_keys.join(", ") || row.policy_json.required_column_names.join(", ") || "None"}
                        </div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(row.is_active)}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                        {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                        {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          {row.can_edit === false ? (
                            <span className="small text-muted">Read only</span>
                          ) : null}
                          {row.can_delete ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              aria-label={`Delete projection policy ${row.name}`}
                              onClick={() => void handleDeleteProjectionPolicy(row)}
                            >
                              <i className="fa fa-trash" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "signal" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Priority</th>
                  <th>Rule Summary</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {signalPoliciesQuery.isLoading ? (
                  <tr><td colSpan={6} className="text-muted">Loading signal policies...</td></tr>
                ) : (signalPoliciesQuery.data?.policies.length ?? 0) === 0 ? (
                  <tr><td colSpan={6} className="text-muted">No signal policies configured for this scope.</td></tr>
                ) : (
                  signalPoliciesQuery.data?.policies.map((row) => (
                    <tr
                      key={`${row.id ?? 0}-${row.policy_key}`}
                      className={row.can_edit === false ? "" : "sa-row-clickable"}
                      onClick={() => openEditSignalPolicy(row)}
                    >
                      <td>
                        <div className="fw-semibold">{row.name}</div>
                        <div className="small text-muted">{row.policy_key}</div>
                      </td>
                      <td>{row.scope_type}</td>
                      <td>{row.priority}</td>
                      <td>
                        <div className="small">Signals: {row.policy_json.signal_keys.join(", ") || "None"}</div>
                        <div className="small text-muted">
                          Match: {row.policy_json.match_type}
                          {row.policy_json.helper_name ? ` · ${row.policy_json.helper_name}` : ""}
                        </div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(row.is_active)}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                        {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                        {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          {row.can_edit === false ? <span className="small text-muted">Read only</span> : null}
                          {row.can_delete ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              aria-label={`Delete signal policy ${row.name}`}
                              onClick={() => void handleDeleteSignalPolicy(row)}
                            >
                              <i className="fa fa-trash" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "prompt_intent" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Priority</th>
                  <th>Rule Summary</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promptIntentPoliciesQuery.isLoading ? (
                  <tr><td colSpan={6} className="text-muted">Loading prompt intent policies...</td></tr>
                ) : (promptIntentPoliciesQuery.data?.policies.length ?? 0) === 0 ? (
                  <tr><td colSpan={6} className="text-muted">No prompt intent policies configured for this scope.</td></tr>
                ) : (
                  promptIntentPoliciesQuery.data?.policies.map((row) => (
                    <tr
                      key={`${row.id ?? 0}-${row.policy_key}`}
                      className={row.can_edit === false ? "" : "sa-row-clickable"}
                      onClick={() => openEditPromptIntentPolicy(row)}
                    >
                      <td>
                        <div className="fw-semibold">{row.name}</div>
                        <div className="small text-muted">{row.policy_key}</div>
                      </td>
                      <td>{row.scope_type}</td>
                      <td>{row.priority}</td>
                      <td>
                        <div className="small">Action: {row.policy_json.action_key}</div>
                        <div className="small text-muted">
                          Regex: {row.policy_json.regex_patterns.length} · Substrings: {row.policy_json.substring_patterns.length}
                        </div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(row.is_active)}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                        {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                        {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          {row.can_edit === false ? <span className="small text-muted">Read only</span> : null}
                          {row.can_delete ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              aria-label={`Delete prompt intent policy ${row.name}`}
                              onClick={() => void handleDeletePromptIntentPolicy(row)}
                            >
                              <i className="fa fa-trash" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "retrieval" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Priority</th>
                  <th>Rule Summary</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {retrievalPoliciesQuery.isLoading ? (
                  <tr><td colSpan={6} className="text-muted">Loading retrieval policies...</td></tr>
                ) : (retrievalPoliciesQuery.data?.policies.length ?? 0) === 0 ? (
                  <tr><td colSpan={6} className="text-muted">No retrieval policies configured for this scope.</td></tr>
                ) : (
                  retrievalPoliciesQuery.data?.policies.map((row) => (
                    <tr
                      key={`${row.id ?? 0}-${row.policy_key}`}
                      className={row.can_edit === false ? "" : "sa-row-clickable"}
                      onClick={() => openEditRetrievalPolicy(row)}
                    >
                      <td>
                        <div className="fw-semibold">{row.name}</div>
                        <div className="small text-muted">{row.policy_key}</div>
                      </td>
                      <td>{row.scope_type}</td>
                      <td>{row.priority}</td>
                      <td>
                        <div className="small">
                          Signals: {row.policy_json.when_signals_all.concat(row.policy_json.when_signals_any).join(", ") || "None"}
                        </div>
                        <div className="small text-muted">
                          Queries: {row.policy_json.query_specs.length} · Prefer tokens: {row.policy_json.domain_name_prefer_tokens.length}
                        </div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(row.is_active)}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                        {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                        {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          {row.can_edit === false ? <span className="small text-muted">Read only</span> : null}
                          {row.can_delete ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              aria-label={`Delete retrieval policy ${row.name}`}
                              onClick={() => void handleDeleteRetrievalPolicy(row)}
                            >
                              <i className="fa fa-trash" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "domain_selection" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Priority</th>
                  <th>Rule Summary</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domainSelectionPoliciesQuery.isLoading ? (
                  <tr><td colSpan={6} className="text-muted">Loading domain selection policies...</td></tr>
                ) : (domainSelectionPoliciesQuery.data?.policies.length ?? 0) === 0 ? (
                  <tr><td colSpan={6} className="text-muted">No domain selection policies configured for this scope.</td></tr>
                ) : (
                  domainSelectionPoliciesQuery.data?.policies.map((row) => (
                    <tr
                      key={`${row.id ?? 0}-${row.policy_key}`}
                      className={row.can_edit === false ? "" : "sa-row-clickable"}
                      onClick={() => openEditDomainSelectionPolicy(row)}
                    >
                      <td>
                        <div className="fw-semibold">{row.name}</div>
                        <div className="small text-muted">{row.policy_key}</div>
                      </td>
                      <td>{row.scope_type}</td>
                      <td>{row.priority}</td>
                      <td>
                        <div className="small">
                          Signals: {row.policy_json.when_signals_all.concat(row.policy_json.when_signals_any).join(", ") || "None"}
                        </div>
                        <div className="small text-muted">
                          Features: {row.policy_json.required_shortlist_features.concat(row.policy_json.required_capability_features).join(", ") || "None"}
                        </div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(row.is_active)}>
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                        {row.is_seeded ? <div className="small text-muted">Seeded</div> : null}
                        {row.is_effective ? <div className="small text-muted">Effective</div> : null}
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          {row.can_edit === false ? <span className="small text-muted">Read only</span> : null}
                          {row.can_delete ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              aria-label={`Delete domain selection policy ${row.name}`}
                              onClick={() => void handleDeleteDomainSelectionPolicy(row)}
                            >
                              <i className="fa fa-trash" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "candidates" && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Source</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidatesQuery.isLoading ? (
                  <tr><td colSpan={5} className="text-muted">Loading candidates...</td></tr>
                ) : (candidatesQuery.data?.candidates.length ?? 0) === 0 ? (
                  <tr><td colSpan={5} className="text-muted">No planner rerank policy candidates found.</td></tr>
                ) : (
                  candidatesQuery.data?.candidates.map((row) => (
                    <tr key={row.id} className="sa-row-clickable" onClick={() => openEditCandidate(row)}>
                      <td>
                        <div className="fw-semibold">{row.candidate_key}</div>
                        <div className="small text-muted">
                          Signals: {row.candidate_json.when_signals_all.concat(row.candidate_json.when_signals_any).join(", ") || "None"}
                        </div>
                      </td>
                      <td>{row.source_type}</td>
                      <td>{row.confidence == null ? "—" : row.confidence.toFixed(2)}</td>
                      <td>
                        <span className={candidateStatusBadgeClass(row.review_status)}>
                          {humanizeKey(row.review_status)}
                        </span>
                      </td>
                      <td className="text-end" onClick={(event) => event.stopPropagation()}>
                        <div className="sa-row-actions">
                          {row.review_status === "pending" ? (
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void handleApproveCandidate(row)}>
                              Approve
                            </button>
                          ) : null}
                          <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete candidate ${row.candidate_key}`} onClick={() => void handleDeleteCandidate(row)}>
                            <i className="fa fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {drawerState ? (
        <PlannerPolicyDrawer
          title={drawerTitle}
          onClose={closeDrawer}
          footer={
            <>
              <button type="button" className="btn btn-sm btn-light" onClick={closeDrawer}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                form={
                  drawerState.kind === "candidate_suggest"
                    ? "planner-policies-candidate-suggest-form"
                    : drawerState.kind === "projection"
                      ? "planner-policies-projection-form"
                    : drawerState.kind === "signal"
                      ? "planner-policies-signal-form"
                    : drawerState.kind === "prompt_intent"
                      ? "planner-policies-prompt-intent-form"
                    : drawerState.kind === "retrieval"
                      ? "planner-policies-retrieval-form"
                    : drawerState.kind === "domain_selection"
                      ? "planner-policies-domain-selection-form"
                    : `planner-policies-${drawerState.kind}-form`
                }
                disabled={
                  drawerBusy ||
                  (((drawerState.kind === "candidate_suggest" ||
                    drawerState.kind === "capabilities" ||
                    drawerState.kind === "policies" ||
                    drawerState.kind === "projection") && !selectedDomainId))
                }
              >
                {drawerBusy
                  ? drawerState.kind === "candidate_suggest"
                    ? "Generating..."
                    : "Saving..."
                  : drawerState.kind === "candidate_suggest"
                    ? "Generate"
                    : drawerState.mode === "create"
                      ? "Create"
                      : "Save"}
              </button>
            </>
          }
        >
          {drawerState.kind === "capabilities" ? (
            <form id="planner-policies-capabilities-form" onSubmit={handleSaveCapability}>
              <div className="sa-drawer-form-card">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="capability-key">Capability</label>
                    <select
                      id="capability-key"
                      className="form-select"
                      value={capabilityForm.capabilityKey}
                      onChange={(event) =>
                        setCapabilityForm((prev) => ({ ...prev, capabilityKey: event.target.value as PlannerPolicyCapabilityKey }))
                      }
                    >
                      {CAPABILITY_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="capability-scope">Scope</label>
                    <select
                      id="capability-scope"
                      className="form-select"
                      value={capabilityForm.scopeType}
                      onChange={(event) =>
                        setCapabilityForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))
                      }
                    >
                      {SCOPE_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="capability-support">Support Level</label>
                    <select
                      id="capability-support"
                      className="form-select"
                      value={capabilityForm.supportLevel}
                      onChange={(event) =>
                        setCapabilityForm((prev) => ({ ...prev, supportLevel: event.target.value as PlannerPolicySupportLevel }))
                      }
                    >
                      {SUPPORT_LEVEL_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="capability-source-type">Source Type</label>
                    <select
                      id="capability-source-type"
                      className="form-select"
                      value={capabilityForm.sourceType}
                      onChange={(event) =>
                        setCapabilityForm((prev) => ({ ...prev, sourceType: event.target.value as PlannerPolicySourceType }))
                      }
                    >
                      {SOURCE_TYPE_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="capability-source-ref">Source Ref</label>
                    <input
                      id="capability-source-ref"
                      className="form-control"
                      value={capabilityForm.sourceRef}
                      onChange={(event) => setCapabilityForm((prev) => ({ ...prev, sourceRef: event.target.value }))}
                      placeholder="semantic concept or source column"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="capability-confidence">Confidence</label>
                    <input
                      id="capability-confidence"
                      className="form-control"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={capabilityForm.confidence}
                      onChange={(event) => setCapabilityForm((prev) => ({ ...prev, confidence: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="form-check mb-2">
                      <input
                        id="capability-active"
                        className="form-check-input"
                        type="checkbox"
                        checked={capabilityForm.isActive}
                        onChange={(event) => setCapabilityForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="capability-active">Active</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="capability-notes">Notes</label>
                    <textarea
                      id="capability-notes"
                      className="form-control"
                      rows={4}
                      value={capabilityForm.notes}
                      onChange={(event) => setCapabilityForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : null}

          {drawerState.kind === "policies" ? (
            <form id="planner-policies-policies-form" onSubmit={handleSavePolicy}>
              <div className="sa-drawer-form-card">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="policy-name">Name</label>
                    <input
                      id="policy-name"
                      className="form-control"
                      value={policyForm.name}
                      onChange={(event) => setPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="policy-key">Policy Key</label>
                    <input
                      id="policy-key"
                      className="form-control"
                      value={policyForm.policyKey}
                      onChange={(event) => setPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="policy-scope">Scope</label>
                    <select
                      id="policy-scope"
                      className="form-select"
                      value={policyForm.scopeType}
                      onChange={(event) => setPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))}
                    >
                      {SCOPE_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="policy-priority">Priority</label>
                    <input
                      id="policy-priority"
                      className="form-control"
                      type="number"
                      value={policyForm.priority}
                      onChange={(event) => setPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="form-check mb-2 me-3">
                      <input
                        id="policy-active"
                        className="form-check-input"
                        type="checkbox"
                        checked={policyForm.isActive}
                        onChange={(event) => setPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="policy-active">Active</label>
                    </div>
                    <div className="form-check mb-2">
                      <input
                        id="policy-stop-on-match"
                        className="form-check-input"
                        type="checkbox"
                        checked={policyForm.stopOnMatch}
                        onChange={(event) => setPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="policy-stop-on-match">Stop On Match</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="policy-description">Description</label>
                    <textarea
                      id="policy-description"
                      className="form-control"
                      rows={3}
                      value={policyForm.description}
                      onChange={(event) => setPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </div>
                </div>
                <RuleEditorFields
                  prefix="policy"
                  value={policyForm.rule}
                  onChange={(next) => setPolicyForm((prev) => ({ ...prev, rule: next }))}
                />
              </div>
            </form>
          ) : null}

          {drawerState.kind === "projection" ? (
            <form id="planner-policies-projection-form" onSubmit={handleSaveProjectionPolicy}>
              <div className="sa-drawer-form-card">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="projection-policy-name">Name</label>
                    <input
                      id="projection-policy-name"
                      className="form-control"
                      value={projectionPolicyForm.name}
                      onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="projection-policy-key">Policy Key</label>
                    <input
                      id="projection-policy-key"
                      className="form-control"
                      value={projectionPolicyForm.policyKey}
                      onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="projection-policy-scope">Scope</label>
                    <select
                      id="projection-policy-scope"
                      className="form-select"
                      value={projectionPolicyForm.scopeType}
                      onChange={(event) =>
                        setProjectionPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))
                      }
                    >
                      {SCOPE_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="projection-policy-priority">Priority</label>
                    <input
                      id="projection-policy-priority"
                      className="form-control"
                      type="number"
                      value={projectionPolicyForm.priority}
                      onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="form-check mb-2 me-3">
                      <input
                        id="projection-policy-active"
                        className="form-check-input"
                        type="checkbox"
                        checked={projectionPolicyForm.isActive}
                        onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="projection-policy-active">Active</label>
                    </div>
                    <div className="form-check mb-2">
                      <input
                        id="projection-policy-stop-on-match"
                        className="form-check-input"
                        type="checkbox"
                        checked={projectionPolicyForm.stopOnMatch}
                        onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="projection-policy-stop-on-match">Stop On Match</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="projection-policy-description">Description</label>
                    <textarea
                      id="projection-policy-description"
                      className="form-control"
                      rows={3}
                      value={projectionPolicyForm.description}
                      onChange={(event) => setProjectionPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </div>
                </div>
                <ProjectionRuleEditorFields
                  prefix="projection-policy"
                  value={projectionPolicyForm.rule}
                  onChange={(next) => setProjectionPolicyForm((prev) => ({ ...prev, rule: next }))}
                />
              </div>
            </form>
          ) : null}

          {drawerState.kind === "signal" ? (
            <form id="planner-policies-signal-form" onSubmit={handleSaveSignalPolicy}>
              <div className="sa-drawer-form-card">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="signal-policy-name">Name</label>
                    <input
                      id="signal-policy-name"
                      className="form-control"
                      value={signalPolicyForm.name}
                      onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="signal-policy-key">Policy Key</label>
                    <input
                      id="signal-policy-key"
                      className="form-control"
                      value={signalPolicyForm.policyKey}
                      onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="signal-policy-scope">Scope</label>
                    <select
                      id="signal-policy-scope"
                      className="form-select"
                      value={signalPolicyForm.scopeType}
                      onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))}
                    >
                      {GLOBAL_WORKSPACE_SCOPE_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="signal-policy-priority">Priority</label>
                    <input
                      id="signal-policy-priority"
                      className="form-control"
                      type="number"
                      value={signalPolicyForm.priority}
                      onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="form-check mb-2 me-3">
                      <input
                        id="signal-policy-active"
                        className="form-check-input"
                        type="checkbox"
                        checked={signalPolicyForm.isActive}
                        onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="signal-policy-active">Active</label>
                    </div>
                    <div className="form-check mb-2">
                      <input
                        id="signal-policy-stop-on-match"
                        className="form-check-input"
                        type="checkbox"
                        checked={signalPolicyForm.stopOnMatch}
                        onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="signal-policy-stop-on-match">Stop On Match</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="signal-policy-description">Description</label>
                    <textarea
                      id="signal-policy-description"
                      className="form-control"
                      rows={3}
                      value={signalPolicyForm.description}
                      onChange={(event) => setSignalPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </div>
                </div>
                <SignalRuleEditorFields
                  prefix="signal-policy"
                  value={signalPolicyForm.rule}
                  onChange={(next) => setSignalPolicyForm((prev) => ({ ...prev, rule: next }))}
                />
              </div>
            </form>
          ) : null}

          {drawerState.kind === "prompt_intent" ? (
            <form id="planner-policies-prompt-intent-form" onSubmit={handleSavePromptIntentPolicy}>
              <div className="sa-drawer-form-card">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="prompt-intent-policy-name">Name</label>
                    <input
                      id="prompt-intent-policy-name"
                      className="form-control"
                      value={promptIntentPolicyForm.name}
                      onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="prompt-intent-policy-key">Policy Key</label>
                    <input
                      id="prompt-intent-policy-key"
                      className="form-control"
                      value={promptIntentPolicyForm.policyKey}
                      onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="prompt-intent-policy-scope">Scope</label>
                    <select
                      id="prompt-intent-policy-scope"
                      className="form-select"
                      value={promptIntentPolicyForm.scopeType}
                      onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))}
                    >
                      {GLOBAL_WORKSPACE_SCOPE_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="prompt-intent-policy-priority">Priority</label>
                    <input
                      id="prompt-intent-policy-priority"
                      className="form-control"
                      type="number"
                      value={promptIntentPolicyForm.priority}
                      onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="form-check mb-2 me-3">
                      <input
                        id="prompt-intent-policy-active"
                        className="form-check-input"
                        type="checkbox"
                        checked={promptIntentPolicyForm.isActive}
                        onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="prompt-intent-policy-active">Active</label>
                    </div>
                    <div className="form-check mb-2">
                      <input
                        id="prompt-intent-policy-stop-on-match"
                        className="form-check-input"
                        type="checkbox"
                        checked={promptIntentPolicyForm.stopOnMatch}
                        onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="prompt-intent-policy-stop-on-match">Stop On Match</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="prompt-intent-policy-description">Description</label>
                    <textarea
                      id="prompt-intent-policy-description"
                      className="form-control"
                      rows={3}
                      value={promptIntentPolicyForm.description}
                      onChange={(event) => setPromptIntentPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </div>
                </div>
                <PromptIntentRuleEditorFields
                  prefix="prompt-intent-policy"
                  value={promptIntentPolicyForm.rule}
                  onChange={(next) => setPromptIntentPolicyForm((prev) => ({ ...prev, rule: next }))}
                />
              </div>
            </form>
          ) : null}

          {drawerState.kind === "retrieval" ? (
            <form id="planner-policies-retrieval-form" onSubmit={handleSaveRetrievalPolicy}>
              <div className="sa-drawer-form-card">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="retrieval-policy-name">Name</label>
                    <input
                      id="retrieval-policy-name"
                      className="form-control"
                      value={retrievalPolicyForm.name}
                      onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="retrieval-policy-key">Policy Key</label>
                    <input
                      id="retrieval-policy-key"
                      className="form-control"
                      value={retrievalPolicyForm.policyKey}
                      onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="retrieval-policy-scope">Scope</label>
                    <select
                      id="retrieval-policy-scope"
                      className="form-select"
                      value={retrievalPolicyForm.scopeType}
                      onChange={(event) =>
                        setRetrievalPolicyForm((prev) => ({ ...prev, scopeType: event.target.value as PlannerPolicyScopeType }))
                      }
                    >
                      {GLOBAL_WORKSPACE_SCOPE_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="retrieval-policy-priority">Priority</label>
                    <input
                      id="retrieval-policy-priority"
                      className="form-control"
                      type="number"
                      value={retrievalPolicyForm.priority}
                      onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, priority: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="form-check mb-2 me-3">
                      <input
                        id="retrieval-policy-active"
                        className="form-check-input"
                        type="checkbox"
                        checked={retrievalPolicyForm.isActive}
                        onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="retrieval-policy-active">Active</label>
                    </div>
                    <div className="form-check mb-2">
                      <input
                        id="retrieval-policy-stop-on-match"
                        className="form-check-input"
                        type="checkbox"
                        checked={retrievalPolicyForm.stopOnMatch}
                        onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="retrieval-policy-stop-on-match">Stop On Match</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="retrieval-policy-description">Description</label>
                    <textarea
                      id="retrieval-policy-description"
                      className="form-control"
                      rows={3}
                      value={retrievalPolicyForm.description}
                      onChange={(event) => setRetrievalPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </div>
                </div>
                <RetrievalRuleEditorFields
                  prefix="retrieval-policy"
                  value={retrievalPolicyForm.rule}
                  onChange={(next) => setRetrievalPolicyForm((prev) => ({ ...prev, rule: next }))}
                />
              </div>
            </form>
          ) : null}

          {drawerState.kind === "domain_selection" ? (
            <form id="planner-policies-domain-selection-form" onSubmit={handleSaveDomainSelectionPolicy}>
              <div className="sa-drawer-form-card">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="domain-selection-policy-name">Name</label>
                    <input
                      id="domain-selection-policy-name"
                      className="form-control"
                      value={domainSelectionPolicyForm.name}
                      onChange={(event) =>
                        setDomainSelectionPolicyForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="domain-selection-policy-key">Policy Key</label>
                    <input
                      id="domain-selection-policy-key"
                      className="form-control"
                      value={domainSelectionPolicyForm.policyKey}
                      onChange={(event) =>
                        setDomainSelectionPolicyForm((prev) => ({ ...prev, policyKey: event.target.value }))
                      }
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="domain-selection-policy-scope">Scope</label>
                    <select
                      id="domain-selection-policy-scope"
                      className="form-select"
                      value={domainSelectionPolicyForm.scopeType}
                      onChange={(event) =>
                        setDomainSelectionPolicyForm((prev) => ({
                          ...prev,
                          scopeType: event.target.value as PlannerPolicyScopeType,
                        }))
                      }
                    >
                      {GLOBAL_WORKSPACE_SCOPE_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="domain-selection-policy-priority">Priority</label>
                    <input
                      id="domain-selection-policy-priority"
                      className="form-control"
                      type="number"
                      value={domainSelectionPolicyForm.priority}
                      onChange={(event) =>
                        setDomainSelectionPolicyForm((prev) => ({ ...prev, priority: event.target.value }))
                      }
                    />
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="form-check mb-2 me-3">
                      <input
                        id="domain-selection-policy-active"
                        className="form-check-input"
                        type="checkbox"
                        checked={domainSelectionPolicyForm.isActive}
                        onChange={(event) =>
                          setDomainSelectionPolicyForm((prev) => ({ ...prev, isActive: event.target.checked }))
                        }
                      />
                      <label className="form-check-label" htmlFor="domain-selection-policy-active">Active</label>
                    </div>
                    <div className="form-check mb-2">
                      <input
                        id="domain-selection-policy-stop-on-match"
                        className="form-check-input"
                        type="checkbox"
                        checked={domainSelectionPolicyForm.stopOnMatch}
                        onChange={(event) =>
                          setDomainSelectionPolicyForm((prev) => ({ ...prev, stopOnMatch: event.target.checked }))
                        }
                      />
                      <label className="form-check-label" htmlFor="domain-selection-policy-stop-on-match">Stop On Match</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="domain-selection-policy-description">Description</label>
                    <textarea
                      id="domain-selection-policy-description"
                      className="form-control"
                      rows={3}
                      value={domainSelectionPolicyForm.description}
                      onChange={(event) =>
                        setDomainSelectionPolicyForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <DomainSelectionRuleEditorFields
                  prefix="domain-selection-policy"
                  value={domainSelectionPolicyForm.rule}
                  onChange={(next) => setDomainSelectionPolicyForm((prev) => ({ ...prev, rule: next }))}
                />
              </div>
            </form>
          ) : null}

          {drawerState.kind === "candidates" ? (
            <form id="planner-policies-candidates-form" onSubmit={handleSaveCandidate}>
              <div className="sa-drawer-form-card">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="candidate-key">Candidate Key</label>
                    <input
                      id="candidate-key"
                      className="form-control"
                      value={candidateForm.candidateKey}
                      onChange={(event) => setCandidateForm((prev) => ({ ...prev, candidateKey: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="candidate-source-type">Source Type</label>
                    <select
                      id="candidate-source-type"
                      className="form-select"
                      value={candidateForm.sourceType}
                      onChange={(event) =>
                        setCandidateForm((prev) => ({ ...prev, sourceType: event.target.value as PlannerPolicyCandidateSourceType }))
                      }
                    >
                      {CANDIDATE_SOURCE_OPTIONS.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="candidate-confidence">Confidence</label>
                    <input
                      id="candidate-confidence"
                      className="form-control"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={candidateForm.confidence}
                      onChange={(event) => setCandidateForm((prev) => ({ ...prev, confidence: event.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="candidate-rationale">Rationale JSON</label>
                    <textarea
                      id="candidate-rationale"
                      className="form-control font-monospace"
                      rows={6}
                      value={candidateForm.rationaleJson}
                      onChange={(event) => setCandidateForm((prev) => ({ ...prev, rationaleJson: event.target.value }))}
                      placeholder='{"prompt":"Show students at Barksdale Elementary"}'
                    />
                  </div>
                </div>
                <RuleEditorFields
                  prefix="candidate"
                  value={candidateForm.rule}
                  onChange={(next) => setCandidateForm((prev) => ({ ...prev, rule: next }))}
                />
              </div>
            </form>
          ) : null}

          {drawerState.kind === "candidate_suggest" ? (
            <form id="planner-policies-candidate-suggest-form" onSubmit={handleSuggestCandidate}>
              <div className="sa-drawer-form-card">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label" htmlFor="suggest-prompt">Example Prompt</label>
                    <textarea
                      id="suggest-prompt"
                      className="form-control"
                      rows={5}
                      value={suggestForm.prompt}
                      onChange={(event) => setSuggestForm((prev) => ({ ...prev, prompt: event.target.value }))}
                      placeholder="Show me all the students enrolled at Barksdale Elementary"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="suggest-observed-domain">Observed Wrong Domain</label>
                    <select
                      id="suggest-observed-domain"
                      className="form-select"
                      value={suggestForm.observedDomainId}
                      onChange={(event) => setSuggestForm((prev) => ({ ...prev, observedDomainId: event.target.value }))}
                    >
                      <option value="">None</option>
                      {domains
                        .filter((domain: Domain) => domain.id !== selectedDomainId)
                        .map((domain: Domain) => (
                        <option value={domain.id} key={`suggest-domain-${domain.id}`}>
                          {domain.name}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">Optional. Use this when planner picked the wrong domain and you want AI to compare the capability gap.</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="suggest-candidate-key">Candidate Key Override</label>
                    <input
                      id="suggest-candidate-key"
                      className="form-control"
                      value={suggestForm.candidateKey}
                      onChange={(event) => setSuggestForm((prev) => ({ ...prev, candidateKey: event.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="suggest-notes">Notes</label>
                    <textarea
                      id="suggest-notes"
                      className="form-control"
                      rows={4}
                      value={suggestForm.notes}
                      onChange={(event) => setSuggestForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Optional context for why this prompt should favor the selected domain."
                    />
                  </div>
                  <div className="col-12">
                    <div className="small text-muted">
                      Target domain: <strong>{selectedDomain?.name ?? "Select a domain first"}</strong>
                    </div>
                    <div className="small text-muted">
                      Vertical norm: <strong>{verticalNorm.trim() || "generic"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          ) : null}
        </PlannerPolicyDrawer>
      ) : null}

      {deleteDialog ? (
        <div className="sa-dialog-backdrop" onClick={deleteBusy ? undefined : () => setDeleteDialog(null)}>
          <div
            className="sa-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Delete ${deleteDialog.kind}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sa-dialog-header">
              <span>
                Delete{" "}
                {deleteDialog.kind === "capability"
                  ? "Capability"
                  : deleteDialog.kind === "policy"
                    ? "Policy"
                    : deleteDialog.kind === "projection_policy"
                      ? "Projection Policy"
                    : deleteDialog.kind === "signal_policy"
                      ? "Signal Policy"
                      : deleteDialog.kind === "prompt_intent_policy"
                        ? "Prompt Intent Policy"
                    : "Candidate"}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-light"
                aria-label="Close delete dialog"
                onClick={() => setDeleteDialog(null)}
                disabled={deleteBusy}
              >
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="sa-dialog-body">
              Delete{" "}
              <strong>{deleteDialog.label}</strong>
              ? This action cannot be undone.
            </div>
            <div className="sa-dialog-footer">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setDeleteDialog(null)}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => void handleConfirmDelete()}
                disabled={deleteBusy}
              >
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
