export interface Synonym {
  term: string;
  means: string[];
}

export interface Acronym {
  abbr: string;
  expansion: string;
}

export interface DomainProfile {
  id: number;
  workspace_id: string;
  domain_id: number;
  summary: string | null;
  keywords: string[] | null;
  entities: string[] | null;
  metrics: string[] | null;
  attributes: string[] | null;
  synonyms: Synonym[] | null;
  acronyms: Acronym[] | null;
  notes: string | null;
  embedding_text: string | null;
  content_hash: string | null;
  embedding_model: string | null;
  embedded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  domain_name: string | null;
}

export interface DomainProfileCreateRequest {
  domain_id: number;
  summary?: string;
  keywords?: string[];
  entities?: string[];
  metrics?: string[];
  attributes?: string[];
  synonyms?: Synonym[];
  acronyms?: Acronym[];
  notes?: string;
  embedding_text?: string;
}

export interface DomainProfileUpdateRequest {
  summary?: string;
  keywords?: string[];
  entities?: string[];
  metrics?: string[];
  attributes?: string[];
  synonyms?: Synonym[];
  acronyms?: Acronym[];
  notes?: string;
  embedding_text?: string;
}

export interface DomainProfileListResponse {
  profiles: DomainProfile[];
  count: number;
}

export interface DomainProfileDeleteResponse {
  deleted: boolean;
  workspace_id: string;
  domain_id: number;
}

export interface DomainProfileGenerateRequest {
  force?: boolean;
}

export interface DomainProfileGenerateBatchRequest {
  domain_ids: number[];
  force?: boolean;
}

export interface DomainProfileGenerateAllRequest {
  force?: boolean;
  include_inactive?: boolean;
}

export interface DomainProfileGenerationResultRow {
  domain_id: number;
  status: string;
  trace_id?: string | null;
  generation_time_ms?: number | null;
  error?: string | null;
  domain_name?: string | null;
}

export type DomainProfileMetricKind = "count" | "numeric" | "ratio" | "custom";

export type DomainProfileMetricAgg =
  | "count"
  | "count_distinct"
  | "sum"
  | "avg"
  | "min"
  | "max";

export interface DomainProfileMetricConfigRow {
  metric_key: string;
  label: string;
  kind: DomainProfileMetricKind;
  agg: DomainProfileMetricAgg;
  column_key: string | null;
  sql_metric: Record<string, unknown> | null;
}

export interface DomainProfileMetricsResponse {
  domain_id: number;
  domain_name: string | null;
  metrics: DomainProfileMetricConfigRow[];
  has_profile: boolean;
  can_edit: boolean;
}

export type DomainCalendarMode = "calendar" | "fiscal";
export type DomainWeekStart = "monday" | "sunday";
export type DomainDefaultGrain = "day" | "week" | "month" | "quarter" | "year" | null;

export interface DomainTimePolicy {
  calendar_mode: DomainCalendarMode;
  fiscal_year_start_month: number | null;
  timezone: string | null;
  week_start: DomainWeekStart;
  default_time_concept_key: string | null;
  allow_relative_ranges: boolean;
  default_grain: DomainDefaultGrain;
  prefer_time_object_over_filter: boolean;
  strict_mode: boolean;
  relative_map: Record<string, string>;
  notes: string | null;
}

export interface DomainTimePolicyResponse {
  domain_id: number;
  domain_name: string | null;
  has_policy: boolean;
  can_edit: boolean;
  policy: DomainTimePolicy;
}
