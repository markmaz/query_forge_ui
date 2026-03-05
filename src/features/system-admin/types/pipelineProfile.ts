export interface PipelineStep {
  index: number;
  label: string;
  ms: number;
}

export interface PipelineProfile {
  trace_id: string;
  workspace_id: string;
  user_id: string;
  conversation_id: string;
  total_ms: number;
  timestamp: string;
  prompt: string;
  steps: PipelineStep[];
  log_file?: string;
  profiling_enabled?: boolean;
}

export interface PipelineProfileListResponse {
  profiles: PipelineProfile[];
  count: number;
}
