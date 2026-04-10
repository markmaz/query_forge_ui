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
  onSetEditing?: (...args: any[]) => any;
  onMutate?: (...args: any[]) => any;
  onOpenPreview?: (...args: any[]) => any;
}) {
  const patchM = { mutate: onMutate, isPending: false } as any;
  const columns = buildDictionaryColumns({
    editing,
    patchM,
    onSetEditing,
    activeOnly: true,
    onActiveOnlyChange: vi.fn(),
    onOpenPreview,
  });
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
    expect(
      screen.getAllByText(/Select a table/i).length,
    ).toBeGreaterThanOrEqual(1);
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
    const descBtn = screen.getByRole("button", {
      name: /Column A description/i,
    });
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
