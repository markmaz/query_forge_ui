export interface ServiceCheck {
  status: "ok" | "degraded" | "error";
  latency_ms?: number;
  error?: string;
  url?: string;
  version?: string;
}

export interface VllmCheck extends ServiceCheck {
  model?: string;
  upstream?: Record<string, unknown>;
}

export interface WorkspaceLLMHealthItem {
  id?: number | null;
  name: string;
  provider: string;
  model: string;
  role: string;
  endpoint?: string;
  active: boolean;
  status: "ok" | "error";
  latency_ms?: number | null;
  message?: string;
}

export interface WorkspaceLLMHealthCheck {
  status: "ok" | "degraded" | "error";
  workspace_id?: string | null;
  total_count?: number | null;
  active_count?: number | null;
  healthy_count?: number | null;
  failed_count?: number | null;
  active_failed_count?: number | null;
  latency_ms?: number | null;
  llms: WorkspaceLLMHealthItem[];
  issues?: string[];
  error?: string;
}

export interface BrokerValkeyCheck {
  address?: string;
  port?: number;
  ping_ok: boolean;
  ping_response?: string | null;
  error?: string | null;
}

export interface BrokerCeleryCheck {
  broker_connect_ok: boolean;
  broker_error?: string | null;
  worker_ping_ok: boolean;
  workers: string[];
  worker_error?: string | null;
}

export interface BrokerCheck {
  status: "ok" | "degraded" | "error";
  ok: boolean;
  broker_url?: string;
  valkey: BrokerValkeyCheck;
  celery: BrokerCeleryCheck;
}

export interface FlowForgeWorkerHealth {
  healthy: boolean;
  reason?: string | null;
  last_dispatch_at?: string | null;
  seconds_since_dispatch?: number | null;
  task_name?: string | null;
}

export interface FlowForgeOperationalMetrics {
  pending_notification_count: number | null;
  failed_notification_count: number | null;
  stuck_run_count: number | null;
  failed_run_count: number | null;
  schedule_backlog_count?: number | null;
  failed_import_count?: number | null;
  failed_export_count?: number | null;
  stuck_approval_count?: number | null;
  invalid_production_run_as_count?: number | null;
  expired_artifact_count?: number | null;
  artifact_retention_pending_count?: number | null;
  workflow_intelligence_domain_drift_count?: number | null;
  stuck_run_threshold_minutes?: number;
  failed_run_window_hours?: number;
  schedule_backlog_threshold_minutes?: number;
  approval_stale_threshold_hours?: number;
}

export interface FlowForgeWorkflowIntelligenceDomainHealth {
  domain_key: string;
  read_model: string;
  registration_status: string;
  registration_issues: string[];
}

export interface FlowForgeHealthCheck {
  status: "ok" | "degraded" | "error";
  worker: FlowForgeWorkerHealth;
  metrics: FlowForgeOperationalMetrics;
  workflow_intelligence_domains?: FlowForgeWorkflowIntelligenceDomainHealth[];
  issues?: string[];
  error?: string;
}

export interface HealthCheck {
  overall: "healthy" | "degraded" | "unhealthy";
  checks: {
    app: ServiceCheck;
    mysql: ServiceCheck;
    vllm?: VllmCheck;
    llms?: WorkspaceLLMHealthCheck;
    qdrant: ServiceCheck;
    mcp?: ServiceCheck;
    broker?: BrokerCheck;
    flowforge?: FlowForgeHealthCheck;
  };
}

export interface HealthHistoryEntry {
  timestamp: number;
  data: HealthCheck;
}
