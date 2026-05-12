export type FlowForgeRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "needs_attention"
  | string;

export interface FlowForgePersistedRun {
  id: number;
  workspace_id: string;
  workflow_definition_id: number;
  workflow_version_id: number;
  intake_event_id?: number | null;
  mode: "production" | "test" | string;
  status: FlowForgeRunStatus;
  current_node_id?: string | null;
  idempotency_key?: string | null;
  run_as_principal_type?: string | null;
  run_as_principal_id?: string | null;
  run_as_principal_display_name?: string | null;
  triggered_by_user_id?: string | null;
  triggered_by_display_name?: string | null;
  run_context: Record<string, unknown>;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FlowForgeRunListResponse {
  workspace_id: string;
  status?: string | null;
  mode?: string | null;
  limit: number;
  offset: number;
  runs: FlowForgePersistedRun[];
}

export interface FlowForgePersistedRunEvent {
  id: number;
  workspace_id: string;
  run_id: number;
  event_type: string;
  node_id?: string | null;
  message?: string | null;
  event_payload: Record<string, unknown>;
  actor_type?: string | null;
  actor_id?: string | null;
  created_at?: string | null;
}

export interface FlowForgeRunEventListResponse {
  workspace_id: string;
  run_id: number;
  limit: number;
  events: FlowForgePersistedRunEvent[];
}

export interface FlowForgeHumanTask {
  id: number;
  workspace_id: string;
  run_id: number;
  task_type: string;
  resource_set_id?: number | null;
  source_record_key?: string | null;
  status: string;
  assigned_to_principal_type?: string | null;
  assigned_to_principal_id?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  response: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FlowForgeHumanTaskListResponse {
  workspace_id: string;
  run_id: number;
  limit: number;
  tasks: FlowForgeHumanTask[];
}

export interface FlowForgeHumanTaskQueueResponse {
  workspace_id: string;
  task_type?: string | null;
  status?: string | null;
  limit: number;
  offset: number;
  tasks: FlowForgeHumanTask[];
}

export interface FlowForgeApprovalDecisionRequest {
  decision_note?: string | null;
  decline_reason?: string | null;
  idempotency_key?: string | null;
}

export interface FlowForgeApprovalDecisionResponse {
  human_task_id: number;
  run_id: number;
  action: "approve" | "decline";
  status: string;
  runtime: Record<string, unknown>;
}

export interface FlowForgeNotification {
  id: number;
  workspace_id: string;
  run_id?: number | null;
  human_task_id?: number | null;
  channel: string;
  recipient: string;
  template_key: string;
  status: string;
  payload_summary: Record<string, unknown>;
  provider_message_id?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  sent_at?: string | null;
  failed_at?: string | null;
}

export interface FlowForgeNotificationListResponse {
  workspace_id: string;
  run_id: number;
  limit: number;
  notifications: FlowForgeNotification[];
}

export interface FlowForgeRunNoteRequest {
  note: string;
  idempotency_key?: string;
}
