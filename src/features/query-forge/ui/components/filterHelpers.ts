import type {
  SqlFilterNode,
  SqlFilterGroupNode,
  SqlFilterConditionNode,
} from "../../model/sqlJson";

export function isGroupNode(n: SqlFilterNode): n is SqlFilterGroupNode {
  return n.type === "group";
}

export function isConditionNode(n: SqlFilterNode): n is SqlFilterConditionNode {
  return n.type === "condition";
}
