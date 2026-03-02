import { useCallback, useState } from "react";

import {
  getExecutionResults,
  getExecutionStatus,
  type ExecutionResultsResponse,
} from "../../../shared/services/executionsApi";

export type ForgeInsightsExecutionResultStatus =
  | "idle"
  | "running"
  | "success"
  | "failed"
  | "timeout";

type StartExecutionResultArgs = {
  jobId: string;
  workspaceId: string;
  signal?: AbortSignal;
  maxDurationMs?: number;
  initialIntervalMs?: number;
};

type StartExecutionResultOutcome = {
  status: ForgeInsightsExecutionResultStatus;
  result: ExecutionResultsResponse | null;
  error: string | null;
  statusText: string | null;
};

const DEFAULT_MAX_DURATION_MS = 60_000;
const DEFAULT_INITIAL_INTERVAL_MS = 1_500;
const MAX_BACKOFF_INTERVAL_MS = 6_000;

function normalizeExecutionStatus(status: unknown): string {
  if (typeof status !== "string") return "UNKNOWN";
  return status.trim().toUpperCase();
}

function isExecutionSuccess(status: string): boolean {
  return status === "SUCCEEDED" || status === "SUCCESS" || status === "COMPLETED";
}

function isExecutionFailed(status: string): boolean {
  return (
    status === "FAILED" ||
    status === "ERROR" ||
    status === "CANCELLED" ||
    status === "CANCELED" ||
    status === "ABORTED"
  );
}

function isExecutionTimeout(status: string): boolean {
  return status === "TIMEOUT" || status === "TIMED_OUT";
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function extractExecutionError(statusResponse: unknown, fallback: string): string {
  if (!statusResponse || typeof statusResponse !== "object") return fallback;
  const record = statusResponse as Record<string, unknown>;
  const candidate = record.error ?? record.message;
  if (typeof candidate !== "string") return fallback;
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : fallback;
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(resolve, ms);
    if (!signal) return;
    const onAbort = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function useForgeInsightsExecutionResult() {
  const [status, setStatus] = useState<ForgeInsightsExecutionResultStatus>("idle");
  const [result, setResult] = useState<ExecutionResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (args: StartExecutionResultArgs): Promise<StartExecutionResultOutcome> => {
      const {
        jobId,
        workspaceId,
        signal,
        maxDurationMs = DEFAULT_MAX_DURATION_MS,
        initialIntervalMs = DEFAULT_INITIAL_INTERVAL_MS,
      } = args;

      setStatus("running");
      setResult(null);
      setError(null);

      const startTs = Date.now();
      let attempt = 0;
      let delayMs = initialIntervalMs;

      try {
        while (Date.now() - startTs < maxDurationMs) {
          if (signal?.aborted) {
            return {
              status: "failed",
              result: null,
              error: "Execution request was cancelled.",
              statusText: null,
            };
          }

          const statusRes = await getExecutionStatus(jobId, { workspaceId, signal });
          const statusText = normalizeExecutionStatus(statusRes.status);

          if (isExecutionSuccess(statusText)) {
            const executionResults = await getExecutionResults(jobId, undefined, {
              workspaceId,
              signal,
            });
            setStatus("success");
            setResult(executionResults);
            setError(null);
            return {
              status: "success",
              result: executionResults,
              error: null,
              statusText,
            };
          }

          if (isExecutionFailed(statusText)) {
            const failureMessage = extractExecutionError(statusRes, "Execution failed.");
            setStatus("failed");
            setResult(null);
            setError(failureMessage);
            return {
              status: "failed",
              result: null,
              error: failureMessage,
              statusText,
            };
          }

          if (isExecutionTimeout(statusText)) {
            const timeoutMessage = "Execution is still running. Try retrying.";
            setStatus("timeout");
            setResult(null);
            setError(timeoutMessage);
            return {
              status: "timeout",
              result: null,
              error: timeoutMessage,
              statusText,
            };
          }

          attempt += 1;
          await sleep(delayMs, signal);
          delayMs = Math.min(initialIntervalMs * Math.pow(1.35, attempt), MAX_BACKOFF_INTERVAL_MS);
        }

        const timeoutMessage = "Execution is still running. Try retrying.";
        setStatus("timeout");
        setResult(null);
        setError(timeoutMessage);
        return {
          status: "timeout",
          result: null,
          error: timeoutMessage,
          statusText: "RUNNING",
        };
      } catch (requestError) {
        const failureMessage = toErrorMessage(requestError, "Unable to fetch execution status.");
        setStatus("failed");
        setResult(null);
        setError(failureMessage);
        return {
          status: "failed",
          result: null,
          error: failureMessage,
          statusText: null,
        };
      }
    },
    []
  );

  return {
    start,
    status,
    result,
    error,
  };
}
