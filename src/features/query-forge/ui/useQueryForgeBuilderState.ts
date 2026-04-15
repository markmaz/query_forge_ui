import { useEffect, useMemo } from "react";

import type { DomainColumnRef } from "../model/domainCatalog";
import {
  colKey,
  labelFor,
  type CohortAttachment,
  type SqlAggregationsJson,
  type SqlColumnKey,
  type SqlColumnRef,
  type SqlDataPrepJson,
  type SqlFilterNode,
  type SqlQueryJson,
  type SqlSort,
  type ValueOverrideAttachment,
} from "../model/sqlJson";
import {
  normalizeColumns,
  removeSelectedColumn,
  upsertSelectedColumn,
} from "../model/columnsUtil";
import {
  colsSig,
  getExcludeErrorRowsFromMeta,
} from "./queryForgePageUtils";

type UseQueryForgeBuilderStateParams = {
  sqlJson: SqlQueryJson;
  attachmentRows: DomainColumnRef[];
  allRows: DomainColumnRef[];
  pageRows: DomainColumnRef[];
  updateSqlJson: (updater: (cur: SqlQueryJson) => SqlQueryJson) => void;
  distinctBeforeAggsRef: { current: boolean | null };
};

export function useQueryForgeBuilderState({
  sqlJson,
  attachmentRows,
  allRows,
  pageRows,
  updateSqlJson,
  distinctBeforeAggsRef,
}: UseQueryForgeBuilderStateParams) {
  const prompt = sqlJson.prompt ?? sqlJson.meta?.prompt ?? "";
  const excludeErrorRows = getExcludeErrorRowsFromMeta(sqlJson.meta);
  const aggsActive =
    (sqlJson.aggs?.metrics?.length ?? 0) > 0 ||
    (sqlJson.aggs?.groupBy?.length ?? 0) > 0;

  const attachmentKeys = useMemo<SqlColumnKey[]>(() => {
    return attachmentRows.map((row) => ({
      modelColumnId: null,
      columnName: row.columnName,
      workspaceTableId:
        typeof row.workspaceTableId === "number" ? row.workspaceTableId : null,
      exprId: row.identityKey.startsWith("expr:")
        ? row.identityKey.slice(5)
        : null,
    }));
  }, [attachmentRows]);

  const derivedColumnKeys: SqlColumnKey[] = useMemo(() => {
    const rules = sqlJson.dataPrep?.rules ?? [];
    const out: SqlColumnKey[] = [];

    for (const rule of rules) {
      if (!rule || rule.enabled === false) continue;
      const output = rule.output;
      if (!output?.columnName) continue;

      out.push({
        modelColumnId: null,
        columnName: output.columnName,
        workspaceTableId: null,
        exprId: output.exprId ?? rule.id,
        alias: (output as any).alias ?? output.columnName,
      });
    }

    const seenOut = new Set<string>();
    const uniq: SqlColumnKey[] = [];
    for (const key of out) {
      const ck = colKey(key);
      if (seenOut.has(ck)) continue;
      seenOut.add(ck);
      uniq.push(key);
    }

    uniq.sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
    const merged = [...uniq, ...attachmentKeys];
    const seenMerged = new Set<string>();
    const outMerged: SqlColumnKey[] = [];
    for (const key of merged) {
      const ck = colKey(key);
      if (seenMerged.has(ck)) continue;
      seenMerged.add(ck);
      outMerged.push(key);
    }
    outMerged.sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
    return outMerged;
  }, [attachmentKeys, sqlJson.dataPrep]);

  const availableColumnKeys: SqlColumnKey[] = useMemo(() => {
    const base: SqlColumnKey[] = sqlJson.columns.map((column) => ({
      modelColumnId: column.modelColumnId ?? null,
      columnName: column.columnName,
      workspaceTableId: (column as any).workspaceTableId ?? null,
      exprId: column.exprId ?? null,
      alias: column.alias ?? null,
    }));

    const all = [...base, ...derivedColumnKeys];
    const seen = new Set<string>();
    const uniq: SqlColumnKey[] = [];
    for (const key of all) {
      const ck = colKey(key);
      if (seen.has(ck)) continue;
      seen.add(ck);
      uniq.push(key);
    }
    return uniq;
  }, [derivedColumnKeys, sqlJson.columns]);

  const selectedColumns: SqlColumnKey[] = useMemo(() => {
    return (sqlJson.columns ?? []).map((column) => ({
      modelColumnId: column.modelColumnId ?? null,
      columnName: column.columnName,
      workspaceTableId: (column as any).workspaceTableId ?? null,
      exprId: column.exprId ?? null,
      alias: column.alias ?? null,
    }));
  }, [sqlJson.columns]);

  const aliasByKey = useMemo(() => {
    const map = new Map<string, string>();
    (sqlJson.columns ?? []).forEach((column) => {
      const alias = (column.alias ?? "").trim();
      if (!alias) return;
      const key: SqlColumnKey = {
        modelColumnId: column.modelColumnId ?? null,
        columnName: column.columnName,
        workspaceTableId: (column as any).workspaceTableId ?? null,
        exprId: column.exprId ?? null,
      };
      map.set(colKey(key), alias);
    });
    return map;
  }, [sqlJson.columns]);

  const columnKeyByIdentity = useMemo(() => {
    const map = new Map<string, SqlColumnKey>();
    for (const row of allRows) {
      if (!row.identityKey || map.has(row.identityKey)) continue;
      if (row.identityKey.startsWith("expr:")) {
        map.set(row.identityKey, {
          modelColumnId: null,
          columnName: row.columnName,
          workspaceTableId: null,
          exprId: row.identityKey.slice(5),
        });
        continue;
      }
      map.set(row.identityKey, {
        modelColumnId: row.modelColumnId ?? null,
        columnName: row.columnName,
        workspaceTableId: row.workspaceTableId ?? null,
        exprId: null,
      });
    }
    return map;
  }, [allRows]);

  const columnKeyByName = useMemo(() => {
    const map = new Map<string, SqlColumnKey>();
    for (const row of allRows) {
      if (!row.columnName || map.has(row.columnName)) continue;
      if (row.identityKey.startsWith("expr:")) {
        map.set(row.columnName, {
          modelColumnId: null,
          columnName: row.columnName,
          workspaceTableId: null,
          exprId: row.identityKey.slice(5),
        });
        continue;
      }
      map.set(row.columnName, {
        modelColumnId: row.modelColumnId ?? null,
        columnName: row.columnName,
        workspaceTableId: row.workspaceTableId ?? null,
        exprId: null,
      });
    }
    return map;
  }, [allRows]);

  const identityKeyByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of allRows) {
      if (!row.columnName || map.has(row.columnName)) continue;
      map.set(row.columnName, row.identityKey);
    }
    return map;
  }, [allRows]);

  const allColumnKeysForFilters = useMemo(() => {
    const base: SqlColumnKey[] = allRows.map((row: any) => {
      const exprId = row.identityKey?.startsWith("expr:")
        ? row.identityKey.slice(5)
        : null;
      const key: SqlColumnKey = {
        modelColumnId: row.modelColumnId ?? null,
        columnName: row.columnName,
        workspaceTableId: row.workspaceTableId ?? null,
        exprId,
      };
      (key as any).dataType = row.dataType ?? row.data_type ?? null;
      const alias = aliasByKey.get(colKey(key)) ?? null;
      return { ...key, alias };
    });

    const withDerived = [...base, ...derivedColumnKeys];
    const seen = new Set<string>();
    const uniq: SqlColumnKey[] = [];
    for (const key of withDerived) {
      const ck = colKey(key);
      if (seen.has(ck)) continue;
      seen.add(ck);
      uniq.push(key);
    }
    return uniq;
  }, [aliasByKey, allRows, derivedColumnKeys]);

  const selectedColumnKeysForUi = useMemo(() => {
    return selectedColumns
      .map((column) => {
        if (column.exprId) return `expr:${column.exprId}`;
        const columnName =
          typeof column.columnName === "string" ? column.columnName : "";
        if (!columnName) return "";
        if (typeof column.workspaceTableId === "number") {
          return `${column.workspaceTableId}:${columnName}`;
        }
        return identityKeyByName.get(columnName) ?? columnName;
      })
      .filter((key): key is string => Boolean(key));
  }, [identityKeyByName, selectedColumns]);

  const keyForColumnName = (name: string): SqlColumnKey => {
    return (
      columnKeyByName.get(name) ?? {
        modelColumnId: null,
        columnName: name,
        workspaceTableId: null,
        exprId: null,
      }
    );
  };

  const keyForColumnIdentityKey = (key: string): SqlColumnKey => {
    const hit = columnKeyByIdentity.get(key);
    if (hit) return hit;

    if (key.startsWith("expr:")) {
      const exprId = key.slice(5);
      return {
        modelColumnId: null,
        columnName: exprId,
        workspaceTableId: null,
        exprId,
      };
    }

    if (key.startsWith("wt:")) {
      const match = key.match(/^wt:(\d+)\|name:(.+)$/);
      if (match) {
        return {
          modelColumnId: null,
          columnName: match[2],
          workspaceTableId: Number(match[1]),
          exprId: null,
        };
      }
    }

    if (key.startsWith("id:")) {
      const id = Number(key.slice(3));
      if (!Number.isNaN(id)) {
        const row = allRows.find((candidate) => candidate.modelColumnId === id);
        return {
          modelColumnId: id,
          columnName: row?.columnName ?? key,
          workspaceTableId: row?.workspaceTableId ?? null,
          exprId: null,
        };
      }
    }

    if (key.startsWith("name:")) {
      return keyForColumnName(key.slice(5));
    }

    const idx = key.indexOf(":");
    if (idx > 0 && /^[0-9]+:/.test(key)) {
      const wtId = Number(key.slice(0, idx));
      const name = key.slice(idx + 1);
      if (!Number.isNaN(wtId) && name) {
        return {
          modelColumnId: null,
          columnName: name,
          workspaceTableId: wtId,
          exprId: null,
        };
      }
    }

    return keyForColumnName(key);
  };

  const setPrompt = (value: string) => {
    updateSqlJson((cur) => ({
      ...cur,
      prompt: value,
      meta: { ...(cur.meta ?? {}), prompt: value },
    }));
  };

  const setColumnsInJson = (nextCols: SqlColumnRef[]) => {
    updateSqlJson((cur) => {
      const curCols = (cur.columns ?? []) as SqlColumnRef[];
      if (colsSig(curCols) === colsSig(nextCols)) return cur;

      const deduped = normalizeColumns(nextCols);
      const keep = new Set(deduped.map((column) => colKey(column)));
      const nextGroupBy = (cur.aggs?.groupBy ?? []).filter((groupBy) =>
        keep.has(colKey(groupBy)),
      );

      return {
        ...cur,
        columns: deduped,
        sorting: (cur.sorting ?? []).filter((sorting) =>
          keep.has(colKey(sorting.col)),
        ),
        aggs: cur.aggs
          ? {
              ...cur.aggs,
              groupBy: nextGroupBy,
              enabled:
                (cur.aggs.metrics ?? []).length > 0 || nextGroupBy.length > 0,
            }
          : cur.aggs,
      };
    });
  };

  const setDomainIdInJson = (next: number | null) => {
    updateSqlJson((cur) => {
      if (next === cur.domainId) return cur;
      return {
        ...cur,
        domainId: next,
        columns: [],
        sorting: [],
        aggs: { enabled: false, metrics: [], groupBy: [], derivedMetrics: [] },
        filters: null,
        dataPrep: null,
        distinct: true,
        value_overrideAttachments: [],
        cohortAttachment: null,
      };
    });
  };

  const setValueOverrideAttachments = (next: ValueOverrideAttachment[]) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.value_overrideAttachments ?? []);
      const nextSig = JSON.stringify(next ?? []);
      if (curSig === nextSig) return cur;
      return { ...cur, value_overrideAttachments: next ?? [] };
    });
  };

  const setCohortAttachment = (next: CohortAttachment | null) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.cohortAttachment ?? null);
      const nextSig = JSON.stringify(next ?? null);
      if (curSig === nextSig) return cur;
      return { ...cur, cohortAttachment: next ?? null };
    });
  };

  const setSortingInJson = (next: SqlSort[]) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.sorting ?? []);
      const nextSig = JSON.stringify(next ?? []);
      if (curSig === nextSig) return cur;
      return { ...cur, sorting: next ?? [] };
    });
  };

  const setDataPrepInJson = (next: SqlDataPrepJson | null) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.dataPrep ?? null);
      const nextSig = JSON.stringify(next ?? null);
      if (curSig === nextSig) return cur;

      const collectExprIds = (rules?: SqlDataPrepJson["rules"]) => {
        const ids: string[] = [];
        for (const rule of rules ?? []) {
          const output = (rule as any).output as SqlColumnKey | undefined;
          const exprId = (output as any)?.exprId ?? (rule as any).id ?? null;
          if (exprId) ids.push(String(exprId));
        }
        return ids;
      };

      const derivedExprIds = new Set([
        ...collectExprIds(cur.dataPrep?.rules ?? []),
        ...collectExprIds(next?.rules ?? []),
      ]);

      const filteredColumns = (cur.columns ?? []).filter((column) => {
        const exprId = (column as any).exprId ?? null;
        if (!exprId) return true;
        return !derivedExprIds.has(String(exprId));
      });

      return {
        ...cur,
        dataPrep: next ?? null,
        columns: normalizeColumns(filteredColumns),
      };
    });
  };

  const setAggsInJson = (next: SqlAggregationsJson | null) => {
    updateSqlJson((cur) => {
      const normalized: SqlAggregationsJson | null = !next
        ? null
        : {
            enabled:
              (next.metrics?.length ?? 0) > 0 ||
              (next.groupBy?.length ?? 0) > 0,
            metrics: next.metrics ?? [],
            groupBy: next.groupBy ?? [],
            derivedMetrics: next.derivedMetrics ?? [],
          };

      const curSig = JSON.stringify(cur.aggs ?? null);
      const nextSig = JSON.stringify(normalized);
      if (curSig === nextSig) return cur;

      const nextAggsActive =
        (normalized?.metrics?.length ?? 0) > 0 ||
        (normalized?.groupBy?.length ?? 0) > 0;
      const wasAggsActive =
        (cur.aggs?.metrics?.length ?? 0) > 0 ||
        (cur.aggs?.groupBy?.length ?? 0) > 0;

      let nextDistinct = cur.distinct !== false;
      if (!wasAggsActive && nextAggsActive) {
        distinctBeforeAggsRef.current = nextDistinct;
        nextDistinct = false;
      } else if (wasAggsActive && !nextAggsActive) {
        nextDistinct = distinctBeforeAggsRef.current ?? true;
        distinctBeforeAggsRef.current = null;
      } else if (nextAggsActive) {
        nextDistinct = false;
      }

      return { ...cur, aggs: normalized, distinct: nextDistinct };
    });
  };

  const setFiltersInJson = (next: SqlFilterNode | null) => {
    updateSqlJson((cur) => {
      const curSig = JSON.stringify(cur.filters ?? null);
      const nextSig = JSON.stringify(next ?? null);
      if (curSig === nextSig) return cur;
      return { ...cur, filters: next ?? null };
    });
  };

  const toggleColumn = (key: SqlColumnKey) => {
    updateSqlJson((cur) => {
      const exists = cur.columns.some((column) => colKey(column) === colKey(key));
      const nextCols = exists
        ? removeSelectedColumn(cur.columns, key)
        : upsertSelectedColumn(cur.columns, {
            modelColumnId: key.modelColumnId ?? null,
            columnName: key.columnName,
            workspaceTableId: key.workspaceTableId ?? null,
            exprId: key.exprId ?? null,
            modelTableId: null,
            modelTableName: null,
            fullName: null,
            dataType: null,
            nullable: null,
            alias: null,
          } as SqlColumnRef);

      const cols = normalizeColumns(nextCols);
      const keep = new Set(cols.map(colKey));
      const nextGroupBy = (cur.aggs?.groupBy ?? []).filter((groupBy) =>
        keep.has(colKey(groupBy)),
      );

      return {
        ...cur,
        columns: cols,
        sorting: (cur.sorting ?? []).filter((sorting) =>
          keep.has(colKey(sorting.col)),
        ),
        aggs: cur.aggs
          ? {
              ...cur.aggs,
              groupBy: nextGroupBy,
              enabled:
                (cur.aggs.metrics ?? []).length > 0 || nextGroupBy.length > 0,
            }
          : cur.aggs,
      };
    });
  };

  const removeSelected = (key: SqlColumnKey) => {
    updateSqlJson((cur) => {
      const cols = removeSelectedColumn(cur.columns, key);
      const keep = new Set(cols.map(colKey));
      const nextGroupBy = (cur.aggs?.groupBy ?? []).filter((groupBy) =>
        keep.has(colKey(groupBy)),
      );

      return {
        ...cur,
        columns: cols,
        sorting: (cur.sorting ?? []).filter((sorting) =>
          keep.has(colKey(sorting.col)),
        ),
        aggs: cur.aggs
          ? {
              ...cur.aggs,
              groupBy: nextGroupBy,
              enabled:
                (cur.aggs.metrics ?? []).length > 0 || nextGroupBy.length > 0,
            }
          : cur.aggs,
      };
    });
  };

  const clearAllSelected = () => {
    updateSqlJson((cur) => ({
      ...cur,
      columns: [],
      sorting: [],
      aggs: { enabled: false, metrics: [], groupBy: [], derivedMetrics: [] },
      filters: null,
      dataPrep: null,
    }));
  };

  useEffect(() => {
    if (!pageRows.length) return;

    updateSqlJson((cur) => {
      if (!cur.columns.length) return cur;

      const byKey = new Map(pageRows.map((row: any) => [row.identityKey, row]));
      const byName = new Map<string, any>();
      pageRows.forEach((row: any) => {
        if (!byName.has(row.columnName)) byName.set(row.columnName, row);
      });
      let changed = false;

      const nextCols = cur.columns.map((column) => {
        const wtId = (column as any).workspaceTableId;
        const key =
          typeof wtId === "number"
            ? `${wtId}:${column.columnName}`
            : (identityKeyByName.get(column.columnName) ?? column.columnName);
        const hit: any = byKey.get(key) ?? byName.get(column.columnName);
        if (!hit) return column;

        const next: SqlColumnRef = {
          ...column,
          modelColumnId: column.modelColumnId ?? hit.modelColumnId ?? null,
          workspaceTableId:
            (column as any).workspaceTableId ?? hit.workspaceTableId ?? null,
          modelTableName:
            column.modelTableName ?? hit.modelTableName ?? hit.table_name ?? null,
          fullName: column.fullName ?? hit.full_name ?? hit.fullName ?? null,
          dataType: column.dataType ?? hit.dataType ?? hit.data_type ?? null,
        };

        if (
          next.modelColumnId !== column.modelColumnId ||
          (next as any).workspaceTableId !== (column as any).workspaceTableId ||
          next.modelTableName !== column.modelTableName ||
          next.fullName !== column.fullName ||
          next.dataType !== column.dataType
        ) {
          changed = true;
        }
        return next;
      });

      return changed ? { ...cur, columns: nextCols } : cur;
    });
  }, [identityKeyByName, pageRows, updateSqlJson]);

  const columnsMeta = useMemo(() => {
    const aliasByModelId = new Map<number, string>();
    const aliasByWorkspaceKey = new Map<string, string>();
    for (const column of sqlJson.columns ?? []) {
      const alias = (column.alias ?? "").trim();
      if (!alias) continue;
      if (typeof column.modelColumnId === "number") {
        aliasByModelId.set(column.modelColumnId, alias);
      }
      if (typeof (column as any).workspaceTableId === "number") {
        aliasByWorkspaceKey.set(
          `${(column as any).workspaceTableId}:${column.columnName}`,
          alias,
        );
      }
    }

    return pageRows.map((row: any) => {
      const modelId = row.modelColumnId ?? null;
      const wtId = row.workspaceTableId ?? row.workspace_table_id ?? null;
      const alias =
        (typeof modelId === "number"
          ? aliasByModelId.get(modelId)
          : undefined) ??
        (typeof wtId === "number"
          ? aliasByWorkspaceKey.get(`${wtId}:${row.columnName}`)
          : undefined) ??
        null;
      return {
        name: row.name,
        table: row.table_name ?? row.modelTableName ?? null,
        data_type: row.data_type ?? row.dataType ?? null,
        modelColumnId: modelId,
        alias,
      };
    });
  }, [pageRows, sqlJson.columns]);

  return {
    aggsActive,
    allColumnKeysForFilters,
    attachmentRows,
    availableColumnKeys,
    clearAllSelected,
    columnsMeta,
    excludeErrorRows,
    keyForColumnIdentityKey,
    keyForColumnName,
    prompt,
    removeSelected,
    selectedColumnKeysForUi,
    selectedColumns,
    setAggsInJson,
    setCohortAttachment,
    setColumnsInJson,
    setDataPrepInJson,
    setDomainIdInJson,
    setFiltersInJson,
    setPrompt,
    setSortingInJson,
    setValueOverrideAttachments,
    toggleColumn,
  };
}
