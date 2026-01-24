import api from "./api";
import type { SqlQueryJson } from "../../features/no-code-sql/model/sqlJson";
import type { NoCodeRunMode } from "./noCodeAdminApi";

export type ExecutionStartPayload = {
  sql?: string;
  sqlRendered?: string | null;
  params?: Record<string, any> | any[];
  sqlJson?: SqlQueryJson;
  mode?: NoCodeRunMode;
  warehouse_id?: string | null;
  catalog?: string | null;
  schema?: string | null;
  kind: "query_builder" | "cohort_builder";
  limit?: number | null;
  offset?: number | null;
};

export type ExecutionStartResponse = {
  jobId: string;
  statementId: string;
};

export type ExecutionStatusResponse = {
  jobId: string;
  statementId: string;
  status: string;
  raw?: any;
};

export type ExecutionResultsResponse = {
  rows?: any[];
  columns?: any[];
  total?: number | null;
  totalRowCount?: number | null;
  sql?: string;
  sqlRendered?: string;
  params?: Record<string, any>;
  limit?: number | null;
  offset?: number | null;
  [key: string]: any;
};

export async function startExecution(payload: ExecutionStartPayload): Promise<ExecutionStartResponse> {
  const res = await api.post<ExecutionStartResponse>("/executions/start", payload);
  return res.data;
}

export async function getExecutionStatus(jobId: string): Promise<ExecutionStatusResponse> {
  const res = await api.get<ExecutionStatusResponse>(`/executions/${jobId}/status`);
  return res.data;
}

export async function getExecutionResults(
  jobId: string,
  params?: { limit?: number; offset?: number }
): Promise<ExecutionResultsResponse> {
  const res = await api.get<ExecutionResultsResponse>(`/executions/${jobId}/results`, { params });
  return res.data;
}

export async function cancelExecution(statementId: string): Promise<void> {
  await api.post(`/executions/${statementId}/cancel`);
}
