import type {
  PlannerDomainSelectionPolicyRule,
  PlannerProjectionPolicyRule,
  PlannerPromptIntentPolicyRule,
  PlannerRerankPolicyRule,
  PlannerRetrievalPolicyRule,
  PlannerRetrievalQuerySource,
  PlannerSignalPolicyRule,
} from "@/features/system-admin/types";

import { RETRIEVAL_QUERY_SOURCE_OPTIONS } from "./constants";
import type {
  CandidateFormState,
  CapabilityFormState,
  DomainSelectionPolicyFormState,
  DomainSelectionRuleFormState,
  PolicyFormState,
  ProjectionPolicyFormState,
  ProjectionRuleFormState,
  PromptIntentPolicyFormState,
  PromptIntentRuleFormState,
  RetrievalPolicyFormState,
  RetrievalRuleFormState,
  RuleFormState,
  SignalPolicyFormState,
  SignalRuleFormState,
  SuggestFormState,
} from "./types";

export function defaultRuleForm(): RuleFormState {
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

export function defaultCapabilityForm(): CapabilityFormState {
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

export function defaultPolicyForm(): PolicyFormState {
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

export function defaultProjectionRuleForm(): ProjectionRuleFormState {
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

export function defaultProjectionPolicyForm(): ProjectionPolicyFormState {
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

export function defaultSignalRuleForm(): SignalRuleFormState {
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

export function defaultSignalPolicyForm(): SignalPolicyFormState {
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

export function defaultPromptIntentRuleForm(): PromptIntentRuleFormState {
  return {
    actionKey: "list_students",
    regexPatterns: [],
    substringPatterns: [],
    stateCodes: [],
  };
}

export function defaultPromptIntentPolicyForm(): PromptIntentPolicyFormState {
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

export function defaultRetrievalRuleForm(): RetrievalRuleFormState {
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

export function defaultRetrievalPolicyForm(): RetrievalPolicyFormState {
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

export function defaultDomainSelectionRuleForm(): DomainSelectionRuleFormState {
  return {
    whenSignalsAll: [],
    whenSignalsAny: [],
    excludeSignalsAny: [],
    requiredShortlistFeatures: [],
    requiredCapabilityFeatures: [],
    scoreDelta: "0.10",
  };
}

export function defaultDomainSelectionPolicyForm(): DomainSelectionPolicyFormState {
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

export function defaultCandidateForm(): CandidateFormState {
  return {
    candidateKey: "",
    sourceType: "manual",
    confidence: "0.8",
    rationaleJson: "",
    rule: defaultRuleForm(),
  };
}

export function defaultSuggestForm(): SuggestFormState {
  return {
    prompt: "",
    observedDomainId: "",
    candidateKey: "",
    notes: "",
  };
}

export function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function dedupeValues<T extends string>(values: readonly T[] | null | undefined): T[] {
  return Array.from(new Set(values ?? [])) as T[];
}

export function clampUnit(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export function ruleToForm(rule?: PlannerRerankPolicyRule | null): RuleFormState {
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

export function formToRule(form: RuleFormState): PlannerRerankPolicyRule {
  return {
    version: 1,
    when_signals_all: dedupeValues(form.whenSignalsAll),
    when_signals_any: dedupeValues(form.whenSignalsAny),
    exclude_signals_any: dedupeValues(form.excludeSignalsAny),
    prefer_capabilities: dedupeValues(form.preferCapabilities).map((entry) => entry.toUpperCase()) as RuleFormState["preferCapabilities"],
    penalize_missing: dedupeValues(form.penalizeMissing).map((entry) => entry.toUpperCase()) as RuleFormState["penalizeMissing"],
    require_for_bonus: dedupeValues(form.requireForBonus).map((entry) => entry.toUpperCase()) as RuleFormState["requireForBonus"],
    boost: clampUnit(Number(form.boost), 0),
    penalty: clampUnit(Number(form.penalty), 0),
    max_effect: clampUnit(Number(form.maxEffect), 0.3),
  };
}

export function projectionRuleToForm(rule?: PlannerProjectionPolicyRule | null): ProjectionRuleFormState {
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

export function formToProjectionRule(form: ProjectionRuleFormState): PlannerProjectionPolicyRule {
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

export function signalRuleToForm(rule?: PlannerSignalPolicyRule | null): SignalRuleFormState {
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

export function formToSignalRule(form: SignalRuleFormState): PlannerSignalPolicyRule {
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

export function promptIntentRuleToForm(rule?: PlannerPromptIntentPolicyRule | null): PromptIntentRuleFormState {
  return {
    actionKey: rule?.action_key ?? "list_students",
    regexPatterns: dedupeValues(rule?.regex_patterns),
    substringPatterns: dedupeValues(rule?.substring_patterns),
    stateCodes: dedupeValues(rule?.state_codes),
  };
}

export function formToPromptIntentRule(form: PromptIntentRuleFormState): PlannerPromptIntentPolicyRule {
  return {
    version: 1,
    action_key: form.actionKey,
    regex_patterns: dedupeValues(form.regexPatterns),
    substring_patterns: dedupeValues(form.substringPatterns),
    state_codes: dedupeValues(form.stateCodes).map((entry) => entry.toLowerCase()),
  };
}

export function retrievalRuleToForm(rule?: PlannerRetrievalPolicyRule | null): RetrievalRuleFormState {
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

export function formToRetrievalRule(form: RetrievalRuleFormState): PlannerRetrievalPolicyRule {
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

export function domainSelectionRuleToForm(rule?: PlannerDomainSelectionPolicyRule | null): DomainSelectionRuleFormState {
  return {
    whenSignalsAll: dedupeValues(rule?.when_signals_all),
    whenSignalsAny: dedupeValues(rule?.when_signals_any),
    excludeSignalsAny: dedupeValues(rule?.exclude_signals_any),
    requiredShortlistFeatures: dedupeValues(rule?.required_shortlist_features),
    requiredCapabilityFeatures: dedupeValues(rule?.required_capability_features),
    scoreDelta: String(rule?.score_delta ?? 0.1),
  };
}

export function formToDomainSelectionRule(form: DomainSelectionRuleFormState): PlannerDomainSelectionPolicyRule {
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

export function statusBadgeClass(active: boolean): string {
  return active ? "badge text-bg-success" : "badge text-bg-secondary";
}

export function candidateStatusBadgeClass(status: "pending" | "approved" | "rejected"): string {
  if (status === "approved") return "badge text-bg-success";
  if (status === "rejected") return "badge text-bg-danger";
  return "badge text-bg-warning";
}
