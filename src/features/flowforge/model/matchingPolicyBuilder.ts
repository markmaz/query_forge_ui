import type { FlowForgeResourceRecord } from "./adminTypes";

export type FieldType = "array" | "boolean" | "number" | "text" | "unknown";

export interface ResourceFieldOption {
  key: string;
  label: string;
  type: FieldType;
  source: "common" | "resource";
}

export interface MatchingPolicyRuleState {
  id: string;
  field: string;
  operator: string;
  value: string;
  scoreWeight: string;
}

export interface MatchingPolicyBuilderState {
  eligibilityRules: MatchingPolicyRuleState[];
  scoringRules: MatchingPolicyRuleState[];
  fairnessWindowScoreDelta: string;
}

export const VALUELESS_OPERATORS = new Set(["exists", "not_exists"]);
export const CONTEXT_OPERATORS = new Set(["matches_context", "contains_context"]);

export const OPERATOR_OPTIONS: Array<{ value: string; label: string; compatibleTypes?: FieldType[] }> = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains", compatibleTypes: ["array", "text", "unknown"] },
  { value: "not_contains", label: "does not contain", compatibleTypes: ["array", "text", "unknown"] },
  { value: "matches_context", label: "matches input" },
  { value: "contains_context", label: "contains input", compatibleTypes: ["array", "text", "unknown"] },
  { value: "in", label: "is one of" },
  { value: "not_in", label: "is not one of" },
  { value: "gt", label: "is greater than", compatibleTypes: ["number", "unknown"] },
  { value: "gte", label: "is greater than or equal to", compatibleTypes: ["number", "unknown"] },
  { value: "lt", label: "is less than", compatibleTypes: ["number", "unknown"] },
  { value: "lte", label: "is less than or equal to", compatibleTypes: ["number", "unknown"] },
  { value: "between", label: "is between", compatibleTypes: ["number", "unknown"] },
  { value: "overlaps", label: "overlaps with", compatibleTypes: ["array", "unknown"] },
  { value: "exists", label: "has a value" },
  { value: "not_exists", label: "is blank" },
];

export const FALLBACK_FIELDS: ResourceFieldOption[] = [
  { key: "effective_status", label: "Effective Status", type: "text", source: "common" },
  { key: "availability_status", label: "Availability Status", type: "text", source: "common" },
  { key: "capacity_available", label: "Capacity Available", type: "number", source: "common" },
  { key: "display_name", label: "Display Name", type: "text", source: "common" },
  { key: "primary_email", label: "Primary Email", type: "text", source: "common" },
  { key: "source_record_key", label: "Source Record Key", type: "text", source: "common" },
];

const FIELD_EXCLUSIONS = new Set(["id", "validation_errors", "attributes", "normalized_profile"]);

export const createDefaultEligibilityRule = (id = "eligibility-1"): MatchingPolicyRuleState => ({
  id,
  field: "effective_status",
  operator: "equals",
  value: "active",
  scoreWeight: "0",
});

export const createDefaultScoringRule = (id = "scoring-1"): MatchingPolicyRuleState => ({
  id,
  field: "capacity_available",
  operator: "gt",
  value: "0",
  scoreWeight: "10",
});

export const defaultBuilderState: MatchingPolicyBuilderState = {
  eligibilityRules: [createDefaultEligibilityRule()],
  scoringRules: [createDefaultScoringRule()],
  fairnessWindowScoreDelta: "0",
};

export const titleize = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const operatorLabel = (operator: string) => OPERATOR_OPTIONS.find((option) => option.value === operator)?.label ?? operator;

export const inferFieldType = (value: unknown): FieldType => {
  if (Array.isArray(value)) return "array";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return value.trim() !== "" && !Number.isNaN(Number(value)) ? "number" : "text";
  return "unknown";
};

export const compatibleOperators = (fieldType: FieldType) =>
  OPERATOR_OPTIONS.filter((operator) => !operator.compatibleTypes || operator.compatibleTypes.includes(fieldType));

export const readRecordFields = (record: FlowForgeResourceRecord) => {
  const fields: Array<{ key: string; value: unknown }> = [];
  Object.entries(record as unknown as Record<string, unknown>).forEach(([key, value]) => {
    if (!FIELD_EXCLUSIONS.has(key)) fields.push({ key, value });
  });
  Object.entries(record.attributes ?? {}).forEach(([key, value]) => fields.push({ key, value }));
  Object.entries(record.normalized_profile ?? {}).forEach(([key, value]) => fields.push({ key, value }));
  return fields;
};

export const buildFieldOptions = (records: FlowForgeResourceRecord[] = []): ResourceFieldOption[] => {
  const fields = new Map<string, ResourceFieldOption>();
  FALLBACK_FIELDS.forEach((field) => fields.set(field.key, field));
  records.forEach((record) => {
    readRecordFields(record).forEach(({ key, value }) => {
      if (!fields.has(key)) {
        fields.set(key, { key, label: titleize(key), type: inferFieldType(value), source: "resource" });
        return;
      }
      const existing = fields.get(key);
      if (existing && existing.type === "unknown") fields.set(key, { ...existing, type: inferFieldType(value) });
    });
  });
  return [...fields.values()].sort((left, right) => left.label.localeCompare(right.label));
};

export const parseRuleValue = (rawValue: string, operator: string, fieldType: FieldType) => {
  if (VALUELESS_OPERATORS.has(operator)) return undefined;
  if (["in", "not_in", "overlaps"].includes(operator)) {
    return rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (operator === "between") {
    return rawValue
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => !Number.isNaN(value))
      .slice(0, 2);
  }
  if (fieldType === "boolean") return ["true", "yes", "1"].includes(rawValue.trim().toLowerCase());
  if (fieldType === "number" && rawValue.trim() !== "" && !Number.isNaN(Number(rawValue))) return Number(rawValue);
  return rawValue;
};

const normalizeOperator = (operator: unknown, valueFrom?: unknown) => {
  const cleanOperator = String(operator ?? "")
    .trim()
    .toLowerCase();
  if (valueFrom) {
    if (["eq", "equals", "=", "==", "matches_context"].includes(cleanOperator)) return "matches_context";
    if (["contains_any", "contains_all", "contains", "in", "overlaps", "contains_context"].includes(cleanOperator)) return "contains_context";
  }
  if (["eq", "=", "=="].includes(cleanOperator)) return "equals";
  if (["ne", "neq", "!=", "<>"].includes(cleanOperator)) return "not_equals";
  if (cleanOperator === "contains_any") return "overlaps";
  if (cleanOperator === "contains_all") return "contains";
  return cleanOperator;
};

const inputReferenceToContextField = (value: unknown) => String(value ?? "").trim().replace(/^inputs\./, "");

const builderValueFromRule = (rule: Record<string, unknown>, fallbackValue: string) => {
  if (rule.context_field) return `inputs.${inputReferenceToContextField(rule.context_field)}`;
  if (rule.value_from) return String(rule.value_from);
  if (Array.isArray(rule.value)) return rule.value.join(", ");
  return String(rule.value ?? fallbackValue);
};

const normalizeRuleForBuilder = (
  rule: Record<string, unknown>,
  index: number,
  section: "eligibility" | "scoring",
): Record<string, unknown> => {
  const condition = typeof rule.when === "object" && rule.when !== null ? (rule.when as Record<string, unknown>) : rule;
  const defaultRule = section === "eligibility" ? createDefaultEligibilityRule() : createDefaultScoringRule();
  const valueFrom = condition.value_from ?? rule.value_from;
  return {
    ...condition,
    id: rule.id ?? condition.id ?? `${section}-${index + 1}`,
    field: condition.field ?? defaultRule.field,
    operator: normalizeOperator(condition.operator ?? condition.op ?? rule.operator ?? rule.op ?? defaultRule.operator, valueFrom),
    value: condition.value,
    value_from: valueFrom,
    context_field: condition.context_field ?? (valueFrom ? inputReferenceToContextField(valueFrom) : undefined),
    weight: rule.weight ?? rule.points,
  };
};

const normalizePolicyRules = (sectionValue: unknown, section: "eligibility" | "scoring") => {
  if (Array.isArray(sectionValue)) {
    return sectionValue
      .filter((rule): rule is Record<string, unknown> => typeof rule === "object" && rule !== null)
      .map((rule, index) => normalizeRuleForBuilder(rule, index, section));
  }
  if (typeof sectionValue !== "object" || sectionValue === null) return [];
  const sectionObject = sectionValue as Record<string, unknown>;
  const nestedRules = Array.isArray(sectionObject.rules)
    ? sectionObject.rules
    : Array.isArray(sectionObject.all)
      ? sectionObject.all
      : Array.isArray(sectionObject.any)
        ? sectionObject.any
        : [];
  return nestedRules
    .filter((rule): rule is Record<string, unknown> => typeof rule === "object" && rule !== null)
    .map((rule, index) => normalizeRuleForBuilder(rule, index, section));
};

export const parseFairnessWindowScoreDelta = (rawValue: string) => {
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
};

export const compactResourceRecord = (record: FlowForgeResourceRecord) => ({
  source_record_key: record.source_record_key,
  display_name: record.display_name,
  primary_email: record.primary_email,
  effective_status: record.effective_status,
  availability_status: record.availability_status,
  capacity_available: record.capacity_available,
  ...record.attributes,
  ...record.normalized_profile,
});

export const createPolicyFromBuilderState = (
  state: MatchingPolicyBuilderState,
  fieldOptions: ResourceFieldOption[],
): Record<string, unknown> => {
  const eligibilityRules = state.eligibilityRules.map((rule, index) => {
    const fieldType = fieldOptions.find((field) => field.key === rule.field)?.type ?? "unknown";
    const nextRule: Record<string, unknown> = {
      id: rule.id || `eligibility-${index + 1}`,
      field: rule.field,
      operator: rule.operator,
      reason: `Only include resources where ${titleize(rule.field)} ${operatorLabel(rule.operator)}.`,
    };
    if (CONTEXT_OPERATORS.has(rule.operator)) {
      nextRule.context_field = inputReferenceToContextField(rule.value);
    } else {
      const parsedValue = parseRuleValue(rule.value, rule.operator, fieldType);
      if (parsedValue !== undefined) nextRule.value = parsedValue;
    }
    return nextRule;
  });

  const scoringRules = state.scoringRules.map((rule, index) => {
    const fieldType = fieldOptions.find((field) => field.key === rule.field)?.type ?? "unknown";
    const weight = Number(rule.scoreWeight) || 0;
    const nextRule: Record<string, unknown> = {
      id: rule.id || `scoring-${index + 1}`,
      field: rule.field,
      operator: rule.operator,
      weight,
      reason: `Add ${weight} points when ${titleize(rule.field)} ${operatorLabel(rule.operator)}.`,
    };
    if (CONTEXT_OPERATORS.has(rule.operator)) {
      nextRule.context_field = inputReferenceToContextField(rule.value);
    } else {
      const parsedValue = parseRuleValue(rule.value, rule.operator, fieldType);
      if (parsedValue !== undefined) nextRule.value = parsedValue;
    }
    return nextRule;
  });

  return {
    version: 1,
    eligibility: eligibilityRules,
    scoring: scoringRules,
    selection: {
      strategy: "balanced_top_ranked",
      fairness: {
        within_score_delta: parseFairnessWindowScoreDelta(state.fairnessWindowScoreDelta),
        penalize_active_offers: true,
        prefer_least_recently_offered: true,
      },
    },
  };
};

export const policyToBuilderState = (policy: Record<string, unknown>): MatchingPolicyBuilderState => {
  const eligibility = normalizePolicyRules(policy.eligibility, "eligibility");
  const scoring = normalizePolicyRules(policy.scoring, "scoring");
  const selection = typeof policy.selection === "object" && policy.selection !== null ? (policy.selection as Record<string, unknown>) : {};
  const fairness =
    typeof selection.fairness === "object" && selection.fairness !== null ? (selection.fairness as Record<string, unknown>) : {};
  return {
    eligibilityRules: eligibility.length
      ? eligibility.map((rule, index) => ({
          id: String(rule.id ?? `eligibility-${index + 1}`),
          field: String(rule.field ?? createDefaultEligibilityRule().field),
          operator: String(rule.operator ?? createDefaultEligibilityRule().operator),
          value: builderValueFromRule(rule, createDefaultEligibilityRule().value),
          scoreWeight: "0",
        }))
      : [createDefaultEligibilityRule()],
    scoringRules: scoring.length
      ? scoring.map((rule, index) => ({
          id: String(rule.id ?? `scoring-${index + 1}`),
          field: String(rule.field ?? createDefaultScoringRule().field),
          operator: String(rule.operator ?? createDefaultScoringRule().operator),
          value: builderValueFromRule(rule, createDefaultScoringRule().value),
          scoreWeight: String(rule.weight ?? createDefaultScoringRule().scoreWeight),
        }))
      : [createDefaultScoringRule()],
    fairnessWindowScoreDelta: String(fairness.within_score_delta ?? defaultBuilderState.fairnessWindowScoreDelta),
  };
};
