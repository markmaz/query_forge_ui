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
  | "assignment"
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
  condition?: string | null;
}

export interface FlowForgeGraph {
  nodes: FlowForgeNode[];
  edges: FlowForgeEdge[];
}

export interface FlowForgeWorkflowDefinition {
  id: string;
  name: string;
  description: string;
  status: string;
  graph: FlowForgeGraph;
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
