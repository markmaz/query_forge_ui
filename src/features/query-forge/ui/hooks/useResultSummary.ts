import { useQuery } from "@tanstack/react-query";
import { summarizePreview } from "@/shared/services/queryStudioAdminApi";

export interface UseResultSummaryOptions {
  workspaceId: string;
  queryName: string;
  columnNames: string[];
  rows: Record<string, unknown>[];
  enabled: boolean;
}

export interface SummaryResult {
  narrative: string | null;
  highlights: string[];
  comparison: string | null;
  capped: boolean;
  totalRows: number;
}

export interface UseResultSummaryResult {
  summary: SummaryResult | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

function buildQueryKey(
  workspaceId: string,
  queryName: string,
  columnNames: string[],
  rows: Record<string, unknown>[],
) {
  const fingerprint = rows
    .slice(0, 5)
    .map((row) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(row).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    )
    .join("|");
  return [
    "resultSummary",
    workspaceId,
    queryName,
    columnNames.slice().sort().join(","),
    rows.length,
    fingerprint,
  ];
}

export function useResultSummary({
  workspaceId,
  queryName,
  columnNames,
  rows,
  enabled,
}: UseResultSummaryOptions): UseResultSummaryResult {
  const queryKey = buildQueryKey(workspaceId, queryName, columnNames, rows);

  const { data, isFetching, isError, refetch } = useQuery<SummaryResult>({
    queryKey,
    queryFn: async () => {
      const res = await summarizePreview({
        workspace_id: workspaceId,
        query_name: queryName,
        column_names: columnNames,
        rows,
      });
      return {
        narrative: res.narrative || null,
        highlights: res.highlights ?? [],
        comparison: res.comparison ?? null,
        capped: res.capped,
        totalRows: rows.length,
      };
    },
    enabled,
    placeholderData: undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    summary: data ?? null,
    isLoading: isFetching && !data,
    isError,
    retry: () => {
      if (!enabled) return;
      void refetch();
    },
  };
}
