import api from "./api";
import type { SqlQueryJson } from "../../features/query-forge/model/sqlJson";

export type ExecutionStartPayload = {
  sqlJson: SqlQueryJson;
  kind: "query_builder" | "cohort_builder";
  limit?: number | null;
  offset?: number | null;
  datasource?: string | null;
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
  [key: string]: any;
};

export type ExecutionResultsResponse = {
  rows?: Record<string, unknown>[];
  columns?: Array<{ key: string; label?: string; dataType?: string } | string>;
  total?: number | null;
  totalRowCount?: number | null;
  sql?: string;
  sqlRendered?: string;
  params?: Record<string, any>;
  limit?: number | null;
  offset?: number | null;
  assistant_message?: {
    role: "assistant";
    content: string;
    kind: "execution_result";
    format: "markdown" | "text";
  } | null;
  [key: string]: any;
};

const OUTDATED_REQUEST_FORMAT_MESSAGE =
  "Request format outdated, please refresh and try again.";

const getErrorResponse = (
  error: unknown,
): { status?: number; data?: { error?: string; message?: string } } | null => {
  if (!error || typeof error !== "object") return null;
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== "object") return null;
  return response as {
    status?: number;
    data?: { error?: string; message?: string };
  };
};

const isRawSqlRejected = (error: unknown): boolean => {
  const response = getErrorResponse(error);
  if (!response || response.status !== 400) return false;
  const data = response.data;
  const message = String(data?.error ?? data?.message ?? "");
  return /raw sql fields are not allowed/i.test(message);
};

export async function startExecution(
  payload: ExecutionStartPayload,
): Promise<ExecutionStartResponse> {
  const { datasource, ...body } = payload;
  const params =
    datasource && datasource !== "primary" ? { datasource } : undefined;
  try {
    const res = await api.post<ExecutionStartResponse>(
      "/executions/start",
      body,
      { params },
    );
    return res.data;
  } catch (error) {
    if (isRawSqlRejected(error)) {
      throw new Error(OUTDATED_REQUEST_FORMAT_MESSAGE);
    }
    throw error;
  }
}

export async function getExecutionStatus(
  jobId: string,
  options?: { workspaceId?: string | null; signal?: AbortSignal },
): Promise<ExecutionStatusResponse> {
  const res = await api.get<ExecutionStatusResponse>(
    `/executions/${jobId}/status`,
    {
      signal: options?.signal,
      headers: options?.workspaceId
        ? { "X-Workspace-Id": options.workspaceId }
        : undefined,
    },
  );
  return res.data;
}

export async function getExecutionResults(
  jobId: string,
  params?: { limit?: number; offset?: number },
  options?: { workspaceId?: string | null; signal?: AbortSignal },
): Promise<ExecutionResultsResponse> {
  const res = await api.get<ExecutionResultsResponse>(
    `/executions/${jobId}/results`,
    {
      params,
      signal: options?.signal,
      headers: options?.workspaceId
        ? { "X-Workspace-Id": options.workspaceId }
        : undefined,
    },
  );
  return res.data;
}

export async function cancelExecution(statementId: string): Promise<void> {
  await api.post(`/executions/${statementId}/cancel`);
}
