export interface FlowForgeIntegrationSourceField {
  path: string;
  label: string;
  type: string;
  required: boolean;
  sensitive: boolean;
}

export interface FlowForgeIntegrationSourceEvent {
  event_key: string;
  display_name: string;
  description?: string | null;
}

export interface FlowForgeIntegrationConfig {
  id: number;
  workspace_id: string;
  provider: string;
  integration_key: string;
  display_name: string;
  external_form_id?: string | null;
  enabled: boolean;
  mode: string;
  webhook_public_id: string;
  webhook_path: string;
  webhook_url: string;
  webhook_secret?: string | null;
  field_mapping: Record<string, unknown>;
  source_events: FlowForgeIntegrationSourceEvent[];
  source_fields: FlowForgeIntegrationSourceField[];
  test_recipient_overrides: string[];
  settings: Record<string, unknown>;
}

export interface FlowForgeIntegrationTrigger {
  id: number;
  workspace_id: string;
  integration_config_id: number;
  trigger_key: string;
  display_name: string;
  enabled: boolean;
  priority: number;
  trigger_mode: string;
  trigger_policy: string;
  version_strategy: string;
  workflow_definition_id: number;
  workflow_version_id?: number | null;
  condition: Record<string, unknown>;
  field_mapping: Record<string, unknown>;
  no_match_config: Record<string, unknown>;
}

export interface FlowForgeResourceSet {
  id: number;
  workspace_id: string;
  resource_set_key: string;
  display_name: string;
  description?: string | null;
  source_type: string;
  enabled: boolean;
  active_snapshot_batch_id?: number | null;
  settings: Record<string, unknown>;
}

export interface FlowForgeResourceRecord {
  id: number;
  workspace_id?: string;
  resource_set_id?: number;
  snapshot_batch_id?: number | null;
  source_record_key: string;
  display_name?: string | null;
  primary_email?: string | null;
  primary_phone?: string | null;
  status?: string | null;
  effective_status?: string | null;
  availability_status?: string | null;
  capacity_total?: number | string | null;
  capacity_used?: number | string | null;
  capacity_available?: number | string | null;
  current_load?: number | string | null;
  service_area?: string | null;
  timezone?: string | null;
  source_missing?: boolean;
  tags?: unknown[];
  validation_status?: string | null;
  validation_errors: unknown[];
  attributes: Record<string, unknown>;
  normalized_profile: Record<string, unknown>;
}

export interface FlowForgeResourceRecordListResponse {
  resource_set_id: number;
  limit: number;
  offset: number;
  records: FlowForgeResourceRecord[];
}

export interface FlowForgeMatchingPolicy {
  id: number;
  workspace_id: string;
  policy_key: string;
  display_name: string;
  description?: string | null;
  resource_set_id: number;
  status: string;
  current_draft_version_id?: number | null;
  latest_published_version_id?: number | null;
}

export interface FlowForgeMatchingPolicyVersion {
  id: number;
  workspace_id: string;
  matching_policy_id: number;
  resource_set_id: number;
  version_number: number;
  version_status: string;
  policy: Record<string, unknown>;
  validation_status: string;
  validation_result: Record<string, unknown>;
  created_at?: string | null;
  published_at?: string | null;
}

export interface FlowForgeMatchingPolicyLLMDraft {
  id: number;
  workspace_id: string;
  matching_policy_id?: number | null;
  resource_set_id: number;
  prompt: string;
  generated_policy: Record<string, unknown>;
  plain_language_summary?: string | null;
  validation_status: string;
  validation_result: Record<string, unknown>;
  model_provider?: string | null;
  model_name?: string | null;
  status: string;
  created_at?: string | null;
  reviewed_at?: string | null;
}

export interface FlowForgeMatchingSimulation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  eligible_candidates: unknown[];
  excluded_candidates: unknown[];
  ranked_candidates: Array<Record<string, unknown>>;
  selected_candidate?: Record<string, unknown> | null;
  no_match_reason?: string | null;
}

export interface FlowForgeWorkspaceSettings {
  workspace_id: string;
  enabled: boolean;
  allow_designer_publish: boolean;
  raw_payload_retention_days: number;
  raw_payload_retention_max_days: number;
  default_offer_timeout_minutes: number;
  default_no_match_recipients: string[];
  default_test_recipients: string[];
  settings: Record<string, unknown>;
}
