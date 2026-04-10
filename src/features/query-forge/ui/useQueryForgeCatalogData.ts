import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type {
  BuilderColumnRow,
  Domain,
} from "../../../shared/services/queryStudioAdminApi";
import {
  fetchDomainColumns,
  fetchDomains,
  fetchDomainSummaries,
} from "../../../shared/services/queryStudioAdminApi";

import type { DomainColumnRef } from "../model/domainCatalog";
import type { SqlQueryJson } from "../model/sqlJson";
import { toDomainColumnRef } from "../model/mappers/domainColumns";
import { DOMAIN_SUMMARY_SAMPLE_SIZE, PAGE_SIZE } from "./queryForgePageUtils";

type UseQueryForgeCatalogDataParams = {
  domainId: number | null;
  currentPage: number;
  columnsSearchTerm: string;
  attachmentRows: DomainColumnRef[];
  openTool: string | null;
  sqlJson: SqlQueryJson;
  hasActiveQuery: boolean;
};

export function useQueryForgeCatalogData({
  domainId,
  currentPage,
  columnsSearchTerm,
  attachmentRows,
  openTool,
  sqlJson,
  hasActiveQuery,
}: UseQueryForgeCatalogDataParams) {
  const domainsQ = useQuery({ queryKey: ["domains"], queryFn: fetchDomains });

  const summariesQ = useQuery({
    queryKey: ["domainSummaries", { sample_size: DOMAIN_SUMMARY_SAMPLE_SIZE }],
    queryFn: () =>
      fetchDomainSummaries({ sample_size: DOMAIN_SUMMARY_SAMPLE_SIZE }),
  });

  const domains: Domain[] = domainsQ.data?.rows ?? [];
  const summariesById = useMemo(() => {
    const map = new Map<number, { table_count: number; table_sample: string[] }>();
    (summariesQ.data?.rows ?? []).forEach((row) =>
      map.set(row.id, {
        table_count: row.table_count,
        table_sample: row.table_sample,
      }),
    );
    return map;
  }, [summariesQ.data]);

  const domainOptions = useMemo(() => {
    return domains.map((domain) => {
      const summary = summariesById.get(domain.id);
      return {
        id: String(domain.id),
        name: domain.name,
        description: domain.description ?? null,
        kind: domain.kind ?? null,
        tables: summary?.table_sample ?? [],
        table_count: summary?.table_count ?? 0,
        modelTableId: domain.modelTableId ?? null,
        modelTableName: domain.modelTableName ?? null,
      };
    });
  }, [domains, summariesById]);

  const offset = (currentPage - 1) * PAGE_SIZE;

  const columnsQ = useQuery({
    queryKey: [
      "builderColumns",
      { domainId, columnsSearchTerm, offset, limit: PAGE_SIZE },
    ],
    enabled: domainId != null,
    queryFn: () =>
      fetchDomainColumns({
        domain_id: domainId!,
        column_q: columnsSearchTerm.trim() || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const allColumnsQ = useQuery({
    queryKey: ["allBuilderColumns", { domainId }],
    enabled: domainId != null,
    queryFn: () =>
      fetchDomainColumns({
        domain_id: domainId!,
        column_q: undefined,
        limit: 2000,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const allRows: DomainColumnRef[] = useMemo(() => {
    const rows: BuilderColumnRow[] = allColumnsQ.data?.rows ?? [];
    const base = rows.map(toDomainColumnRef);
    const merged = [...base, ...attachmentRows];
    const seen = new Set<string>();
    const uniq: DomainColumnRef[] = [];
    for (const row of merged) {
      if (seen.has(row.identityKey)) continue;
      seen.add(row.identityKey);
      uniq.push(row);
    }
    return uniq;
  }, [allColumnsQ.data, attachmentRows]);

  const pageRows: DomainColumnRef[] = useMemo(() => {
    const rows: BuilderColumnRow[] = columnsQ.data?.rows ?? [];
    const base = rows.map(toDomainColumnRef);
    const merged = [...base, ...attachmentRows];
    const seen = new Set<string>();
    const uniq: DomainColumnRef[] = [];
    for (const row of merged) {
      if (seen.has(row.identityKey)) continue;
      seen.add(row.identityKey);
      uniq.push(row);
    }
    return uniq;
  }, [columnsQ.data, attachmentRows]);

  const totalColumns = columnsQ.data?.total ?? 0;
  const aiHasSectionContext = openTool !== null;
  const aiSqlJsonContext = useMemo(
    () => (aiHasSectionContext && hasActiveQuery ? sqlJson : null),
    [aiHasSectionContext, hasActiveQuery, sqlJson],
  );

  const aiDomainContext = useMemo(() => {
    if (!aiHasSectionContext) return null;
    return {
      selectedDomainId: sqlJson.domainId ?? null,
      domainCandidates: domainOptions.slice(0, 25).map((domain, idx) => ({
        domainId: Number(domain.id),
        name: domain.name,
        description: domain.description ?? "",
        domainName: domain.name,
        domainKind: domain.kind ?? undefined,
        score: Math.max(0.1, Number((1 - idx * 0.04).toFixed(2))),
      })),
    };
  }, [aiHasSectionContext, domainOptions, sqlJson.domainId]);

  const aiCandidates = useMemo(() => {
    if (!aiHasSectionContext || domainId == null) return null;

    const tableIndex = new Map<
      string,
      { tableName: string; workspaceTableId: number | null; score: number }
    >();
    allRows.forEach((row, idx) => {
      if (tableIndex.has(row.modelTableName)) return;
      tableIndex.set(row.modelTableName, {
        tableName: row.modelTableName,
        workspaceTableId: row.workspaceTableId ?? null,
        score: Math.max(0.05, Number((1 - idx * 0.02).toFixed(2))),
      });
    });

    return {
      tables: Array.from(tableIndex.values())
        .slice(0, 30)
        .map((table) => ({
          tableId: table.workspaceTableId,
          tableName: table.tableName,
          modelTableId: null,
          score: table.score,
          reasons: ["Visible in current domain"],
        })),
      columns: allRows.slice(0, 120).map((row, idx) => ({
        modelColumnId: row.modelColumnId ?? null,
        columnName: row.columnName,
        workspaceTableId: row.workspaceTableId ?? null,
        modelTableId: row.modelTableId ?? null,
        modelTableName: row.modelTableName ?? null,
        label: row.columnLabel ?? row.columnName,
        description: row.description ?? "",
        dataType: row.dataType ?? null,
        score: Math.max(0.05, Number((1 - idx * 0.01).toFixed(2))),
        reasons: ["Visible in builder catalog"],
      })),
    };
  }, [aiHasSectionContext, allRows, domainId]);

  return {
    aiCandidates,
    aiDomainContext,
    aiSqlJsonContext,
    allRows,
    columnsQ,
    domainOptions,
    domainsQ,
    pageRows,
    totalColumns,
  };
}
