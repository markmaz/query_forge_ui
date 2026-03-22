import { ingestionClient } from "./clients/ingestionClient";

export interface SyncRequest {
  datasource?: string | null;
  catalog: string | null;
  schema: string;
  table_names: string[] | null;
  run_profiling: boolean;
  run_enrichment: boolean;
  overwrite_descriptions: boolean;
}

export interface IngestionRun {
  id: string;
  datasource: string;
  catalog: string | null;
  schema_name: string;
  table_names: string[] | null;
  run_profiling: boolean;
  run_enrichment: boolean;
  status: string;
  tables_total: number;
  tables_done: number;
  tables_failed: number;
  tables_created: number;
  tables_updated: number;
  columns_total?: number;
  columns_done?: number;
  columns_failed?: number;
  columns_created: number;
  columns_updated: number;
  current_phase?: string | null;
  current_table?: string | null;
  current_column?: string | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface IngestionDiagnostics {
  celery_state: string | null;
  in_worker_queues: string[];
  age_seconds: number | null;
  stale_candidate: boolean;
  stale_threshold_seconds: number | null;
}

export interface CancelIngestionResponse {
  canceled?: boolean;
  message?: string;
  status?: string | null;
}

export const startSync = async (
  payload: SyncRequest,
): Promise<{ job_id: string }> => {
  const response = await ingestionClient.startSync(payload);
  return response.data;
};

export const getIngestionStatus = async (
  jobId: string,
): Promise<IngestionRun> => {
  const response = await ingestionClient.getStatus(jobId);
  return response.data;
};

export const getIngestionHistory = async (): Promise<IngestionRun[]> => {
  const response = await ingestionClient.getHistory();
  return response.data;
};

export const getIngestionDiagnostics = async (
  jobId: string,
): Promise<IngestionDiagnostics> => {
  const response = await ingestionClient.getDiagnostics(jobId);
  return response.data;
};

export const cancelIngestionRun = async (
  jobId: string,
): Promise<CancelIngestionResponse> => {
  const response = await ingestionClient.cancelRun(jobId);
  return response.data;
};

export async function getSchemas(
  catalog: string | null,
): Promise<string[]> {
  const response = await ingestionClient.getSchemas(catalog);
  return response.data.schemas;
}
