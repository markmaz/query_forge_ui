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
