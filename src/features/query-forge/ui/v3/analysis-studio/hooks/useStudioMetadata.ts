import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { StudioDomainExplorer, StudioDomainSummary } from "../model/analysisTypes";
import { getStudioDomainExplorer, listStudioDomains } from "../api/studioMetadataApi";

export function useStudioDomains() {
  return useQuery<StudioDomainSummary[]>({
    queryKey: ["query-studio", "domains"],
    queryFn: listStudioDomains,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useStudioDomainExplorer(domainId: number | null) {
  return useQuery<StudioDomainExplorer>({
    queryKey: ["query-studio", "domains", domainId, "explorer"],
    queryFn: () => getStudioDomainExplorer(Number(domainId)),
    enabled: typeof domainId === "number" && domainId > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
