import type {
  SqlColumnKey,
  SqlConcatRule,
  SqlDataPrepOp,
  SqlDataPrepRule,
  SqlDatePartRule,
  SqlFillEmptyRule,
  SqlNormalizeTextRule,
  SqlValueRef,
} from "../../model/sqlJson";

// ---- Type predicates -------------------------------------------------------

export function isRuleConcat(r: SqlDataPrepRule): r is SqlConcatRule {
  return r.op === "concat";
}

export function isFillEmpty(r: SqlDataPrepRule): r is SqlFillEmptyRule {
  return r.op === "fill_empty";
}

// ---- SqlValueRef constructors -----------------------------------------------

export function mkColumnRef(col: SqlColumnKey): SqlValueRef {
  return { type: "column", col };
}

export function mkLiteralRef(
  value: string | number | boolean | null,
): SqlValueRef {
  return { type: "literal", value };
}

// ---- SqlValueRef accessors --------------------------------------------------

export function getValueRefCol(v: SqlValueRef): SqlColumnKey | null {
  return v.type === "column" ? v.col : null;
}

export function getValueRefLiteral(
  v: SqlValueRef,
): string | number | boolean | null {
  return v.type === "literal" ? v.value : null;
}

// ---- Patch type for updateRule ----------------------------------------------

/**
 * Flat union of all fields that any SqlDataPrepRule variant can accept as
 * an incremental patch.  This is intentionally wider than any single rule type
 * so that updateRule() can accept patches for any op without `as any`.
 */
export type DataPrepRulePatch = {
  op?: SqlDataPrepOp;
  target?: SqlColumnKey | null;
  outputName?: string;
  applyScope?: "query_wide";
  // SqlFillEmptyRule
  value?: string | number | boolean | null;
  fallbackCol?: SqlColumnKey | null;
  treatBlankAsEmpty?: boolean;
  // SqlCastRule
  toType?: string;
  safe?: boolean;
  // SqlNormalizeTextRule
  mode?: SqlNormalizeTextRule["mode"];
  // SqlParseDateRule
  format?: string | null;
  // SqlDatePartRule
  part?: SqlDatePartRule["part"];
  // SqlRoundRule
  decimals?: number;
  // SqlConcatRule
  inputs?: SqlValueRef[];
  separator?: string | null;
  nulls?: SqlConcatRule["nulls"];
};
