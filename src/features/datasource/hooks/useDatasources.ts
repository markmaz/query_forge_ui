import { useQuery } from "@tanstack/react-query";
import { fetchDatasources } from "../api/datasourceApi";
import type { Datasource } from "../api/datasourceApi";

export function useDatasources() {
  const query = useQuery<Datasource[], Error>({
    queryKey: ["datasources"],
    queryFn: fetchDatasources,
    staleTime: 5 * 60 * 1000, // 5 minutes — datasource list changes infrequently
  });

  return {
    datasources: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
