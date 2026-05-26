import type { FlowForgeRunAsPrincipal, FlowForgeRunAsPrincipalRef, FlowForgeWorkflowDefinition } from "./types";

export function ownerDisplayName(workflow: FlowForgeWorkflowDefinition): string {
  return workflow.owner_display_name?.trim() || workflow.owner_user_id?.trim() || "Not set";
}

export function principalTypeLabel(type?: string | null): string {
  return String(type || "principal").replace(/_/g, " ");
}

export function principalDisplayName(
  principal?: FlowForgeRunAsPrincipalRef | null,
  options: FlowForgeRunAsPrincipal[] = [],
): string {
  const type = principal?.principal_type?.trim();
  const id = principal?.principal_id?.trim();
  if (!type || !id) return "Not set";

  const option = options.find((item) => item.principal_type === type && item.principal_id === id);
  const displayName = principal?.display_name?.trim() || option?.display_name?.trim();
  if (displayName) return `${displayName} (${principalTypeLabel(type)})`;
  if (type === "workspace_principal") return "Workspace principal";
  return `${principalTypeLabel(type)} · ${id}`;
}

