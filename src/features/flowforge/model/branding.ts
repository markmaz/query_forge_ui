export const WORKFLOW_AI_LABEL = "Workflow AI";
export const WORKFLOW_STUDIO_LABEL = "Workflow Studio";

export function normalizeWorkflowStudioCopy(value?: string | null): string {
  return (value ?? "")
    .replaceAll("FlowForge AI", WORKFLOW_AI_LABEL)
    .replaceAll("FlowForge Runtime", "Workflow Runtime")
    .replaceAll("FlowForge", WORKFLOW_STUDIO_LABEL);
}
