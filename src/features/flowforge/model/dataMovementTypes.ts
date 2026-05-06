export interface FlowForgeDataSource {
  id?: number | null;
  workspace_id: string;
  source_key: string;
  display_name: string;
  source_type: string;
  enabled: boolean;
  mode: string;
  config: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FlowForgeDataDestination {
  id?: number | null;
  workspace_id: string;
  destination_key: string;
  display_name: string;
  destination_type: string;
  enabled: boolean;
  mode: string;
  config: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FlowForgeDataMovementConnectionTest {
  ok: boolean;
  key: string;
  kind: string;
  type: string;
  mode: string;
  enabled: boolean;
  message: string;
}

export interface FlowForgeDatasetArtifact {
  id: number;
  workspace_id: string;
  run_id?: number | null;
  node_id?: string | null;
  artifact_key: string;
  artifact_type: string;
  storage_kind: string;
  storage_ref: Record<string, unknown>;
  schema: Record<string, unknown>;
  row_count?: number | null;
  byte_count?: number | null;
  checksum?: string | null;
  status: string;
  expires_at?: string | null;
  created_at?: string | null;
}

export interface FlowForgeDatasetArtifactListResponse {
  run_id?: number | null;
  limit: number;
  offset: number;
  artifacts: FlowForgeDatasetArtifact[];
}

export interface FlowForgeDataMovementAudit {
  id: number;
  workspace_id: string;
  run_id?: number | null;
  node_id?: string | null;
  action_type: string;
  status: string;
  source_key?: string | null;
  destination_key?: string | null;
  dataset_artifact_id?: number | null;
  resource_set_id?: number | null;
  actor_type?: string | null;
  actor_id?: string | null;
  request: Record<string, unknown>;
  result: Record<string, unknown>;
  error_message?: string | null;
  idempotency_key?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface FlowForgeDataMovementAuditListResponse {
  run_id?: number | null;
  limit: number;
  offset: number;
  audit: FlowForgeDataMovementAudit[];
}
