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
  vi,
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

    const { result } = renderHook(() => useDictionaryData(defaultInput), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.tableNamesQ.isSuccess).toBe(true);
    });

    expect(result.current.allTableNames.map((t) => t.name)).toEqual([
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
    const fetchSpy = vi.fn();
    server.use(
      http.get(searchPath, () => {
        fetchSpy();
        return HttpResponse.json({ rows: [] });
      }),
    );

    const { result } = renderHook(
      () =>
        useDictionaryData({ ...defaultInput, debouncedGlobalSearchTerm: "" }),
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
        HttpResponse.json({
          rows: [{ ...COLUMNS[0], table_name: "apple_table" }],
        }),
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
      http.patch(patchPath, () =>
        HttpResponse.json({ ...COLUMNS[0], description: "Updated" }),
      ),
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

    // Override GET to return updated data so refetch after invalidation also shows "Updated"
    server.use(
      http.get(columnsPath, () =>
        HttpResponse.json({
          rows: [{ ...COLUMNS[0], description: "Updated" }, COLUMNS[1]],
        }),
      ),
    );

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
