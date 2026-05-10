export type FlowForgeNodeType =
  | "schedule_trigger"
  | "webhook_trigger"
  | "file_watch_trigger"
  | "intake"
  | "scoring"
  | "filter"
  | "ranking"
  | "human_task"
  | "matching"
  | "notification"
  | "wait"
  | "end"
  | "decision"
  | "event_capture"
  | "iterator"
  | "query_extract"
  | "export"
  | "import"
  | "map_transform"
  | "approval";

export interface FlowForgeNode {
  id: string;
  type: FlowForgeNodeType;
  label: string;
  position: {
    x: number;
    y: number;
  };
  data: Record<string, unknown>;
}

export interface FlowForgeEdge {
  id: string;
  source: string;
  target: string;
  label?: string | null;
  branch?: string | null;
  branches?: string[] | null;
  condition?: string | null;
}

export interface FlowForgeViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowForgeGraph {
  nodes: FlowForgeNode[];
  edges: FlowForgeEdge[];
  viewport?: FlowForgeViewport | null;
}

export interface FlowForgeWorkflowDefinition {
  id: string;
  name: string;
  description: string;
  status: string;
  owner_user_id?: string | null;
  lifecycle?: "development" | "production" | string | null;
  run_as_principal?: FlowForgeRunAsPrincipalRef | null;
  effective_permissions?: FlowForgeEffectivePermissions | null;
  graph: FlowForgeGraph;
}

export interface FlowForgeRunAsPrincipalRef {
  principal_type?: "user" | "service_principal" | "workspace_principal" | string | null;
  principal_id?: string | null;
}

export interface FlowForgeEffectivePermissions {
  permission?: "view" | "run" | "manage_runs" | "edit" | "manage" | "owner" | string | null;
  can_view?: boolean;
  can_run?: boolean;
  can_manage_runs?: boolean;
  can_edit?: boolean;
  can_manage?: boolean;
  can_own?: boolean;
}

export interface FlowForgeWorkflowPermissionEntry {
  id?: number | null;
  principal_type: string;
  principal_id: string;
  permission: string;
  granted_by?: string | null;
  granted_at?: string | null;
}

export interface FlowForgeWorkflowPermissions {
  workflow_definition_id: number;
  items: FlowForgeWorkflowPermissionEntry[];
}

export interface FlowForgeRunAsPrincipal {
  principal_type: "user" | "service_principal" | "workspace_principal" | string;
  principal_id: string;
  display_name: string;
  description?: string | null;
  status: string;
  production_eligible: boolean;
}

export interface FlowForgeRunAsPrincipalsResponse {
  workspace_id: string;
  items: FlowForgeRunAsPrincipal[];
}

export interface FlowForgeManualRunResponse {
  run_id: number;
  workflow_definition_id: number;
  workflow_version_id: number;
  status: string;
  mode: string;
  current_node_id?: string | null;
  idempotency_key: string;
  created: boolean;
}

export interface FlowForgeWorkflowVersion {
  id: number;
  workspace_id: string;
  workflow_definition_id: number;
  version_number: number;
  version_status: string;
  graph: FlowForgeGraph;
  validation_status: string;
  validation_result: Record<string, unknown>;
  matching_policy_refs: unknown[];
  settings: Record<string, unknown>;
  created_at?: string | null;
  published_at?: string | null;
}

export interface FlowForgeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FlowForgeWorkflowAIDraft {
  prompt: string;
  graph: FlowForgeGraph;
  plain_language_summary: string;
  validation_status: string;
  validation_result: FlowForgeValidationResult;
  model_provider?: string | null;
  model_name?: string | null;
  draft_source: string;
}

export interface FlowForgeRunEvent {
  id: string;
  event_type: string;
  node_id: string | null;
  message: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface FlowForgeRunInspector {
  workflow_id: string;
  mode: string;
  status: string;
  events: FlowForgeRunEvent[];
  notes: string[];
}
