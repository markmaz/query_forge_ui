import { describe, expect, it } from "vitest";
import {
  getFilterOperatorInputKind,
  getFilterValueError,
  normalizeFilterOperator,
  normalizeFilterValueForOperator,
} from "../filterOperators";

describe("filterOperators", () => {
  it("maps operators to correct input kinds", () => {
    expect(getFilterOperatorInputKind("equals")).toBe("single");
    expect(getFilterOperatorInputKind("not_equals")).toBe("single");
    expect(getFilterOperatorInputKind("in")).toBe("multi");
    expect(getFilterOperatorInputKind("not_in")).toBe("multi");
    expect(getFilterOperatorInputKind("between")).toBe("range");
    expect(getFilterOperatorInputKind("is_null")).toBe("none");
    expect(getFilterOperatorInputKind("is_not_null")).toBe("none");
  });

  it("normalizes legacy/alias operators to canonical values", () => {
    expect(normalizeFilterOperator("=")).toBe("equals");
    expect(normalizeFilterOperator("!=")).toBe("not_equals");
    expect(normalizeFilterOperator(">=")).toBe("gte");
    expect(normalizeFilterOperator("<=")).toBe("lte");
    expect(normalizeFilterOperator("is null")).toBe("is_null");
    expect(normalizeFilterOperator("is not null")).toBe("is_not_null");
    expect(normalizeFilterOperator("exists")).toBe("is_not_null");
    expect(normalizeFilterOperator("not_exists")).toBe("is_null");
    expect(normalizeFilterOperator("eq")).toBe("equals");
  });

  it("serializes values by operator contract", () => {
    expect(normalizeFilterValueForOperator("equals", "abc")).toBe("abc");
    expect(normalizeFilterValueForOperator("not_equals", "abc")).toBe("abc");
    expect(normalizeFilterValueForOperator("contains", "abc")).toBe("abc");
    expect(normalizeFilterValueForOperator("starts_with", "ab")).toBe("ab");
    expect(normalizeFilterValueForOperator("gt", "10")).toBe("10");
    expect(normalizeFilterValueForOperator("gte", "10")).toBe("10");
    expect(normalizeFilterValueForOperator("lt", "10")).toBe("10");
    expect(normalizeFilterValueForOperator("lte", "10")).toBe("10");
    expect(normalizeFilterValueForOperator("in", "a,b,c")).toEqual(["a", "b", "c"]);
    expect(normalizeFilterValueForOperator("not_in", ["a", "b"])).toEqual(["a", "b"]);
    expect(normalizeFilterValueForOperator("between", "5,20")).toEqual(["5", "20"]);
    expect(normalizeFilterValueForOperator("is_null", "ignored")).toBeNull();
    expect(normalizeFilterValueForOperator("is_not_null", "ignored")).toBeNull();
  });

  it("hydrates null/list/range values from persisted shapes", () => {
    expect(
      normalizeFilterValueForOperator("not_in", {
        mode: "manual",
        values: ["TN", "KY"],
      })
    ).toEqual(["TN", "KY"]);
    expect(normalizeFilterValueForOperator("between", { min: "1", max: "9" })).toEqual(["1", "9"]);
    expect(normalizeFilterValueForOperator("is_null", null)).toBeNull();
  });

  it("validates list/range operators", () => {
    expect(getFilterValueError("in", [])).toBe("At least one value is required.");
    expect(getFilterValueError("not_in", ["A"])).toBeNull();
    expect(getFilterValueError("between", ["", "2"])).toBe("Between requires exactly 2 values.");
    expect(getFilterValueError("between", ["1", "2"])).toBeNull();
    expect(getFilterValueError("is_null", null)).toBeNull();
  });
});

