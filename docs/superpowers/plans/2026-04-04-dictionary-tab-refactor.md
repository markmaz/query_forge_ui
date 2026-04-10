# DictionaryTab Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1,357-line `DictionaryTab.tsx` monolith into focused files — two hooks, two panel components, and a utils module — reducing `DictionaryTab.tsx` to ~100 lines of orchestration. Also fixes ISSUE-028 (duplicated `useDebouncedValue`).

**Architecture:** Extract pure helpers to `dictionaryTabUtils.ts`, data fetching to `useDictionaryData`, scroll/navigation effects to `useDictionaryNavigation`, and JSX panels to `DictionaryTablePanel` and `DictionaryColumnGrid`. `DictionaryTab` becomes the orchestrator that wires them together.

**Tech Stack:** React 19, TypeScript, TanStack React Query v5, TanStack React Table v8, Vitest, React Testing Library, MSW v2

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/features/domain-studio/ui/components/dictionaryTabUtils.ts` |
| Create | `src/features/domain-studio/ui/components/useDictionaryData.ts` |
| Create | `src/features/domain-studio/ui/components/useDictionaryNavigation.ts` |
| Create | `src/features/domain-studio/ui/components/DictionaryTablePanel.tsx` |
| Create | `src/features/domain-studio/ui/components/DictionaryColumnGrid.tsx` |
| Modify | `src/features/domain-studio/ui/components/DictionaryTab.tsx` |
| Create | `src/features/domain-studio/ui/components/__tests__/useDictionaryData.test.ts` |
| Create | `src/features/domain-studio/ui/components/__tests__/DictionaryTablePanel.test.tsx` |
| Create | `src/features/domain-studio/ui/components/__tests__/DictionaryColumnGrid.test.tsx` |
| Modify | `src/features/domain-studio/ui/components/__tests__/DictionaryTab.test.tsx` |

All files live in `src/features/domain-studio/ui/components/` following the flat pattern of `DomainDrawerTablesTab.tsx`, `DomainDrawerUsersTab.tsx`, etc.

Run tests with:
```bash
cd query-forge-ui
npm run test -- --run 2>&1 | tee /tmp/queryforge-full-vitest.log; test ${PIPESTATUS[1]} -eq 0
```

Run a single test file with:
```bash
npm run test -- --run src/features/domain-studio/ui/components/__tests__/useDictionaryData.test.ts
```

---

## Task 1: Extract `dictionaryTabUtils.ts`

**Files:**
- Create: `src/features/domain-studio/ui/components/dictionaryTabUtils.ts`

- [ ] **Step 1: Create the utils file**

```ts
// src/features/domain-studio/ui/components/dictionaryTabUtils.ts
import React from "react";
import type { WorkspaceDictionaryColumn } from "../../../../shared/services/queryStudioAdminApi";
import type { DomainColumnRef } from "../../../query-forge/model/domainCatalog";

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderHighlightedText(
  text: string,
  query: string,
): React.ReactNode {
  if (!query) return text;
  const safe = escapeRegExp(query);
  const regex = new RegExp(`(${safe})`, "ig");
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${idx}`} className="dict-hit-mark">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
    ),
  );
}

export function buildDescriptionSnippet(
  description: string | null | undefined,
  query: string,
  maxLen = 110,
): string | null {
  const source = (description ?? "").trim();
  if (!source) return null;
  if (!query)
    return source.length > maxLen ? `${source.slice(0, maxLen)}…` : source;
  const lower = source.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0)
    return source.length > maxLen ? `${source.slice(0, maxLen)}…` : source;
  const contextBefore = 24;
  const contextAfter = maxLen - query.length - contextBefore;
  const start = Math.max(0, idx - contextBefore);
  const end = Math.min(
    source.length,
    idx + query.length + Math.max(24, contextAfter),
  );
  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

export function toColumnLookupKey(
  tableName: string,
  columnName: string,
): string {
  return `${tableName}::${columnName}`.toLowerCase();
}

export function toPreviewColumn(
  row: WorkspaceDictionaryColumn,
): DomainColumnRef {
  const raw = row as WorkspaceDictionaryColumn & Record<string, unknown>;
  const workspaceTableId = row.workspace_table_id;
  const domainId = Number(
    (raw as any).domainId ?? (raw as any).domain_id ?? 0,
  );
  return {
    modelColumnId: row.id || null,
    identityKey:
      `dict:${row.id}:${row.table_name ?? ""}:${row.column_name}`.toLowerCase(),
    columnName: row.column_name,
    modelTableName: row.table_name ?? "",
    fullName: String(
      (raw as any).fullName ??
        (raw as any).full_name ??
        `${row.table_name ?? ""}.${row.column_name}`,
    ),
    tableAlias: null,
    columnLabel: null,
    dataType: row.data_type ?? "unknown",
    nullable: true,
    description: row.description,
    workspaceTableId,
    modelTableId: null,
    baseTableName: row.table_name ?? "",
    schemaName: String((raw as any).schema_name ?? ""),
    catalogName: String((raw as any).catalog_name ?? ""),
    domainId,
    domainName: "Data Dictionary",
    variantCode: null,
    isQe: false,
    existsInDbx: false,
    lastSeenAt: row.sample_ran_at ?? null,
    ordinalPosition: row.ordinal_position ?? undefined,
    sampleValues: row.sample_values_json,
    sampleStats: row.sample_stats_json,
    sampleRanAt: row.sample_ran_at,
    sampleError: row.sample_error,
    tableColumnCount: undefined,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd query-forge-ui && npx tsc --noEmit 2>&1 | grep dictionaryTabUtils
```
Expected: no output (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
cd query-forge-ui
git add src/features/domain-studio/ui/components/dictionaryTabUtils.ts
git commit -m "refactor(dictionary): extract dictionaryTabUtils.ts"
```

---

## Task 2: Write failing tests for `useDictionaryData`

**Files:**
- Create: `src/features/domain-studio/ui/components/__tests__/useDictionaryData.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// src/features/domain-studio/ui/components/__tests__/useDictionaryData.test.ts
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  afterEach,
  beforeAll,
  afterAll,
  describe,
  expect,
  it,
} from "vitest";
import { server } from "../../../../../qa/msw/server";
import { useDictionaryData } from "../useDictionaryData";

const tablesPath = /\/dictionary\/tables/;
const columnsPath = /\/dictionary\/columns(?!\/search)/;
const searchPath = /\/dictionary\/columns\/search/;
const patchPath = /\/dictionary\/columns\/\d+/;

const TABLES = [
  { id: 2, table_name: "zebra_table", full_name: "zebra_table" },
  { id: 1, table_name: "apple_table", full_name: "apple_table" },
  { id: 3, table_name: "mango_table", full_name: "mango_table" },
];

const COLUMNS = [
  {
    id: 10,
    workspace_table_id: 1,
    column_name: "col_a",
    data_type: "string",
    ordinal_position: 1,
    description: "Column A",
    is_active: true,
    semantic_type: null,
    semantic_entity: null,
    semantic_sub_type: null,
    semantic_confidence: null,
    sample_values_json: null,
    sample_stats_json: null,
    sample_ran_at: null,
    sample_error: null,
    table_name: "apple_table",
  },
  {
    id: 11,
    workspace_table_id: 1,
    column_name: "col_b",
    data_type: "int",
    ordinal_position: 2,
    description: null,
    is_active: false,
    semantic_type: null,
    semantic_entity: null,
    semantic_sub_type: null,
    semantic_confidence: null,
    sample_values_json: null,
    sample_stats_json: null,
    sample_ran_at: null,
    sample_error: null,
    table_name: "apple_table",
  },
];

const makeWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
};

const defaultInput = {
  selectedTable: null as { id: number; name: string } | null,
  activeOnly: true,
  qDeferred: "",
  debouncedGlobalSearchTerm: "",
  tableFilter: "",
};

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useDictionaryData", () => {
  it("returns table list sorted alphabetically", async () => {
    server.use(
      http.get(tablesPath, () => HttpResponse.json({ rows: TABLES, total: 3 })),
    );

    const { result } = renderHook(() => renderHook(() => useDictionaryData(defaultInput), { wrapper: makeWrapper() }).result.current, { wrapper: makeWrapper() });

    const inner = renderHook(() => useDictionaryData(defaultInput), {
      wrapper: makeWrapper(),
    });

    server.use(
      http.get(tablesPath, () => HttpResponse.json({ rows: TABLES, total: 3 })),
    );

    const { result: r } = renderHook(() => useDictionaryData(defaultInput), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(r.current.tableNamesQ.isSuccess).toBe(true);
    });

    expect(r.current.allTableNames.map((t) => t.name)).toEqual([
      "apple_table",
      "mango_table",
      "zebra_table",
    ]);
  });

  it("filteredTableNames filters by tableFilter", async () => {
    server.use(
      http.get(tablesPath, () => HttpResponse.json({ rows: TABLES, total: 3 })),
    );

    const { result } = renderHook(
      () => useDictionaryData({ ...defaultInput, tableFilter: "apple" }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.tableNamesQ.isSuccess).toBe(true);
    });

    expect(result.current.filteredTableNames).toHaveLength(1);
    expect(result.current.filteredTableNames[0].name).toBe("apple_table");
  });

  it("global search query is disabled when debouncedGlobalSearchTerm is empty", async () => {
    const fetchSpy = vitest.fn();
    server.use(
      http.get(searchPath, () => {
        fetchSpy();
        return HttpResponse.json({ rows: [] });
      }),
    );

    const { result } = renderHook(
      () => useDictionaryData({ ...defaultInput, debouncedGlobalSearchTerm: "" }),
      { wrapper: makeWrapper() },
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.globalSearchQ.fetchStatus).toBe("idle");
  });

  it("global search query fires when debouncedGlobalSearchTerm is non-empty", async () => {
    server.use(
      http.get(tablesPath, () => HttpResponse.json({ rows: TABLES, total: 3 })),
      http.get(searchPath, () =>
        HttpResponse.json({ rows: [{ ...COLUMNS[0], table_name: "apple_table" }] }),
      ),
    );

    const { result } = renderHook(
      () =>
        useDictionaryData({
          ...defaultInput,
          debouncedGlobalSearchTerm: "col_a",
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.globalSearchQ.isSuccess).toBe(true);
    });

    expect(result.current.globalColumnHits).toHaveLength(1);
  });

  it("patchM optimistically updates the cache", async () => {
    server.use(
      http.get(tablesPath, () => HttpResponse.json({ rows: TABLES, total: 3 })),
      http.get(columnsPath, () => HttpResponse.json({ rows: COLUMNS })),
      http.patch(patchPath, () => HttpResponse.json({ ...COLUMNS[0], description: "Updated" })),
    );

    const selectedTable = { id: 1, name: "apple_table" };

    const { result } = renderHook(
      () => useDictionaryData({ ...defaultInput, selectedTable }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.modelQ.isSuccess).toBe(true);
    });

    expect(result.current.rows[0].description).toBe("Column A");

    act(() => {
      result.current.patchM.mutate({
        id: 10,
        patch: { description: "Updated" },
      });
    });

    await waitFor(() => {
      expect(result.current.rows[0].description).toBe("Updated");
    });
  });

  it("patchM rolls back on error", async () => {
    server.use(
      http.get(tablesPath, () => HttpResponse.json({ rows: TABLES, total: 3 })),
      http.get(columnsPath, () => HttpResponse.json({ rows: COLUMNS })),
      http.patch(patchPath, () => HttpResponse.error()),
    );

    const selectedTable = { id: 1, name: "apple_table" };

    const { result } = renderHook(
      () => useDictionaryData({ ...defaultInput, selectedTable }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.modelQ.isSuccess).toBe(true);
    });

    act(() => {
      result.current.patchM.mutate({
        id: 10,
        patch: { description: "Should roll back" },
      });
    });

    await waitFor(() => {
      expect(result.current.patchM.isError).toBe(true);
    });

    expect(result.current.rows[0].description).toBe("Column A");
  });
});
```

- [ ] **Step 2: Run tests — expect import error**

```bash
cd query-forge-ui
npm run test -- --run src/features/domain-studio/ui/components/__tests__/useDictionaryData.test.ts 2>&1 | tail -20
```
Expected: error — `Cannot find module '../useDictionaryData'`

---

## Task 3: Extract `useDictionaryData`

**Files:**
- Create: `src/features/domain-studio/ui/components/useDictionaryData.ts`

- [ ] **Step 1: Create the hook**

```ts
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

const GLOBAL_SEARCH_LIMIT = 200;

export interface UseDictionaryDataInput {
  selectedTable: { id: number; name: string } | null;
  activeOnly: boolean;
  qDeferred: string;
  debouncedGlobalSearchTerm: string;
  tableFilter: string;
}

export function useDictionaryData({
  selectedTable,
  activeOnly,
  qDeferred,
  debouncedGlobalSearchTerm,
  tableFilter,
}: UseDictionaryDataInput) {
  const qc = useQueryClient();

  const tableNamesQ = useQuery({
    queryKey: ["dictTables", { q: "" }],
    queryFn: () => fetchDictionaryTables({ q: "", limit: 5000, offset: 0 }),
  });

  const allTableNames = useMemo(() => {
    const rows = tableNamesQ.data?.rows ?? [];
    const seen = new Set<number>();
    const result: Array<{ id: number; name: string }> = [];
    for (const r of rows as any[]) {
      const id = Number(r?.id);
      const name = String(r?.table_name ?? "").trim();
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      result.push({ id, name });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [tableNamesQ.data]);

  const filteredTableNames = useMemo(() => {
    const f = tableFilter.trim().toLowerCase();
    if (!f) return allTableNames;
    return allTableNames.filter((t) => t.name.toLowerCase().includes(f));
  }, [allTableNames, tableFilter]);

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
    const filtered = activeOnly
      ? source.filter((row) => !!row.is_active)
      : source;
    const seen = new Set<string>();
    const unique: WorkspaceDictionaryColumn[] = [];
    for (const row of filtered) {
      const key = `${row.table_name ?? ""}::${row.column_name}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(row);
    }
    return unique;
  }, [globalSearchQ.data, activeOnly]);

  const globalTableResults = useMemo(() => {
    if (!debouncedGlobalSearchTerm)
      return [] as Array<{ id: number; tableName: string; matchCount: number }>;

    const matchCounts = new Map<string, number>();
    const tableEntriesByLower = new Map<string, { id: number; name: string }>();

    for (const row of globalColumnHits) {
      const key = (row.table_name ?? "").toLowerCase();
      if (!tableEntriesByLower.has(key)) {
        const found = allTableNames.find((t) => t.name.toLowerCase() === key);
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

    for (const t of allTableNames) {
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
  }, [allTableNames, globalColumnHits, globalSearchLower, debouncedGlobalSearchTerm]);

  const globalColumnResults = useMemo(() => {
    if (!debouncedGlobalSearchTerm) return [] as WorkspaceDictionaryColumn[];

    const filtered = globalColumnHits.filter((row) => {
      const inTable = (row.table_name ?? "")
        .toLowerCase()
        .includes(globalSearchLower);
      const inColumn = row.column_name.toLowerCase().includes(globalSearchLower);
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
        Pick<WorkspaceDictionaryColumn, "data_type" | "description" | "is_active">
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
```

- [ ] **Step 2: Fix the test — remove the duplicated renderHook call**

The test file written in Task 2 has a duplicate `renderHook` call in the first test. Replace the first test with the corrected version:

```ts
  it("returns table list sorted alphabetically", async () => {
    server.use(
      http.get(tablesPath, () =>
        HttpResponse.json({ rows: TABLES, total: 3 }),
      ),
    );

    const { result } = renderHook(
      () => useDictionaryData(defaultInput),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.tableNamesQ.isSuccess).toBe(true);
    });

    expect(result.current.allTableNames.map((t) => t.name)).toEqual([
      "apple_table",
      "mango_table",
      "zebra_table",
    ]);
  });
```

Also fix the vitest import — replace `vitest.fn()` with `vi.fn()` in the global search disabled test (the import already has `vi`).

- [ ] **Step 3: Run tests — all should pass**

```bash
cd query-forge-ui
npm run test -- --run src/features/domain-studio/ui/components/__tests__/useDictionaryData.test.ts 2>&1 | tail -20
```
Expected: `5 passed`

- [ ] **Step 4: Commit**

```bash
cd query-forge-ui
git add src/features/domain-studio/ui/components/useDictionaryData.ts \
        src/features/domain-studio/ui/components/__tests__/useDictionaryData.test.ts
git commit -m "refactor(dictionary): extract useDictionaryData hook with tests"
```

---

## Task 4: Extract `useDictionaryNavigation`

**Files:**
- Create: `src/features/domain-studio/ui/components/useDictionaryNavigation.ts`

No separate unit tests — the scroll/ref effects require DOM measurement that is better covered by the `DictionaryTab` integration tests added in Task 9.

- [ ] **Step 1: Create the hook**

```ts
// src/features/domain-studio/ui/components/useDictionaryNavigation.ts
import { useEffect, useRef, useState } from "react";
import type { Table } from "@tanstack/react-table";
import type { WorkspaceDictionaryColumn } from "../../../../shared/services/queryStudioAdminApi";
import { toColumnLookupKey } from "./dictionaryTabUtils";

export interface UseDictionaryNavigationInput {
  selectedTable: { id: number; name: string } | null;
  rows: WorkspaceDictionaryColumn[];
  isGlobalSearchMode: boolean;
  tableFilter: string;
  filteredTableNames: Array<{ id: number; name: string }>;
  pagination: { pageIndex: number; pageSize: number };
  tableInst: Table<WorkspaceDictionaryColumn>;
}

export function useDictionaryNavigation({
  selectedTable,
  rows,
  isGlobalSearchMode,
  tableFilter,
  filteredTableNames,
  pagination,
  tableInst,
}: UseDictionaryNavigationInput) {
  const rowRefMap = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const tableButtonRefMap = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pulseTimerRef = useRef<number | null>(null);
  const [pulsedColumnKey, setPulsedColumnKey] = useState<string | null>(null);
  const [jumpToColumn, setJumpToColumn] = useState<{
    tableName: string;
    columnName: string;
  } | null>(null);

  // Cleanup pulse timer on unmount
  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null)
        window.clearTimeout(pulseTimerRef.current);
    };
  }, []);

  // Jump-to-column: scroll to page, then scroll row into view and pulse
  useEffect(() => {
    if (!jumpToColumn || !selectedTable) return;

    const selectedLower = selectedTable.name.toLowerCase();
    const targetTableLower = jumpToColumn.tableName.toLowerCase();
    if (selectedLower !== targetTableLower) return;

    const targetIndex = rows.findIndex(
      (row) =>
        row.column_name.toLowerCase() === jumpToColumn.columnName.toLowerCase(),
    );
    if (targetIndex < 0) return;

    const nextPage = Math.floor(targetIndex / pagination.pageSize);
    if (pagination.pageIndex !== nextPage) {
      tableInst.setPageIndex(nextPage);
      return;
    }

    const key = toColumnLookupKey(selectedTable.name, jumpToColumn.columnName);
    const rowEl = rowRefMap.current.get(key);
    if (!rowEl) return;

    rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulsedColumnKey(key);
    if (pulseTimerRef.current !== null)
      window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => {
      setPulsedColumnKey((current) => (current === key ? null : current));
    }, 2000);
    setJumpToColumn(null);
  }, [
    jumpToColumn,
    selectedTable,
    rows,
    pagination.pageIndex,
    pagination.pageSize,
    tableInst,
  ]);

  // Scroll the selected table button into view in the sidebar
  useEffect(() => {
    if (!selectedTable || isGlobalSearchMode) return;

    if (
      tableFilter &&
      !filteredTableNames.some((t) => t.id === selectedTable.id)
    ) {
      return;
    }

    const btn = tableButtonRefMap.current.get(selectedTable.name);
    if (!btn) return;
    window.requestAnimationFrame(() => {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [selectedTable, isGlobalSearchMode, tableFilter, filteredTableNames]);

  return {
    rowRefMap,
    tableButtonRefMap,
    jumpToColumn,
    setJumpToColumn,
    pulsedColumnKey,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd query-forge-ui && npx tsc --noEmit 2>&1 | grep useDictionaryNavigation
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd query-forge-ui
git add src/features/domain-studio/ui/components/useDictionaryNavigation.ts
git commit -m "refactor(dictionary): extract useDictionaryNavigation hook"
```

---

## Task 5: Write failing tests for `DictionaryTablePanel`

**Files:**
- Create: `src/features/domain-studio/ui/components/__tests__/DictionaryTablePanel.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/features/domain-studio/ui/components/__tests__/DictionaryTablePanel.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { server } from "../../../../../qa/msw/server";
import { DictionaryTablePanel } from "../DictionaryTablePanel";
import type { WorkspaceDictionaryColumn } from "../../../../../shared/services/queryStudioAdminApi";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const TABLES = [
  { id: 1, name: "apple_table" },
  { id: 2, name: "zebra_table" },
];

const GLOBAL_COL: WorkspaceDictionaryColumn = {
  id: 10,
  workspace_table_id: 1,
  column_name: "col_a",
  data_type: "string",
  ordinal_position: 1,
  description: "A column",
  is_active: true,
  semantic_type: null,
  semantic_entity: null,
  semantic_sub_type: null,
  semantic_confidence: null,
  sample_values_json: null,
  sample_stats_json: null,
  sample_ran_at: null,
  sample_error: null,
  table_name: "apple_table",
};

function makeMinimalProps(overrides = {}) {
  return {
    allTableNames: TABLES,
    filteredTableNames: TABLES,
    tableFilter: "",
    onTableFilterChange: vi.fn(),
    selectedTable: null as { id: number; name: string } | null,
    onSelectTable: vi.fn(),
    tableButtonRefMap: { current: new Map() } as React.MutableRefObject<
      Map<string, HTMLButtonElement>
    >,
    tableNamesQ: { isLoading: false, isError: false } as any,
    globalSearchDraft: "",
    onGlobalSearchChange: vi.fn(),
    debouncedGlobalSearchTerm: "",
    isGlobalSearchMode: false,
    showGlobalSearching: false,
    globalSearchQ: { isError: false } as any,
    globalTableResults: [] as Array<{
      id: number;
      tableName: string;
      matchCount: number;
    }>,
    globalColumnResults: [] as WorkspaceDictionaryColumn[],
    onJumpToColumn: vi.fn(),
    activeOnly: true,
    onActiveOnlyChange: vi.fn(),
    onSetEditing: vi.fn(),
    onClearQDraft: vi.fn(),
    isSwitching: false,
    startTransition: ((fn: () => void) => fn()) as React.TransitionStartFunction,
    ...overrides,
  };
}

describe("DictionaryTablePanel", () => {
  it("renders table list", () => {
    render(<DictionaryTablePanel {...makeMinimalProps()} />);
    expect(screen.getByText("apple_table")).toBeInTheDocument();
    expect(screen.getByText("zebra_table")).toBeInTheDocument();
  });

  it("clicking a table fires onSelectTable", async () => {
    const onSelectTable = vi.fn();
    const user = userEvent.setup();
    render(
      <DictionaryTablePanel {...makeMinimalProps({ onSelectTable })} />,
    );
    await user.click(screen.getByRole("button", { name: /apple_table/i }));
    expect(onSelectTable).toHaveBeenCalledWith(TABLES[0]);
  });

  it("renders global search results in table and column sections", () => {
    render(
      <DictionaryTablePanel
        {...makeMinimalProps({
          isGlobalSearchMode: true,
          debouncedGlobalSearchTerm: "col",
          globalSearchDraft: "col",
          globalTableResults: [
            { id: 1, tableName: "apple_table", matchCount: 1 },
          ],
          globalColumnResults: [GLOBAL_COL],
        })}
      />,
    );
    expect(screen.getByText("Tables")).toBeInTheDocument();
    expect(screen.getByText("Columns")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /apple_table\.col_a/i }),
    ).toBeInTheDocument();
  });

  it("clicking a table result in global search fires onSelectTable", async () => {
    const onSelectTable = vi.fn();
    const user = userEvent.setup();
    render(
      <DictionaryTablePanel
        {...makeMinimalProps({
          isGlobalSearchMode: true,
          debouncedGlobalSearchTerm: "apple",
          globalSearchDraft: "apple",
          globalTableResults: [
            { id: 1, tableName: "apple_table", matchCount: 0 },
          ],
          globalColumnResults: [],
          onSelectTable,
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /apple_table/i }));
    expect(onSelectTable).toHaveBeenCalledWith({
      id: 1,
      name: "apple_table",
    });
  });

  it("clicking a column result fires onSelectTable and onJumpToColumn", async () => {
    const onSelectTable = vi.fn();
    const onJumpToColumn = vi.fn();
    const user = userEvent.setup();
    render(
      <DictionaryTablePanel
        {...makeMinimalProps({
          isGlobalSearchMode: true,
          debouncedGlobalSearchTerm: "col_a",
          globalSearchDraft: "col_a",
          globalTableResults: [],
          globalColumnResults: [GLOBAL_COL],
          onSelectTable,
          onJumpToColumn,
        })}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /apple_table\.col_a/i }),
    );
    expect(onSelectTable).toHaveBeenCalledWith({
      id: 1,
      name: "apple_table",
    });
    expect(onJumpToColumn).toHaveBeenCalledWith({
      tableName: "apple_table",
      columnName: "col_a",
    });
  });

  it("shows no-matches state when global search returns empty", () => {
    render(
      <DictionaryTablePanel
        {...makeMinimalProps({
          isGlobalSearchMode: true,
          debouncedGlobalSearchTerm: "xyzxyz",
          globalSearchDraft: "xyzxyz",
          globalTableResults: [],
          globalColumnResults: [],
        })}
      />,
    );
    expect(screen.getByText(/No matches for/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect import error**

```bash
cd query-forge-ui
npm run test -- --run src/features/domain-studio/ui/components/__tests__/DictionaryTablePanel.test.tsx 2>&1 | tail -10
```
Expected: error — `Cannot find module '../DictionaryTablePanel'`

---

## Task 6: Extract `DictionaryTablePanel`

**Files:**
- Create: `src/features/domain-studio/ui/components/DictionaryTablePanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/features/domain-studio/ui/components/DictionaryTablePanel.tsx
import React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { WorkspaceDictionaryColumn } from "../../../../shared/services/queryStudioAdminApi";
import {
  buildDescriptionSnippet,
  renderHighlightedText,
} from "./dictionaryTabUtils";

export interface DictionaryTablePanelProps {
  // table list
  allTableNames: Array<{ id: number; name: string }>;
  filteredTableNames: Array<{ id: number; name: string }>;
  tableFilter: string;
  onTableFilterChange: (v: string) => void;
  selectedTable: { id: number; name: string } | null;
  onSelectTable: (t: { id: number; name: string } | null) => void;
  tableButtonRefMap: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  tableNamesQ: UseQueryResult;
  // global search
  globalSearchDraft: string;
  onGlobalSearchChange: (v: string) => void;
  debouncedGlobalSearchTerm: string;
  isGlobalSearchMode: boolean;
  showGlobalSearching: boolean;
  globalSearchQ: UseQueryResult;
  globalTableResults: Array<{ id: number; tableName: string; matchCount: number }>;
  globalColumnResults: WorkspaceDictionaryColumn[];
  onJumpToColumn: (t: { tableName: string; columnName: string }) => void;
  // shared
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  onSetEditing: (v: null) => void;
  onClearQDraft: () => void;
  isSwitching: boolean;
  startTransition: React.TransitionStartFunction;
}

export const DictionaryTablePanel: React.FC<DictionaryTablePanelProps> = ({
  allTableNames,
  filteredTableNames,
  tableFilter,
  onTableFilterChange,
  selectedTable,
  onSelectTable,
  tableButtonRefMap,
  tableNamesQ,
  globalSearchDraft,
  onGlobalSearchChange,
  debouncedGlobalSearchTerm,
  isGlobalSearchMode,
  showGlobalSearching,
  globalSearchQ,
  globalTableResults,
  globalColumnResults,
  onJumpToColumn,
  activeOnly,
  onActiveOnlyChange,
  onSetEditing,
  onClearQDraft,
  isSwitching,
  startTransition,
}) => {
  return (
    <div className="card">
      <div className="card-header py-2 d-flex justify-content-between align-items-center">
        <div className="fw-semibold">Tables</div>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => {
            onSetEditing(null);
            startTransition(() => onSelectTable(null));
          }}
          disabled={!selectedTable}
          title="Clear selection"
        >
          All
        </button>
      </div>

      <div className="card-body p-2">
        <div className="input-group input-group-sm mb-1">
          <span className="input-group-text bg-white">
            <i className="fa fa-search text-muted" aria-hidden="true" />
          </span>
          <input
            className="form-control"
            value={globalSearchDraft}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            placeholder="Search tables & columns..."
            aria-label="Global dictionary search"
          />
        </div>
        <div className="text-muted small mb-2">
          Search across table names, columns, and descriptions.
        </div>

        <input
          className="form-control form-control-sm mb-2"
          value={tableFilter}
          onChange={(e) => onTableFilterChange(e.target.value)}
          placeholder="Filter tables…"
        />

        <div className="form-check mb-2">
          <input
            className="form-check-input"
            id="activeOnly"
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => onActiveOnlyChange(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="activeOnly">
            Active only
          </label>
        </div>

        {tableNamesQ.isError ? (
          <div className="alert alert-danger py-2 mb-0">
            {(tableNamesQ.error as Error).message}
          </div>
        ) : null}

        {isGlobalSearchMode ? (
          <div className="dict-global-results">
            {showGlobalSearching ? (
              <div className="text-muted small p-2">Searching…</div>
            ) : globalSearchQ.isError ? (
              <div className="alert alert-danger py-2 mb-0">
                {(globalSearchQ.error as Error).message}
              </div>
            ) : globalTableResults.length === 0 &&
              globalColumnResults.length === 0 ? (
              <div className="dict-global-empty">
                <div className="fw-semibold">
                  No matches for "{debouncedGlobalSearchTerm}"
                </div>
                <div className="text-muted small">
                  Try a different term, or search by a partial column name.
                </div>
              </div>
            ) : (
              <>
                <div className="dict-global-group">
                  <div className="dict-global-group-title">Tables</div>
                  {globalTableResults.length === 0 ? (
                    <div className="text-muted small p-2">No table matches.</div>
                  ) : (
                    <div className="list-group">
                      {globalTableResults.map((result) => (
                        <button
                          key={`tbl-${result.id}`}
                          type="button"
                          className="list-group-item list-group-item-action dict-global-item"
                          onClick={() => {
                            onSetEditing(null);
                            onGlobalSearchChange("");
                            startTransition(() =>
                              onSelectTable({
                                id: result.id,
                                name: result.tableName,
                              }),
                            );
                          }}
                          title={result.tableName}
                        >
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <span className="text-truncate">
                              {renderHighlightedText(
                                result.tableName,
                                debouncedGlobalSearchTerm,
                              )}
                            </span>
                            <span className="badge text-bg-light border">
                              {result.matchCount}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="dict-global-group mt-2">
                  <div className="dict-global-group-title">Columns</div>
                  {globalColumnResults.length === 0 ? (
                    <div className="text-muted small p-2">
                      No column matches.
                    </div>
                  ) : (
                    <div className="list-group">
                      {globalColumnResults.map((result) => {
                        const label = `${result.table_name ?? ""}.${result.column_name}`;
                        const snippet = buildDescriptionSnippet(
                          result.description,
                          debouncedGlobalSearchTerm,
                        );
                        return (
                          <button
                            key={`col-${(result.table_name ?? "").toLowerCase()}::${result.column_name.toLowerCase()}`}
                            type="button"
                            className="list-group-item list-group-item-action dict-global-item"
                            onClick={() => {
                              onSetEditing(null);
                              onClearQDraft();
                              onGlobalSearchChange("");
                              onJumpToColumn({
                                tableName: result.table_name ?? "",
                                columnName: result.column_name,
                              });
                              startTransition(() =>
                                onSelectTable({
                                  id: result.workspace_table_id,
                                  name: result.table_name ?? "",
                                }),
                              );
                            }}
                            title={label}
                          >
                            <div className="fw-semibold text-truncate">
                              {renderHighlightedText(
                                label,
                                debouncedGlobalSearchTerm,
                              )}
                            </div>
                            {snippet ? (
                              <div className="dict-global-desc">
                                {renderHighlightedText(
                                  snippet,
                                  debouncedGlobalSearchTerm,
                                )}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div
              className="list-group"
              style={{ maxHeight: 520, overflowY: "auto" }}
            >
              {tableNamesQ.isLoading ? (
                <div className="text-muted small p-2">Loading tables…</div>
              ) : filteredTableNames.length === 0 ? (
                <div className="text-muted small p-2">No matching tables.</div>
              ) : (
                filteredTableNames.map((t) => {
                  const active = selectedTable?.id === t.id;
                  return (
                    <button
                      key={`tbl-${t.id}`}
                      ref={(el) => {
                        if (el) tableButtonRefMap.current.set(t.name, el);
                        else tableButtonRefMap.current.delete(t.name);
                      }}
                      type="button"
                      className={`list-group-item list-group-item-action${active ? " active" : ""}`}
                      onClick={() => {
                        onSetEditing(null);
                        onClearQDraft();
                        startTransition(() => onSelectTable(t));
                      }}
                      title={t.name}
                    >
                      <span className="text-truncate">{t.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="text-muted small mt-2">
              Showing {filteredTableNames.length} / {allTableNames.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Run tests — all should pass**

```bash
cd query-forge-ui
npm run test -- --run src/features/domain-studio/ui/components/__tests__/DictionaryTablePanel.test.tsx 2>&1 | tail -15
```
Expected: `6 passed`

- [ ] **Step 3: Commit**

```bash
cd query-forge-ui
git add src/features/domain-studio/ui/components/DictionaryTablePanel.tsx \
        src/features/domain-studio/ui/components/__tests__/DictionaryTablePanel.test.tsx
git commit -m "refactor(dictionary): extract DictionaryTablePanel with tests"
```

---

## Task 7: Write failing tests for `DictionaryColumnGrid`

**Files:**
- Create: `src/features/domain-studio/ui/components/__tests__/DictionaryColumnGrid.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/features/domain-studio/ui/components/__tests__/DictionaryColumnGrid.test.tsx
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { server } from "../../../../../qa/msw/server";
import { DictionaryColumnGrid } from "../DictionaryColumnGrid";
import type { WorkspaceDictionaryColumn } from "../../../../../shared/services/queryStudioAdminApi";
import { buildDictionaryColumns } from "../DictionaryColumnGrid";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ROWS: WorkspaceDictionaryColumn[] = [
  {
    id: 10,
    workspace_table_id: 1,
    column_name: "col_a",
    data_type: "string",
    ordinal_position: 1,
    description: "Column A description",
    is_active: true,
    semantic_type: null,
    semantic_entity: null,
    semantic_sub_type: null,
    semantic_confidence: null,
    sample_values_json: null,
    sample_stats_json: null,
    sample_ran_at: null,
    sample_error: null,
    table_name: "apple_table",
  },
  {
    id: 11,
    workspace_table_id: 1,
    column_name: "col_b",
    data_type: "int",
    ordinal_position: 2,
    description: null,
    is_active: false,
    semantic_type: null,
    semantic_entity: null,
    semantic_sub_type: null,
    semantic_confidence: null,
    sample_values_json: null,
    sample_stats_json: null,
    sample_ran_at: null,
    sample_error: null,
    table_name: "apple_table",
  },
];

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function TestGrid({
  rows = ROWS,
  selectedTable = { id: 1, name: "apple_table" },
  editing = null as { id: number; field: "data_type" | "description" } | null,
  onSetEditing = vi.fn(),
  onMutate = vi.fn(),
  onOpenPreview = vi.fn(),
}: {
  rows?: WorkspaceDictionaryColumn[];
  selectedTable?: { id: number; name: string } | null;
  editing?: { id: number; field: "data_type" | "description" } | null;
  onSetEditing?: ReturnType<typeof vi.fn>;
  onMutate?: ReturnType<typeof vi.fn>;
  onOpenPreview?: ReturnType<typeof vi.fn>;
}) {
  const patchM = { mutate: onMutate, isPending: false } as any;
  const columns = buildDictionaryColumns({ editing, patchM, onSetEditing, activeOnly: true, onActiveOnlyChange: vi.fn(), onOpenPreview });
  const tableInst = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });
  return (
    <DictionaryColumnGrid
      selectedTable={selectedTable}
      rows={rows}
      tableInst={tableInst}
      columns={columns}
      modelQ={{ isLoading: false, isError: false, isFetching: false } as any}
      patchM={patchM}
      editing={editing}
      onSetEditing={onSetEditing}
      activeOnly={true}
      onActiveOnlyChange={vi.fn()}
      onOpenPreview={onOpenPreview}
      rowRefMap={{ current: new Map() } as any}
      pulsedColumnKey={null}
      qDraft=""
      onQDraftChange={vi.fn()}
      statusText=""
    />
  );
}

describe("DictionaryColumnGrid", () => {
  it("shows empty state when selectedTable is null", () => {
    render(<TestGrid selectedTable={null} rows={[]} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByText(/Select a table/i)).toBeInTheDocument();
  });

  it("renders columns for selected table", () => {
    render(<TestGrid />, { wrapper: makeWrapper() });
    expect(screen.getByText("col_a")).toBeInTheDocument();
    expect(screen.getByText("col_b")).toBeInTheDocument();
  });

  it("clicking a data type cell calls onSetEditing with data_type field", async () => {
    const onSetEditing = vi.fn();
    const user = userEvent.setup();
    render(<TestGrid onSetEditing={onSetEditing} />, {
      wrapper: makeWrapper(),
    });
    // data type is a button showing the value
    const dtBtn = screen.getByRole("button", { name: /^string$/i });
    await user.click(dtBtn);
    expect(onSetEditing).toHaveBeenCalledWith({ id: 10, field: "data_type" });
  });

  it("clicking a description cell calls onSetEditing with description field", async () => {
    const onSetEditing = vi.fn();
    const user = userEvent.setup();
    render(<TestGrid onSetEditing={onSetEditing} />, {
      wrapper: makeWrapper(),
    });
    const descBtn = screen.getByRole("button", { name: /Column A description/i });
    await user.click(descBtn);
    expect(onSetEditing).toHaveBeenCalledWith({ id: 10, field: "description" });
  });

  it("toggling is_active checkbox calls patchM.mutate", async () => {
    const onMutate = vi.fn();
    const user = userEvent.setup();
    render(<TestGrid onMutate={onMutate} />, { wrapper: makeWrapper() });
    const checkboxes = screen.getAllByRole("checkbox");
    // first row (col_a) is active — uncheck it
    await user.click(checkboxes[0]);
    expect(onMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10, patch: { is_active: false } }),
    );
  });

  it("Next page button is disabled when on last page", () => {
    render(<TestGrid rows={ROWS} />, { wrapper: makeWrapper() });
    const nextBtn = screen.getByRole("button", { name: /next/i });
    // 2 rows, pageSize 50 — only one page
    expect(nextBtn).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run — expect import error**

```bash
cd query-forge-ui
npm run test -- --run src/features/domain-studio/ui/components/__tests__/DictionaryColumnGrid.test.tsx 2>&1 | tail -10
```
Expected: error — `Cannot find module '../DictionaryColumnGrid'`

---

## Task 8: Extract `DictionaryColumnGrid`

**Files:**
- Create: `src/features/domain-studio/ui/components/DictionaryColumnGrid.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/features/domain-studio/ui/components/DictionaryColumnGrid.tsx
import React, { useState } from "react";
import {
  flexRender,
  type ColumnDef,
  type Table,
} from "@tanstack/react-table";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import type { WorkspaceDictionaryColumn } from "../../../../shared/services/queryStudioAdminApi";
import { EmptySectionState } from "../../../../shared/components/EmptySectionState";
import { toColumnLookupKey } from "./dictionaryTabUtils";

const DATA_TYPE_OPTIONS = [
  "string",
  "int",
  "bigint",
  "double",
  "decimal",
  "boolean",
  "date",
  "timestamp",
] as const;

function InlineTextArea(props: {
  value: string;
  placeholder?: string;
  onSave: (next: string) => void;
  disabled?: boolean;
  resetKey: string;
  onDone?: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  return (
    <div className="d-flex gap-2 align-items-start">
      <textarea
        key={props.resetKey}
        className="form-control form-control-sm dict-textarea"
        defaultValue={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={() => setDirty(true)}
        onBlur={(e) => {
          const next = e.target.value ?? "";
          if (dirty && next !== props.value) props.onSave(next);
          setDirty(false);
          props.onDone?.();
        }}
      />
      {dirty ? <span className="text-muted small mt-1">●</span> : null}
    </div>
  );
}

function DataTypeSelect(props: {
  value: string | null;
  options: readonly string[];
  disabled?: boolean;
  onSave: (next: string | null) => void;
  resetKey: string;
  onDone?: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const initial = props.value ?? "";
  return (
    <div className="d-flex gap-2 align-items-center">
      <select
        key={props.resetKey}
        className="form-select form-select-sm dict-dtype-select"
        defaultValue={initial}
        disabled={props.disabled}
        onChange={() => setDirty(true)}
        onBlur={(e) => {
          if (!dirty) {
            props.onDone?.();
            return;
          }
          const next = e.target.value;
          props.onSave(next ? next : null);
          setDirty(false);
          props.onDone?.();
        }}
      >
        <option value="">—</option>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {dirty ? <span className="text-muted small">●</span> : null}
    </div>
  );
}

export interface BuildDictionaryColumnsInput {
  editing: { id: number; field: "data_type" | "description" } | null;
  patchM: { mutate: (args: any) => void; isPending: boolean };
  onSetEditing: (
    v: { id: number; field: "data_type" | "description" } | null,
  ) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  onOpenPreview: (row: WorkspaceDictionaryColumn) => void;
}

export function buildDictionaryColumns({
  editing,
  patchM,
  onSetEditing,
  activeOnly,
  onActiveOnlyChange,
  onOpenPreview,
}: BuildDictionaryColumnsInput): ColumnDef<WorkspaceDictionaryColumn>[] {
  return [
    {
      header: "Column",
      accessorKey: "column_name",
      meta: { className: "col-colname" },
      cell: ({ row }) => (
        <div className="text-truncate" title={row.original.column_name}>
          {row.original.column_name}
        </div>
      ),
    },
    {
      header: "Data Type",
      accessorKey: "data_type",
      meta: { className: "col-dtype" },
      cell: ({ row }) => {
        const isEditing =
          editing?.id === row.original.id && editing.field === "data_type";
        if (!isEditing) {
          const label = row.original.data_type ?? "—";
          return (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none"
              onClick={() =>
                onSetEditing({ id: row.original.id, field: "data_type" })
              }
              disabled={patchM.isPending}
              title="Click to edit"
            >
              {label}
            </button>
          );
        }
        return (
          <DataTypeSelect
            value={row.original.data_type ?? null}
            options={DATA_TYPE_OPTIONS}
            disabled={patchM.isPending}
            resetKey={`${row.original.id}:${row.original.data_type ?? ""}`}
            onDone={() => onSetEditing(null)}
            onSave={(next) =>
              patchM.mutate({ id: row.original.id, patch: { data_type: next } })
            }
          />
        );
      },
    },
    {
      header: "Preview",
      id: "previewData",
      meta: { className: "col-preview" },
      cell: ({ row }) => (
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-decoration-none dict-preview-link"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenPreview(row.original);
          }}
        >
          Preview data
        </button>
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
      meta: { className: "col-desc" },
      cell: ({ row }) => {
        const isEditing =
          editing?.id === row.original.id && editing.field === "description";
        if (!isEditing) {
          const text = (row.original.description ?? "").trim();
          const previewText = text
            ? text.length > 80
              ? `${text.slice(0, 80)}…`
              : text
            : "—";
          return (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none text-start w-100 dict-desc-button"
              onClick={() =>
                onSetEditing({ id: row.original.id, field: "description" })
              }
              disabled={patchM.isPending}
              title="Click to edit"
            >
              <span className="text-truncate d-block">{previewText}</span>
            </button>
          );
        }
        return (
          <InlineTextArea
            value={row.original.description ?? ""}
            placeholder="Describe what this column means…"
            disabled={patchM.isPending}
            resetKey={`${row.original.id}:${row.original.description ?? ""}`}
            onDone={() => onSetEditing(null)}
            onSave={(next) =>
              patchM.mutate({
                id: row.original.id,
                patch: { description: next.trim() ? next : null },
              })
            }
          />
        );
      },
    },
    {
      header: "Active",
      accessorKey: "is_active",
      meta: { className: "col-active" },
      cell: ({ row }) => (
        <div className="form-check m-0">
          <input
            className="form-check-input"
            type="checkbox"
            checked={!!row.original.is_active}
            disabled={patchM.isPending}
            onChange={(e) => {
              const nextIsActive = e.target.checked;
              if (!nextIsActive && activeOnly) onActiveOnlyChange(false);
              patchM.mutate({
                id: row.original.id,
                patch: { is_active: nextIsActive },
              });
            }}
          />
        </div>
      ),
    },
  ];
}

export interface DictionaryColumnGridProps {
  selectedTable: { id: number; name: string } | null;
  rows: WorkspaceDictionaryColumn[];
  tableInst: Table<WorkspaceDictionaryColumn>;
  columns: ColumnDef<WorkspaceDictionaryColumn>[];
  modelQ: UseQueryResult;
  patchM: UseMutationResult<any, any, any, any>;
  editing: { id: number; field: "data_type" | "description" } | null;
  onSetEditing: (
    v: { id: number; field: "data_type" | "description" } | null,
  ) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  onOpenPreview: (row: WorkspaceDictionaryColumn) => void;
  rowRefMap: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
  pulsedColumnKey: string | null;
  qDraft: string;
  onQDraftChange: (v: string) => void;
  statusText: string;
}

export const DictionaryColumnGrid: React.FC<DictionaryColumnGridProps> = ({
  selectedTable,
  rows,
  tableInst,
  columns,
  modelQ,
  patchM,
  editing: _editing,
  onSetEditing: _onSetEditing,
  activeOnly: _activeOnly,
  onActiveOnlyChange: _onActiveOnlyChange,
  onOpenPreview: _onOpenPreview,
  rowRefMap,
  pulsedColumnKey,
  qDraft,
  onQDraftChange,
  statusText,
}) => {
  return (
    <div className="card">
      <div className="card-header py-2">
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div className="dict-selected-table-title">
            {selectedTable?.name || "Select a table"}
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <div className="input-group input-group-sm" style={{ width: 360 }}>
              <span className="input-group-text bg-white">
                <i className="fa fa-search text-muted" aria-hidden="true" />
              </span>
              <input
                className="form-control"
                value={qDraft}
                onChange={(e) => onQDraftChange(e.target.value)}
                placeholder="Search columns (name / description)…"
                disabled={!selectedTable}
              />
            </div>
            <div
              className="text-muted small text-end"
              style={{ minWidth: 110 }}
            >
              <span
                style={{ visibility: statusText ? "visible" : "hidden" }}
              >
                {statusText || "…"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body p-0">
        {!selectedTable ? (
          <div className="p-3">
            <EmptySectionState
              iconClass="fa-table"
              title="Select a table"
              subtitle="Click a table on the left to load and edit its columns."
              ctaLabel="Select"
              onClick={() => {}}
            />
          </div>
        ) : (
          <>
            {modelQ.isError ? (
              <div className="alert alert-danger m-3 py-2">
                {(modelQ.error as Error).message}
              </div>
            ) : null}

            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 dict-table">
                <thead className="dict-thead">
                  {tableInst.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => {
                        const cls =
                          (h.column.columnDef.meta as any)?.className ?? "";
                        return (
                          <th key={h.id} className={`px-3 py-2 ${cls}`}>
                            {flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {modelQ.isLoading ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-3">
                        Loading…
                      </td>
                    </tr>
                  ) : tableInst.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-3">
                        No results.
                      </td>
                    </tr>
                  ) : (
                    tableInst.getRowModel().rows.map((r) => {
                      const key = toColumnLookupKey(
                        selectedTable?.name ?? "",
                        r.original.column_name,
                      );
                      const pulsing = pulsedColumnKey === key;
                      return (
                        <tr
                          key={r.id}
                          className={pulsing ? "dict-column-pulse" : ""}
                          ref={(node) => {
                            if (node) rowRefMap.current.set(key, node);
                            else rowRefMap.current.delete(key);
                          }}
                        >
                          {r.getVisibleCells().map((c) => {
                            const cls =
                              (c.column.columnDef.meta as any)?.className ?? "";
                            return (
                              <td key={c.id} className={`px-3 py-2 ${cls}`}>
                                {flexRender(
                                  c.column.columnDef.cell,
                                  c.getContext(),
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center p-2 border-top">
              <div className="text-muted small">
                Rows: {rows.length.toLocaleString()}
              </div>
              <div className="d-flex gap-2 align-items-center">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => tableInst.previousPage()}
                  disabled={!tableInst.getCanPreviousPage()}
                >
                  Prev
                </button>
                <div className="text-muted small">
                  Page {tableInst.getState().pagination.pageIndex + 1} of{" "}
                  {tableInst.getPageCount() || 1}
                </div>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => tableInst.nextPage()}
                  disabled={!tableInst.getCanNextPage()}
                >
                  Next
                </button>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 120 }}
                  value={tableInst.getState().pagination.pageSize}
                  onChange={(e) =>
                    tableInst.setPageSize(Number(e.target.value))
                  }
                >
                  {[25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n}/page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Run tests — all should pass**

```bash
cd query-forge-ui
npm run test -- --run src/features/domain-studio/ui/components/__tests__/DictionaryColumnGrid.test.tsx 2>&1 | tail -15
```
Expected: `5 passed`

- [ ] **Step 3: Commit**

```bash
cd query-forge-ui
git add src/features/domain-studio/ui/components/DictionaryColumnGrid.tsx \
        src/features/domain-studio/ui/components/__tests__/DictionaryColumnGrid.test.tsx
git commit -m "refactor(dictionary): extract DictionaryColumnGrid with tests"
```

---

## Task 9: Slim `DictionaryTab.tsx` and extend its tests

**Files:**
- Modify: `src/features/domain-studio/ui/components/DictionaryTab.tsx`
- Modify: `src/features/domain-studio/ui/components/__tests__/DictionaryTab.test.tsx`

- [ ] **Step 1: Extend the test file with 3 new tests**

Add these three `describe` blocks after the existing one in `DictionaryTab.test.tsx`:

```tsx
import { http, HttpResponse } from "msw";

const tablesPath = /\/dictionary\/tables/;
const columnsPath = /\/dictionary\/columns(?!\/search)/;

const TABLES = [
  { id: 1, table_name: "apple_table", full_name: "apple_table" },
  { id: 2, table_name: "zebra_table", full_name: "zebra_table" },
];

const COLUMNS = [
  {
    id: 10,
    workspace_table_id: 1,
    column_name: "col_a",
    data_type: "string",
    ordinal_position: 1,
    description: "Column A",
    is_active: true,
    semantic_type: null,
    semantic_entity: null,
    semantic_sub_type: null,
    semantic_confidence: null,
    sample_values_json: null,
    sample_stats_json: null,
    sample_ran_at: null,
    sample_error: null,
    table_name: "apple_table",
  },
];

describe("DictionaryTab — empty state", () => {
  it("shows 'Select a table' empty state when no table is selected", async () => {
    server.use(
      http.get(tablesPath, () =>
        HttpResponse.json({ rows: TABLES, total: 2 }),
      ),
    );

    render(<DictionaryTab />, { wrapper });

    expect(
      await screen.findByText(/Select a table/i),
    ).toBeInTheDocument();
  });
});

describe("DictionaryTab — table selection", () => {
  it("selecting a table renders the column grid", async () => {
    server.use(
      http.get(tablesPath, () =>
        HttpResponse.json({ rows: TABLES, total: 2 }),
      ),
      http.get(columnsPath, () => HttpResponse.json({ rows: COLUMNS })),
    );

    render(<DictionaryTab />, { wrapper });

    const tableBtn = await screen.findByRole("button", {
      name: /apple_table/i,
    });
    await userEvent.click(tableBtn);

    await waitFor(() => {
      expect(screen.getByText("col_a")).toBeInTheDocument();
    });
  });
});

describe("DictionaryTab — upload modal", () => {
  it("upload modal opens and closes", async () => {
    server.use(
      http.get(tablesPath, () =>
        HttpResponse.json({ rows: [], total: 0 }),
      ),
    );

    render(<DictionaryTab />, { wrapper });

    const uploadBtn = await screen.findByRole("button", { name: /^upload$/i });
    await userEvent.click(uploadBtn);

    expect(
      screen.getByRole("heading", { name: /upload data dictionary/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^close$/i }));

    expect(
      screen.queryByRole("heading", { name: /upload data dictionary/i }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run new tests — expect them to pass against current DictionaryTab**

```bash
cd query-forge-ui
npm run test -- --run src/features/domain-studio/ui/components/__tests__/DictionaryTab.test.tsx 2>&1 | tail -15
```
Expected: `4 passed` (1 existing + 3 new)

- [ ] **Step 3: Replace DictionaryTab.tsx with the slimmed orchestrator**

```tsx
// src/features/domain-studio/ui/components/DictionaryTab.tsx
import React, {
  useCallback,
  useDeferredValue,
  useMemo,
  useTransition,
  useState,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  fetchColumnSample,
  WorkspaceDictionaryColumn,
} from "../../../../shared/services/queryStudioAdminApi";
import type { DomainColumnRef } from "../../../query-forge/model/domainCatalog";
import { ColumnPreviewDrawer } from "../../../query-forge/ui/components/ColumnPreviewDrawer";
import { useDebounce } from "../../../../shared/runtime/useDeboune";
import { useDictionaryData } from "./useDictionaryData";
import { useDictionaryNavigation } from "./useDictionaryNavigation";
import { DictionaryTablePanel } from "./DictionaryTablePanel";
import {
  buildDictionaryColumns,
  DictionaryColumnGrid,
} from "./DictionaryColumnGrid";
import { toPreviewColumn } from "./dictionaryTabUtils";
import "../style/dictionaryTab.css";

const GLOBAL_SEARCH_DEBOUNCE_MS = 300;

type PreviewState = { col: DomainColumnRef } | null;

/** Upload modal — tightly coupled to orchestrator-level upload/import state */
function UploadModal(props: {
  open: boolean;
  onClose: () => void;
  onUploaded: (result: {
    updated: number;
    unmatched: Array<{ table_name: string; column_name: string }>;
  }) => void;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fullReplace, setFullReplace] = useState(false);

  const uploadM = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please choose a file.");
      const { importDictionary } = await import(
        "../../../../shared/services/queryStudioAdminApi"
      );
      return importDictionary(file, fullReplace);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["dictColumns"] });
      qc.invalidateQueries({ queryKey: ["dictTables"] });
      props.onUploaded(data);
      props.onClose();
      setFile(null);
      setFullReplace(false);
    },
  });

  if (!props.open) return null;

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      onMouseDown={props.onClose}
      style={{ background: "rgba(0,0,0,.35)" }}
    >
      <div
        className="modal-dialog modal-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Upload Data Dictionary</h5>
            <button
              type="button"
              className="btn-close"
              onClick={props.onClose}
            />
          </div>
          <div className="modal-body">
            <div className="vstack gap-2">
              <div className="small text-muted">
                Expected columns: <code>table_name</code>,{" "}
                <code>column_name</code>, <code>data_type</code>,{" "}
                <code>description</code>
              </div>
              <label htmlFor="dictUploadFile" className="form-label">
                File
              </label>
              <input
                id="dictUploadFile"
                type="file"
                className="form-control"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="form-check">
                <input
                  className="form-check-input"
                  id="fullReplace"
                  type="checkbox"
                  checked={fullReplace}
                  onChange={(e) => setFullReplace(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="fullReplace">
                  Full replace (clear all descriptions and data types before
                  applying)
                </label>
              </div>
              {uploadM.isError ? (
                <div className="alert alert-danger py-2 mb-0">
                  {(uploadM.error as Error).message}
                </div>
              ) : null}
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={props.onClose}
            >
              Close
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => uploadM.mutate()}
              disabled={!file || uploadM.isPending}
            >
              {uploadM.isPending ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const DictionaryTab: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [tableFilter, setTableFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [globalSearchDraft, setGlobalSearchDraft] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [editing, setEditing] = useState<{
    id: number;
    field: "data_type" | "description";
  } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [importUnmatched, setImportUnmatched] = useState<
    Array<{ table_name: string; column_name: string }>
  >([]);
  const [preview, setPreview] = useState<PreviewState>(null);

  const [isSwitching, startTransition] = useTransition();
  const qDeferred = useDeferredValue(qDraft);
  const debouncedGlobalSearchTerm = useDebounce(
    globalSearchDraft.trim(),
    GLOBAL_SEARCH_DEBOUNCE_MS,
  );
  const isGlobalSearchMode = globalSearchDraft.trim().length > 0;

  const {
    allTableNames,
    filteredTableNames,
    rows,
    globalColumnHits: _hits,
    globalTableResults,
    globalColumnResults,
    patchM,
    tableNamesQ,
    modelQ,
    globalSearchQ,
  } = useDictionaryData({
    selectedTable,
    activeOnly,
    qDeferred,
    debouncedGlobalSearchTerm,
    tableFilter,
  });

  const showGlobalSearching =
    isGlobalSearchMode &&
    (debouncedGlobalSearchTerm !== globalSearchDraft.trim() ||
      globalSearchQ.isFetching);

  const statusText = patchM.isPending
    ? "Saving…"
    : isSwitching
      ? "Switching…"
      : selectedTable && modelQ.isFetching
        ? "Refreshing…"
        : "";

  const openPreview = useCallback((row: WorkspaceDictionaryColumn) => {
    const previewCol = toPreviewColumn(row);
    setPreview({ col: previewCol });
    const wsTableId = row.workspace_table_id;
    if (!wsTableId) return;
    fetchColumnSample({
      workspace_table_id: wsTableId,
      column_name: row.column_name,
      limit: 50,
    })
      .then((sample) => {
        setPreview((current) => {
          if (!current || current.col.identityKey !== previewCol.identityKey)
            return current;
          return {
            col: {
              ...current.col,
              sampleValues: sample.values ?? current.col.sampleValues,
              sampleStats:
                sample.sampleStatsJson ?? current.col.sampleStats,
              sampleRanAt: sample.sampleRanAt ?? current.col.sampleRanAt,
              sampleError: sample.error ?? current.col.sampleError,
            },
          };
        });
      })
      .catch(() => {
        setPreview((current) => {
          if (!current || current.col.identityKey !== previewCol.identityKey)
            return current;
          return {
            col: {
              ...current.col,
              sampleError: "Failed to load sample data.",
            },
          };
        });
      });
  }, []);

  const columns = useMemo(
    () =>
      buildDictionaryColumns({
        editing,
        patchM,
        onSetEditing: setEditing,
        activeOnly,
        onActiveOnlyChange: setActiveOnly,
        onOpenPreview: openPreview,
      }),
    [patchM.isPending, editing, activeOnly, openPreview],
  );

  const tableInst = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const pagination = tableInst.getState().pagination;

  const { rowRefMap, tableButtonRefMap, jumpToColumn, setJumpToColumn, pulsedColumnKey } =
    useDictionaryNavigation({
      selectedTable,
      rows,
      isGlobalSearchMode,
      tableFilter,
      filteredTableNames,
      pagination,
      tableInst,
    });

  return (
    <div className="p-3">
      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
        <div>
          <div className="fw-bold">Dictionary</div>
          <div className="text-muted small">
            Select a table on the left, then edit column metadata on the right.
          </div>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => modelQ.refetch()}
            disabled={!selectedTable}
          >
            Refresh
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setUploadOpen(true)}
            disabled={uploadOpen}
            aria-hidden={uploadOpen || undefined}
          >
            Upload
          </button>
        </div>
      </div>

      <hr className="my-3" />

      {importUnmatched.length > 0 && (
        <div
          className="alert alert-warning alert-dismissible fade show mt-2"
          role="alert"
        >
          {importUnmatched.length} column(s) in your file weren&apos;t found in
          the workspace. Run a catalog sync to import source columns first.
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setImportUnmatched([])}
          />
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-lg-3">
          <DictionaryTablePanel
            allTableNames={allTableNames}
            filteredTableNames={filteredTableNames}
            tableFilter={tableFilter}
            onTableFilterChange={setTableFilter}
            selectedTable={selectedTable}
            onSelectTable={(t) => {
              setEditing(null);
              setJumpToColumn(null);
              setQDraft("");
              startTransition(() => setSelectedTable(t));
            }}
            tableButtonRefMap={tableButtonRefMap}
            tableNamesQ={tableNamesQ}
            globalSearchDraft={globalSearchDraft}
            onGlobalSearchChange={setGlobalSearchDraft}
            debouncedGlobalSearchTerm={debouncedGlobalSearchTerm}
            isGlobalSearchMode={isGlobalSearchMode}
            showGlobalSearching={showGlobalSearching}
            globalSearchQ={globalSearchQ}
            globalTableResults={globalTableResults}
            globalColumnResults={globalColumnResults}
            onJumpToColumn={setJumpToColumn}
            activeOnly={activeOnly}
            onActiveOnlyChange={setActiveOnly}
            onSetEditing={() => setEditing(null)}
            onClearQDraft={() => setQDraft("")}
            isSwitching={isSwitching}
            startTransition={startTransition}
          />
        </div>

        <div className="col-12 col-lg-9">
          <DictionaryColumnGrid
            selectedTable={selectedTable}
            rows={rows}
            tableInst={tableInst}
            columns={columns}
            modelQ={modelQ}
            patchM={patchM}
            editing={editing}
            onSetEditing={setEditing}
            activeOnly={activeOnly}
            onActiveOnlyChange={setActiveOnly}
            onOpenPreview={openPreview}
            rowRefMap={rowRefMap}
            pulsedColumnKey={pulsedColumnKey}
            qDraft={qDraft}
            onQDraftChange={setQDraft}
            statusText={statusText}
          />
        </div>
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(result) => setImportUnmatched(result.unmatched)}
      />

      {preview ? (
        <ColumnPreviewDrawer
          open={!!preview}
          onClose={() => setPreview(null)}
          col={preview.col}
          isSelected={false}
          showSelectAction={false}
        />
      ) : null}
    </div>
  );
};
```

- [ ] **Step 4: Run all DictionaryTab-related tests**

```bash
cd query-forge-ui
npm run test -- --run src/features/domain-studio/ui/components/__tests__/ 2>&1 | tail -20
```
Expected: all tests in that directory pass (`4 + 5 + 5 + 5 = ~19 passed`).

- [ ] **Step 5: Commit**

```bash
cd query-forge-ui
git add src/features/domain-studio/ui/components/DictionaryTab.tsx \
        src/features/domain-studio/ui/components/__tests__/DictionaryTab.test.tsx
git commit -m "refactor(dictionary): slim DictionaryTab to orchestrator, extend tests"
```

---

## Task 10: Final verification and version bump

- [ ] **Step 1: Run the full test suite**

```bash
cd query-forge-ui
npm run test -- --run 2>&1 | tee /tmp/queryforge-full-vitest.log; test ${PIPESTATUS[1]} -eq 0
```
Expected: exit code 0. New test count should be ~19 higher than before this refactor. The existing `DictionaryTab.test.tsx` upload banner test must still pass.

- [ ] **Step 2: Check TypeScript**

```bash
cd query-forge-ui && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```
Expected: zero new errors introduced by this refactor (pre-existing errors in unrelated files are acceptable).

- [ ] **Step 3: Bump version**

In `query-forge-ui/package.json`, increment the patch version (e.g. `0.3.43` → `0.3.44`).

- [ ] **Step 4: Update the frontend audit**

In `.claude/audits/frontend-audit.md`, mark ISSUE-002 and ISSUE-028 as resolved:

```
**ISSUE-002 [High] — ✅ RESOLVED (2026-04-04)**
**ISSUE-028 [Low] — ✅ RESOLVED (2026-04-04)**
```

- [ ] **Step 5: Final commit**

```bash
cd query-forge-ui
git add package.json
git add -p .claude/audits/frontend-audit.md
git commit -m "refactor(dictionary): bump version, mark ISSUE-002 and ISSUE-028 resolved"
```
