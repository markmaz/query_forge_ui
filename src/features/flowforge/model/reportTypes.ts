export interface FlowForgeReportingField {
  key: string;
  label: string;
}

export interface FlowForgeReportingFilter {
  field: string;
  operator: string;
  value: unknown;
}

export interface FlowForgeReportingDomain {
  workspace_id: string;
  domain_key: string;
  display_name: string;
  description: string;
  read_model: string;
  semantic_registered: boolean;
  registration_status?: string;
  registration_issues?: string[];
  domain_group?: string;
  domain_source?: string;
  queryforge_visibility?: "enabled" | "hidden" | "admin_only" | string;
  workspace_scope_field?: string;
  mode_field?: string;
  time_fields?: string[];
  identifiers?: string[];
  queryforge_launch?: {
    source?: string;
    domain_key?: string;
    domain_id?: number | null;
    read_model?: string;
    domain_group?: string;
    domain_source?: string;
    default_filters?: FlowForgeReportingFilter[];
    starter_prompt?: string | null;
  };
  default_filters: FlowForgeReportingFilter[];
  sensitive_excluded_fields: string[];
  query_studio_prompts: string[];
  metrics: FlowForgeReportingField[];
  dimensions: FlowForgeReportingField[];
}

export interface FlowForgeReportDashboard {
  workspace_id: string;
  mode: "production" | "test" | string;
  default_filters: FlowForgeReportingFilter[];
  metrics: Record<string, number>;
  domains: FlowForgeReportingDomain[];
}

export interface FlowForgeReportingDomainSyncDomain {
  workspace_id: string;
  domain_key: string;
  read_model: string;
  registration_status: string;
  registration_issues: string[];
  queryforge_launch?: FlowForgeReportingDomain["queryforge_launch"];
  registration_payload?: Record<string, unknown> | null;
}

export interface FlowForgeReportingDomainSync {
  workspace_id: string;
  dry_run: boolean;
  status: "ok" | "issues_found" | string;
  domain_count: number;
  registered_count: number;
  domains: FlowForgeReportingDomainSyncDomain[];
}

export type FlowForgeIntakeReviewOutcome = "accepted" | "not_accepted" | "pending" | string;

export interface FlowForgeIntakeReviewEvent {
  intake_event_id: number;
  date: string;
  received_at?: string | null;
  provider?: string | null;
  external_submission_id?: string | null;
  run_id?: number | null;
  run_status?: string | null;
  workflow_key?: string | null;
  outcome: FlowForgeIntakeReviewOutcome;
  outcome_label: string;
  accepted_by?: string | null;
  accepted_resource_set_id?: number | null;
  accepted_source_record_key?: string | null;
  no_match_reason?: string | null;
  raw_payload_available: boolean;
}

export interface FlowForgeIntakeReviewBucket {
  date: string;
  intake_count: number;
  accepted_count: number;
  not_accepted_count: number;
  pending_count: number;
  events: FlowForgeIntakeReviewEvent[];
}

export interface FlowForgeIntakeReviewTimeline {
  workspace_id: string;
  mode: "production" | "test" | string;
  days: number;
  buckets: FlowForgeIntakeReviewBucket[];
}

export interface FlowForgeIntakeRawForm {
  workspace_id: string;
  intake_event_id: number;
  provider?: string | null;
  external_form_id?: string | null;
  external_submission_id?: string | null;
  mode?: string | null;
  received_at?: string | null;
  raw_payload_available: boolean;
  raw_payload_redacted_at?: string | null;
  raw_payload_redacted_by?: string | null;
  raw_payload_expires_at?: string | null;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
}
