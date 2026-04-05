import { describe, expect, it } from "vitest";
import type {
  SqlConcatRule,
  SqlFillEmptyRule,
  SqlDataPrepRule,
} from "../../../model/sqlJson";
import {
  isRuleConcat,
  isFillEmpty,
  mkColumnRef,
  mkLiteralRef,
  getValueRefCol,
  getValueRefLiteral,
} from "../dataPrepHelpers";

const CONCAT_RULE: SqlConcatRule = {
  id: "r1",
  enabled: true,
  op: "concat",
  target: { modelColumnId: 1, columnName: "col_a" },
  output: { modelColumnId: null, columnName: "combined", exprId: "r1" },
  applyScope: "query_wide",
  inputs: [],
};

const FILL_RULE: SqlFillEmptyRule = {
  id: "r2",
  enabled: true,
  op: "fill_empty",
  target: { modelColumnId: 2, columnName: "col_b" },
  output: { modelColumnId: null, columnName: "col_b", exprId: "r2" },
  applyScope: "query_wide",
  value: "",
};

describe("isRuleConcat", () => {
  it("returns true for a concat rule", () => {
    expect(isRuleConcat(CONCAT_RULE)).toBe(true);
  });

  it("returns false for a non-concat rule", () => {
    expect(isRuleConcat(FILL_RULE as SqlDataPrepRule)).toBe(false);
  });
});

describe("isFillEmpty", () => {
  it("returns true for a fill_empty rule", () => {
    expect(isFillEmpty(FILL_RULE as SqlDataPrepRule)).toBe(true);
  });

  it("returns false for a non-fill_empty rule", () => {
    expect(isFillEmpty(CONCAT_RULE)).toBe(false);
  });
});

describe("mkColumnRef", () => {
  it("produces a column SqlValueRef", () => {
    const col = { modelColumnId: 1, columnName: "x" };
    const ref = mkColumnRef(col);
    expect(ref.type).toBe("column");
    expect(getValueRefCol(ref)).toEqual(col);
  });
});

describe("mkLiteralRef", () => {
  it("produces a literal SqlValueRef with a string value", () => {
    const ref = mkLiteralRef("hello");
    expect(ref.type).toBe("literal");
    expect(getValueRefLiteral(ref)).toBe("hello");
  });

  it("produces a literal SqlValueRef with null", () => {
    const ref = mkLiteralRef(null);
    expect(ref.type).toBe("literal");
    expect(getValueRefLiteral(ref)).toBeNull();
  });
});

describe("getValueRefCol", () => {
  it("returns null for a literal ref", () => {
    expect(getValueRefCol(mkLiteralRef("x"))).toBeNull();
  });
});

describe("getValueRefLiteral", () => {
  it("returns null for a column ref", () => {
    const col = { modelColumnId: 1, columnName: "x" };
    expect(getValueRefLiteral(mkColumnRef(col))).toBeNull();
  });
});
