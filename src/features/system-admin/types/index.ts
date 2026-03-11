export * from "./health";
export * from "./pipelineProfile";
export * from "./vectorIndex";
export * from "./domainProfile";
export * from "./promptFeedback";
export * from "./tenancy";
export * from "./semanticCatalog";

export interface ApiError {
  error: string;
  status_code: number;
  details: Record<string, unknown>;
}

// ── Workspace LLM ─────────────────────────────────────────────────────────

export type LLMRole =
  | "planner"
  | "ner"
  | "summarizer"
  | "query_generator"
  | "enrichment";

export type LLMProvider =
  | "openai"
  | "anthropic"
  | "azure_openai"
  | "ollama"
  | "generic";

export interface WorkspaceLLM {
  id: number;
  workspace_id: string;
  name: string;
  provider: LLMProvider;
  model_name: string;
  role: LLMRole;
  has_api_key: boolean;
  masked_api_key: string | null;
  endpoint_url: string | null;
  is_active: boolean;
  config_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceLLMCreateRequest {
  name: string;
  provider: LLMProvider;
  model_name: string;
  role: LLMRole;
  api_key?: string;
  endpoint_url?: string | null;
  is_active?: boolean;
  config_json?: Record<string, unknown> | null;
}

export interface WorkspaceLLMUpdateRequest extends Partial<WorkspaceLLMCreateRequest> {}

export interface LLMRoleOption {
  value: LLMRole;
  label: string;
}

export interface LLMProviderOption {
  value: LLMProvider;
  label: string;
}

export interface LLMTestResult {
  success: boolean;
  message: string;
}
