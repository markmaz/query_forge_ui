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
    startTransition: ((fn: () => void) =>
      fn()) as React.TransitionStartFunction,
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
    render(<DictionaryTablePanel {...makeMinimalProps({ onSelectTable })} />);
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
    expect(screen.getAllByText("Tables").length).toBeGreaterThanOrEqual(1);
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
