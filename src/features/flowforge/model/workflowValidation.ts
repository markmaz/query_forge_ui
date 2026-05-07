import type { FlowForgeValidationResult } from "./types";

export type FlowForgeNodeValidationIssue = {
  severity: "error" | "warning";
  message: string;
};

export type FlowForgeNodeValidationIssues = Record<string, FlowForgeNodeValidationIssue[]>;

const NODE_MESSAGE_PATTERN = /node '([^']+)'/i;

function nodeIdFromValidationMessage(message: string): string | null {
  const match = NODE_MESSAGE_PATTERN.exec(message);
  return match?.[1] ? match[1].trim() : null;
}

function addIssue(
  issues: FlowForgeNodeValidationIssues,
  nodeId: string,
  issue: FlowForgeNodeValidationIssue,
): FlowForgeNodeValidationIssues {
  return {
    ...issues,
    [nodeId]: [...(issues[nodeId] ?? []), issue],
  };
}

export function buildNodeValidationIssues(validation: FlowForgeValidationResult): FlowForgeNodeValidationIssues {
  let issues: FlowForgeNodeValidationIssues = {};
  validation.errors.forEach((message) => {
    const nodeId = nodeIdFromValidationMessage(message);
    if (nodeId) issues = addIssue(issues, nodeId, { severity: "error", message });
  });
  validation.warnings.forEach((message) => {
    const nodeId = nodeIdFromValidationMessage(message);
    if (nodeId) issues = addIssue(issues, nodeId, { severity: "warning", message });
  });
  return issues;
}

export function validationIssueTone(issues: FlowForgeNodeValidationIssue[]): "error" | "warning" | null {
  if (issues.some((issue) => issue.severity === "error")) return "error";
  if (issues.some((issue) => issue.severity === "warning")) return "warning";
  return null;
}
