import type { SqlFilterOp } from "./sqlJson";

export type FilterOperatorInputKind = "single" | "multi" | "range" | "none";

export const CANONICAL_FILTER_OPERATORS: SqlFilterOp[] = [
  "equals",
  "not_equals",
  "contains",
  "starts_with",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "is_null",
  "is_not_null",
];

const OPERATOR_ALIASES: Record<string, SqlFilterOp> = {
  "=": "equals",
  "==": "equals",
  eq: "equals",
  equals: "equals",
  "!=": "not_equals",
  "<>": "not_equals",
  ne: "not_equals",
  not_equals: "not_equals",
  "not equals": "not_equals",
  contains: "contains",
  "starts with": "starts_with",
  starts_with: "starts_with",
  in: "in",
  "not in": "not_in",
  not_in: "not_in",
  ">": "gt",
  gt: "gt",
  ">=": "gte",
  gte: "gte",
  "<": "lt",
  lt: "lt",
  "<=": "lte",
  lte: "lte",
  between: "between",
  "is null": "is_null",
  is_null: "is_null",
  "is not null": "is_not_null",
  is_not_null: "is_not_null",
  exists: "is_not_null",
  not_exists: "is_null",
  "not exists": "is_null",
};

function normalizeOperatorKey(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_");
}

export function normalizeFilterOperator(
  value: unknown,
  fallback: SqlFilterOp = "equals"
): SqlFilterOp {
  if (typeof value !== "string") return fallback;
  const normalized = normalizeOperatorKey(value);
  if (normalized in OPERATOR_ALIASES) return OPERATOR_ALIASES[normalized];
  return CANONICAL_FILTER_OPERATORS.includes(normalized as SqlFilterOp)
    ? (normalized as SqlFilterOp)
    : fallback;
}

export function getFilterOperatorInputKind(op: SqlFilterOp): FilterOperatorInputKind {
  if (op === "in" || op === "not_in") return "multi";
  if (op === "between") return "range";
  if (op === "is_null" || op === "is_not_null") return "none";
  return "single";
}

function normalizeTextValue(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeListValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeTextValue(entry)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const manualValues = source.values;
    if (Array.isArray(manualValues)) {
      return manualValues.map((entry) => normalizeTextValue(entry)).filter(Boolean);
    }
  }

  const single = normalizeTextValue(value);
  return single ? [single] : [];
}

function normalizeBetweenValues(value: unknown): [string, string] {
  if (Array.isArray(value)) {
    const left = normalizeTextValue(value[0]);
    const right = normalizeTextValue(value[1]);
    return [left, right];
  }

  if (typeof value === "string") {
    const parts = value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return [parts[0] ?? "", parts[1] ?? ""];
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const lower = normalizeTextValue(source.min ?? source.start ?? source.from);
    const upper = normalizeTextValue(source.max ?? source.end ?? source.to);
    return [lower, upper];
  }

  return ["", ""];
}

export function normalizeFilterValueForOperator(op: SqlFilterOp, value: unknown): unknown {
  const kind = getFilterOperatorInputKind(op);
  if (kind === "none") return null;
  if (kind === "multi") return normalizeListValues(value);
  if (kind === "range") return normalizeBetweenValues(value);
  return value == null ? "" : value;
}

export function getFilterValueError(op: SqlFilterOp, value: unknown): string | null {
  const kind = getFilterOperatorInputKind(op);
  if (kind === "multi") {
    const values = normalizeListValues(value);
    return values.length > 0 ? null : "At least one value is required.";
  }
  if (kind === "range") {
    const [left, right] = normalizeBetweenValues(value);
    return left && right ? null : "Between requires exactly 2 values.";
  }
  return null;
}

