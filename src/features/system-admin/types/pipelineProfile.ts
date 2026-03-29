export interface PipelineStep {
  index: number;
  label: string;
  ms: number;
}

export interface SharedPipelineTraceNode {
  pipeline_name: string;
  node: string;
  status: string;
  ms?: number;
  summary?: Record<string, unknown>;
  lineage?: string[];
}

export interface SharedPipelineSnapshot {
  pipeline_name: string;
  trace_id: string;
  vertical_norm?: string | null;
  timings_ms?: Record<string, number>;
  debug?: Record<string, unknown>;
  trace_nodes?: SharedPipelineTraceNode[];
  metadata?: Record<string, unknown>;
}

export interface PipelineTraceStepRecord {
  step: string;
  data?: Record<string, unknown>;
}

export interface PipelineTracePayload {
  trace_id?: string;
  workspace_id?: string;
  user_id?: string;
  conversation_id?: string;
  steps?: PipelineTraceStepRecord[];
  response?: {
    debug?: {
      shared_pipeline?: Record<string, SharedPipelineSnapshot>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  log_file?: string;
  trace_enabled?: boolean;
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
  pipeline_trace?: PipelineTracePayload;
}

export interface PipelineProfileListResponse {
  profiles: PipelineProfile[];
  count: number;
}
