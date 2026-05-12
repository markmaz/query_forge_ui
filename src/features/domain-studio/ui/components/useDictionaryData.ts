// src/features/domain-studio/ui/components/useDictionaryData.ts
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDictionaryColumns,
  fetchDictionaryTables,
  patchDictionaryColumn,
  searchDictionaryColumns,
  WorkspaceDictionaryColumn,
} from "../../../../shared/services/queryStudioAdminApi";
import { isSystemDictionaryTableName } from "../domainTablePresentation";

const GLOBAL_SEARCH_LIMIT = 200;

export interface UseDictionaryDataInput {
  selectedTable: { id: number; name: string } | null;
  activeOnly: boolean;
  qDeferred: string;
  debouncedGlobalSearchTerm: string;
  tableFilter: string;
  includeSystemTables?: boolean;
}

export function useDictionaryData({
  selectedTable,
  activeOnly,
  qDeferred,
  debouncedGlobalSearchTerm,
  tableFilter,
  includeSystemTables = false,
}: UseDictionaryDataInput) {
  const qc = useQueryClient();

  const tableNamesQ = useQuery({
    queryKey: ["dictTables", { q: "" }],
    queryFn: () => fetchDictionaryTables({ q: "", limit: 5000, offset: 0 }),
  });

  const allTableNames = useMemo(() => {
    const rows = tableNamesQ.data?.rows ?? [];
    const seen = new Set<number>();
    const result: Array<{ id: number; name: string; isSystem: boolean }> = [];
    for (const r of rows as any[]) {
      const id = Number(r?.id);
      const name = String(r?.table_name ?? "").trim();
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      result.push({ id, name, isSystem: isSystemDictionaryTableName(name) });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [tableNamesQ.data]);

  const searchableTableNames = useMemo(
    () =>
      includeSystemTables
        ? allTableNames
        : allTableNames.filter((table) => !table.isSystem),
    [allTableNames, includeSystemTables],
  );

  const hiddenSystemTableCount = useMemo(
    () => allTableNames.filter((table) => table.isSystem).length,
    [allTableNames],
  );

  const filteredTableNames = useMemo(() => {
    const f = tableFilter.trim().toLowerCase();
    if (!f) return searchableTableNames;
    return searchableTableNames.filter((t) =>
      t.name.toLowerCase().includes(f),
    );
  }, [searchableTableNames, tableFilter]);

  const modelQ = useQuery({
    queryKey: [
      "dictColumns",
      { workspace_table_id: selectedTable?.id, activeOnly },
    ],
    enabled: !!selectedTable,
    placeholderData: (prev) => prev,
    queryFn: () =>
      fetchDictionaryColumns({
        workspace_table_id: selectedTable!.id,
        q: qDeferred.trim() ? qDeferred : undefined,
        active_only: activeOnly,
      }),
  });

  const rows: WorkspaceDictionaryColumn[] = selectedTable
    ? (modelQ.data?.rows ?? [])
    : [];

  const globalSearchQ = useQuery({
    queryKey: [
      "dictColumnsGlobalSearch",
      { q: debouncedGlobalSearchTerm, activeOnly },
    ],
    enabled: !!debouncedGlobalSearchTerm,
    placeholderData: (prev) => prev,
    queryFn: () =>
      searchDictionaryColumns({
        q: debouncedGlobalSearchTerm,
        limit: GLOBAL_SEARCH_LIMIT,
        active_only: activeOnly,
      }),
  });

  const globalSearchLower = debouncedGlobalSearchTerm.toLowerCase();

  const globalColumnHits = useMemo(() => {
    const source = globalSearchQ.data?.rows ?? [];
    const filtered = source.filter((row) => {
      if (activeOnly && !row.is_active) return false;
      if (
        !includeSystemTables &&
        isSystemDictionaryTableName(row.table_name)
      ) {
        return false;
      }
      return true;
    });
    const seen = new Set<string>();
    const unique: WorkspaceDictionaryColumn[] = [];
    for (const row of filtered) {
      const key = `${row.table_name ?? ""}::${row.column_name}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(row);
    }
    return unique;
  }, [globalSearchQ.data, activeOnly, includeSystemTables]);

  const globalTableResults = useMemo(() => {
    if (!debouncedGlobalSearchTerm)
      return [] as Array<{ id: number; tableName: string; matchCount: number }>;

    const matchCounts = new Map<string, number>();
    const tableEntriesByLower = new Map<string, { id: number; name: string }>();

    for (const row of globalColumnHits) {
      const key = (row.table_name ?? "").toLowerCase();
      if (!tableEntriesByLower.has(key)) {
        const found = searchableTableNames.find(
          (t) => t.name.toLowerCase() === key,
        );
        tableEntriesByLower.set(key, {
          id: found?.id ?? row.workspace_table_id,
          name: row.table_name ?? "",
        });
      }
      const colNameMatch = row.column_name
        .toLowerCase()
        .includes(globalSearchLower);
      const descMatch = (row.description ?? "")
        .toLowerCase()
        .includes(globalSearchLower);
      if (colNameMatch || descMatch) {
        matchCounts.set(key, (matchCounts.get(key) ?? 0) + 1);
      }
    }

    for (const t of searchableTableNames) {
      if (t.name.toLowerCase().includes(globalSearchLower)) {
        const key = t.name.toLowerCase();
        if (!tableEntriesByLower.has(key)) {
          tableEntriesByLower.set(key, { id: t.id, name: t.name });
        }
      }
    }

    const out = Array.from(tableEntriesByLower.entries()).map(
      ([lower, entry]) => ({
        id: entry.id,
        tableName: entry.name,
        matchCount: matchCounts.get(lower) ?? 0,
        nameMatch: lower.includes(globalSearchLower),
      }),
    );

    out.sort((a, b) => {
      if (a.nameMatch !== b.nameMatch) return a.nameMatch ? -1 : 1;
      if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
      return a.tableName.localeCompare(b.tableName);
    });

    return out.map(({ id, tableName, matchCount }) => ({
      id,
      tableName,
      matchCount,
    }));
  }, [
    searchableTableNames,
    globalColumnHits,
    globalSearchLower,
    debouncedGlobalSearchTerm,
  ]);

  const globalColumnResults = useMemo(() => {
    if (!debouncedGlobalSearchTerm) return [] as WorkspaceDictionaryColumn[];

    const filtered = globalColumnHits.filter((row) => {
      const inTable = (row.table_name ?? "")
        .toLowerCase()
        .includes(globalSearchLower);
      const inColumn = row.column_name
        .toLowerCase()
        .includes(globalSearchLower);
      const inDescription = (row.description ?? "")
        .toLowerCase()
        .includes(globalSearchLower);
      return inTable || inColumn || inDescription;
    });

    filtered.sort((a, b) => {
      const tableCmp = (a.table_name ?? "").localeCompare(b.table_name ?? "");
      if (tableCmp !== 0) return tableCmp;
      return a.column_name.localeCompare(b.column_name);
    });

    return filtered;
  }, [debouncedGlobalSearchTerm, globalColumnHits, globalSearchLower]);

  const patchM = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: Partial<
        Pick<
          WorkspaceDictionaryColumn,
          "data_type" | "description" | "is_active"
        >
      >;
    }) => patchDictionaryColumn(id, patch),
    onMutate: async ({ id, patch }) => {
      const key = [
        "dictColumns",
        { workspace_table_id: selectedTable?.id, activeOnly },
      ];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<{ rows: WorkspaceDictionaryColumn[] }>(key);
      if (prev?.rows) {
        qc.setQueryData(key, {
          rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        });
      }
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["dictColumns"] });
      qc.invalidateQueries({ queryKey: ["dictTables"] });
    },
  });

  return {
    allTableNames,
    hiddenSystemTableCount,
    filteredTableNames,
    rows,
    globalColumnHits,
    globalTableResults,
    globalColumnResults,
    patchM,
    tableNamesQ,
    modelQ,
    globalSearchQ,
  };
}
