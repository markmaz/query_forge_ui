import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getIngestionStatus } from "../../../shared/services/ingestion";
import type { IngestionRun } from "../../../shared/services/ingestion";

const SESSION_KEY = "ingestion_job_id";
const TERMINAL_STATES: IngestionRun["status"][] = [
  "completed",
  "failed",
  "canceled",
  "cancelled",
];
const POLL_INTERVAL_MS = 3000;

function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function safeSessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function useSyncJob(jobId: string | null, enabled: boolean) {
  // Resolve effective jobId: prop > sessionStorage
  const [effectiveJobId, setEffectiveJobId] = useState<string | null>(() => {
    if (jobId) return jobId;
    return safeSessionGet(SESSION_KEY);
  });

  // Sync prop → state + sessionStorage
  useEffect(() => {
    if (jobId) {
      setEffectiveJobId(jobId);
      safeSessionSet(SESSION_KEY, jobId);
    }
  }, [jobId]);

  const query = useQuery<IngestionRun, Error>({
    queryKey: ["ingestion", "status", effectiveJobId],
    queryFn: () => getIngestionStatus(effectiveJobId!),
    enabled: enabled && Boolean(effectiveJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL_STATES.includes(status)) return false;
      return POLL_INTERVAL_MS;
    },
  });

  // Clear sessionStorage when terminal
  useEffect(() => {
    if (query.data && TERMINAL_STATES.includes(query.data.status)) {
      safeSessionRemove(SESSION_KEY);
    }
  }, [query.data]);

  const status = query.data?.status ?? null;
  const isPolling =
    enabled &&
    Boolean(effectiveJobId) &&
    status !== null &&
    !TERMINAL_STATES.includes(status);

  return {
    data: query.data,
    status,
    isPolling,
    error: query.error,
    isLoading: query.isLoading,
  };
}
