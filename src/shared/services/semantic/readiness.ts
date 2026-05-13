import api from "../api";
import { toServiceError } from "./errors";

export type WorkflowIntelligenceMetricBindings = {
  metric_count: number;
  profile_metric_count: number;
  bound_metric_count: number;
  missing_metric_count: number;
  missing_metric_binding_count: number;
  missing_metrics: string[];
  unbound_metrics: string[];
  bound_metrics: string[];
};

export type WorkflowIntelligenceSemanticDomainReadiness = {
  domain_key: string;
  display_name: string;
  read_model: string;
  registration_status: string;
  status: "ready" | "needs_attention" | string;
  issues: string[];
  suggested_action: string;
  queryforge_launch?: Record<string, unknown> | null;
  expected: {
    metrics: number;
    dimensions: number;
    identifiers: number;
    time_fields: number;
  };
  counts: {
    generated_concept_count: number;
    generated_registry_count: number;
    concept_column_map_count: number;
    semantic_column_map_count: number;
    alias_count: number;
  };
  metric_bindings: WorkflowIntelligenceMetricBindings;
};

export type WorkflowIntelligenceSemanticReadiness = {
  workspace_id: string;
  status: "ready" | "needs_attention" | string;
  summary: {
    domain_count: number;
    ready_domain_count: number;
    issue_domain_count: number;
    generated_concept_count: number;
    generated_registry_count: number;
    concept_column_map_count: number;
    semantic_column_map_count: number;
    alias_count: number;
    metric_count: number;
    bound_metric_count: number;
    missing_metric_binding_count: number;
  };
  domains: WorkflowIntelligenceSemanticDomainReadiness[];
  actions: Array<{
    id: string;
    label: string;
    description: string;
  }>;
};

export type WorkflowIntelligenceSemanticSyncResponse = {
  workspace_id: string;
  dry_run: boolean;
  status: string;
  domain_count?: number;
  registered_count?: number;
  domains?: Array<Record<string, unknown>>;
};

export async function fetchWorkflowIntelligenceSemanticReadiness(): Promise<WorkflowIntelligenceSemanticReadiness> {
  try {
    const response = await api.get("/semantic/registry/workflow-intelligence/readiness");
    return response.data as WorkflowIntelligenceSemanticReadiness;
  } catch (error) {
    throw toServiceError(error, "Unable to load Workflow Intelligence semantic readiness.");
  }
}

export async function syncWorkflowIntelligenceSemanticReadiness(): Promise<WorkflowIntelligenceSemanticSyncResponse> {
  try {
    const response = await api.post("/semantic/registry/workflow-intelligence/sync", {});
    return response.data as WorkflowIntelligenceSemanticSyncResponse;
  } catch (error) {
    throw toServiceError(error, "Unable to sync Workflow Intelligence semantic metadata.");
  }
}
