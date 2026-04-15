import { describe, expect, it } from "vitest";
import type {
  SqlFilterGroupNode,
  SqlFilterConditionNode,
  SqlFilterNode,
} from "../../../model/sqlJson";
import { isGroupNode, isConditionNode } from "../filterHelpers";

const GROUP: SqlFilterGroupNode = {
  type: "group",
  id: "g1",
  match: "and",
  children: [],
};

const CONDITION: SqlFilterConditionNode = {
  type: "condition",
  id: "c1",
  field: { modelColumnId: 1, columnName: "col_a", workspaceTableId: 10 },
  op: "equals",
  value: "foo",
};

describe("isGroupNode", () => {
  it("returns true for a group node", () => {
    expect(isGroupNode(GROUP)).toBe(true);
  });
  it("returns false for a condition node", () => {
    expect(isGroupNode(CONDITION as SqlFilterNode)).toBe(false);
  });
});

describe("isConditionNode", () => {
  it("returns true for a condition node", () => {
    expect(isConditionNode(CONDITION as SqlFilterNode)).toBe(true);
  });
  it("returns false for a group node", () => {
    expect(isConditionNode(GROUP)).toBe(false);
  });
});
