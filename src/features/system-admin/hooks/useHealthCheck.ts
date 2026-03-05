import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { fetchDetailedHealth } from "../api";
import type { HealthCheck, HealthHistoryEntry } from "../types";

const MAX_HISTORY = 20;
const POLL_INTERVAL = 30_000;

export function useHealthCheck() {
  const [history, setHistory] = useState<HealthHistoryEntry[]>([]);
  const lastCheckedRef = useRef<number>(Date.now());

  const query = useQuery<HealthCheck>({
    queryKey: ["admin", "health"],
    queryFn: async () => {
      const data = await fetchDetailedHealth();
      const now = Date.now();
      lastCheckedRef.current = now;
      setHistory((prev) => {
        const next = [...prev, { timestamp: now, data }];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
      return data;
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: 10_000,
  });

  const refreshNow = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    ...query,
    history,
    lastChecked: lastCheckedRef.current,
    refreshNow,
  };
}
