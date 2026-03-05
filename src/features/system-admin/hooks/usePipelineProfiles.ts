import { useQuery } from "@tanstack/react-query";
import { fetchPipelineProfiles, fetchPipelineProfile } from "../api";

export function usePipelineProfiles(limit = 50) {
  return useQuery({
    queryKey: ["admin", "pipeline-profiles", limit],
    queryFn: () => fetchPipelineProfiles(limit),
    staleTime: 15_000,
  });
}

export function usePipelineProfile(traceId: string | null) {
  return useQuery({
    queryKey: ["admin", "pipeline-profile", traceId],
    queryFn: () => fetchPipelineProfile(traceId!),
    enabled: !!traceId,
    staleTime: 60_000,
  });
}
