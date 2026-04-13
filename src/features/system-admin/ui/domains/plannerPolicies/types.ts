import type {
  PlannerDomainSelectionFeatureKey,
  PlannerPolicyCandidateReviewStatus,
  PlannerPolicyCandidateSourceType,
  PlannerPolicyCapabilityKey,
  PlannerPolicyScopeType,
  PlannerPolicySignalKey,
  PlannerPolicySourceType,
  PlannerPolicySupportLevel,
  PlannerProjectionMode,
  PlannerPromptIntentActionKey,
  PlannerRetrievalQuerySource,
  PlannerSignalHelperName,
  PlannerSignalMatchType,
} from "@/features/system-admin/types";

export type PlannerPoliciesTab =
  | "capabilities"
  | "policies"
  | "projection"
  | "signal"
  | "prompt_intent"
  | "retrieval"
  | "domain_selection"
  | "candidates";

export type DomainCoverageStatus = "configured" | "partial" | "empty";

export type DomainCoverageRow = {
  domainId: number;
  domainName: string;
  capabilityCount: number;
  policyCount: number;
  projectionPolicyCount: number;
  totalCount: number;
  status: DomainCoverageStatus;
};

export type RuleFormState = {
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

export type CapabilityFormState = {
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

export type PolicyFormState = {
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

export type ProjectionRuleFormState = {
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

export type ProjectionPolicyFormState = {
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

export type SignalRuleFormState = {
  signalKeys: PlannerPolicySignalKey[];
  matchType: PlannerSignalMatchType;
  patterns: string[];
  helperName: PlannerSignalHelperName | "";
  suffixes: string[];
  stopwords: string[];
  caseSensitive: boolean;
};

export type SignalPolicyFormState = {
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

export type PromptIntentRuleFormState = {
  actionKey: PlannerPromptIntentActionKey;
  regexPatterns: string[];
  substringPatterns: string[];
  stateCodes: string[];
};

export type PromptIntentPolicyFormState = {
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

export type RetrievalRuleFormState = {
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

export type RetrievalPolicyFormState = {
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

export type DomainSelectionRuleFormState = {
  whenSignalsAll: PlannerPolicySignalKey[];
  whenSignalsAny: PlannerPolicySignalKey[];
  excludeSignalsAny: PlannerPolicySignalKey[];
  requiredShortlistFeatures: PlannerDomainSelectionFeatureKey[];
  requiredCapabilityFeatures: PlannerDomainSelectionFeatureKey[];
  scoreDelta: string;
};

export type DomainSelectionPolicyFormState = {
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

export type CandidateFormState = {
  id?: number;
  candidateKey: string;
  sourceType: PlannerPolicyCandidateSourceType;
  confidence: string;
  rationaleJson: string;
  rule: RuleFormState;
};

export type SuggestFormState = {
  prompt: string;
  observedDomainId: string;
  candidateKey: string;
  notes: string;
};

export type DrawerState =
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

export type DeleteDialogState =
  | { kind: "capability"; id: number; label: string }
  | { kind: "policy"; id: number; label: string }
  | { kind: "projection_policy"; id: number; label: string }
  | { kind: "signal_policy"; id: number; label: string }
  | { kind: "prompt_intent_policy"; id: number; label: string }
  | { kind: "retrieval_policy"; id: number; label: string }
  | { kind: "domain_selection_policy"; id: number; label: string }
  | { kind: "candidate"; id: number; label: string }
  | null;

export type RetrievalQuerySourceOption = PlannerRetrievalQuerySource;
