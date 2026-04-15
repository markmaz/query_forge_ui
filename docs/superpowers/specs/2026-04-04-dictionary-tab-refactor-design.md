# DictionaryTab Refactor Design

**Date:** 2026-04-04
**Audit refs:** ISSUE-002 (1,357-line monolith), ISSUE-028 (duplicated `useDebouncedValue`)
**Scope:** `src/features/domain-studio/ui/components/`

---

## Problem

`DictionaryTab.tsx` is 1,357 lines. It co-locates data fetching, scroll/navigation logic, left-panel JSX, right-panel JSX, inline editor sub-components, helper utilities, and upload modal in a single file. This makes individual concerns impossible to test in isolation and the file difficult to navigate or change safely.

---

## Goal

Split into focused files following the flat same-directory pattern used by `DomainDrawerTablesTab.tsx`, `DomainDrawerUsersTab.tsx`, etc. `DictionaryTab.tsx` becomes a ~100-line orchestrator. Also fixes ISSUE-028 by replacing the local `useDebouncedValue` duplicate with the shared `useDebounce`.

---

## File Layout

```
src/features/domain-studio/ui/components/
  dictionaryTabUtils.ts             # pure helpers, no React
  useDictionaryData.ts              # queries, mutation, derived data
  useDictionaryNavigation.ts        # scroll refs, jump-to-column, pulse timer
  DictionaryTablePanel.tsx          # left sidebar (table list + global search)
  DictionaryColumnGrid.tsx          # right panel (TanStack table + pagination)
                                    #   contains InlineTextArea, DataTypeSelect
  DictionaryTab.tsx                 # ~100-line orchestrator; UploadModal stays here
  __tests__/
    DictionaryTab.test.tsx          # existing test — untouched
    useDictionaryData.test.ts       # new
    DictionaryTablePanel.test.tsx   # new
    DictionaryColumnGrid.test.tsx   # new
```

---

## Architecture

### `dictionaryTabUtils.ts`

Pure functions with no React dependencies. Extracted from the top of the current file:

- `escapeRegExp(value: string): string`
- `renderHighlightedText(text: string, query: string): React.ReactNode`
- `buildDescriptionSnippet(description, query, maxLen?): string | null`
- `toColumnLookupKey(tableName: string, columnName: string): string`
- `toPreviewColumn(row: WorkspaceDictionaryColumn): DomainColumnRef`

### `useDictionaryData`

**Inputs:**
```ts
{
  selectedTable: { id: number; name: string } | null;
  activeOnly: boolean;
  qDeferred: string;
  debouncedGlobalSearchTerm: string;
  tableFilter: string;
}
```

**Owns:** `tableNamesQ`, `modelQ`, `globalSearchQ`, `patchM` — no state.

**Returns:** `{ allTableNames, filteredTableNames, rows, globalColumnHits, globalTableResults, globalColumnResults, patchM, tableNamesQ, modelQ, globalSearchQ }`

The hook owns no state. `tableFilter` lives in the orchestrator and is passed in as an input; `filteredTableNames` is derived inside the hook from `allTableNames` + `tableFilter`. Uses `useDebounce` from `src/shared/runtime/useDeboune.ts` — the local duplicate is removed.

### `useDictionaryNavigation`

**Inputs:**
```ts
{
  selectedTable: { id: number; name: string } | null;
  rows: WorkspaceDictionaryColumn[];
  isGlobalSearchMode: boolean;
  tableFilter: string;
  filteredTableNames: Array<{ id: number; name: string }>;
  pagination: { pageIndex: number; pageSize: number };
  tableInst: Table<WorkspaceDictionaryColumn>;
}
```

**Owns:** `rowRefMap`, `tableButtonRefMap`, `pulseTimerRef`, `pulsedColumnKey`, `jumpToColumn`

**Returns:** `{ rowRefMap, tableButtonRefMap, jumpToColumn, setJumpToColumn, pulsedColumnKey }`

Contains the three `useEffect`s:
1. Cleanup pulse timer on unmount
2. Jump-to-column + scroll + pulse on `jumpToColumn` change
3. Scroll selected table button into view on `selectedTable` change

### `DictionaryTablePanel`

Left sidebar — receives all data as props, fires callbacks, owns no state.

**Props:**
```ts
{
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
```

### `DictionaryColumnGrid`

Right panel — contains `InlineTextArea` and `DataTypeSelect` as local sub-components (they are small, only used here, and have no reason to be separate files).

**Props:**
```ts
{
  selectedTable: { id: number; name: string } | null;
  rows: WorkspaceDictionaryColumn[];
  tableInst: Table<WorkspaceDictionaryColumn>;
  columns: ColumnDef<WorkspaceDictionaryColumn>[];
  modelQ: UseQueryResult;
  patchM: UseMutationResult;
  editing: { id: number; field: 'data_type' | 'description' } | null;
  onSetEditing: (v: { id: number; field: 'data_type' | 'description' } | null) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  onOpenPreview: (row: WorkspaceDictionaryColumn) => void;
  rowRefMap: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
  pulsedColumnKey: string | null;
  qDraft: string;
  onQDraftChange: (v: string) => void;
  statusText: string;
}
```

### `DictionaryTab` (orchestrator)

Owns:
- `selectedTable`, `tableFilter`, `activeOnly`, `globalSearchDraft`, `qDraft`, `editing`, `uploadOpen`, `importUnmatched`, `preview`
- `useTransition` / `useDeferredValue`
- Calls `useDictionaryData` and `useDictionaryNavigation`
- Derives `isGlobalSearchMode`, `debouncedGlobalSearchTerm`, `showGlobalSearching`, `statusText`
- Constructs `columns` definition (TanStack `ColumnDef` array) and `tableInst`
- `openPreview` callback
- Renders: `DictionaryTablePanel`, `DictionaryColumnGrid`, `UploadModal`, `ColumnPreviewDrawer`

`UploadModal` stays in `DictionaryTab.tsx` — it's tightly coupled to `importUnmatched` and `uploadOpen` which are orchestrator-level concerns.

---

## Testing Plan

### `useDictionaryData.test.ts` (renderHook + MSW, ~8 tests)

- Returns table list sorted alphabetically
- `filteredTableNames` correctly filters by `tableFilter`
- Global search query is disabled when `debouncedGlobalSearchTerm` is empty
- Global search query fires when term is non-empty
- `patchM.mutate` optimistically updates the cache
- `patchM` rolls back on error

### `DictionaryTablePanel.test.tsx` (~8 tests)

- Renders table list
- Clicking a table fires `onSelectTable`
- Renders global search results (table section + column section) when `isGlobalSearchMode` is true
- Clicking a table result in global search fires `onSelectTable`
- Clicking a column result in global search fires `onSelectTable` + `onJumpToColumn`
- Shows "No matches" state when global search returns empty

### `DictionaryColumnGrid.test.tsx` (~8 tests)

- Shows empty state when `selectedTable` is null
- Renders columns for selected table
- Clicking a data type cell enters edit mode (shows DataTypeSelect)
- Clicking a description cell enters edit mode (shows InlineTextArea)
- Toggling `is_active` checkbox fires `patchM.mutate`
- Pagination prev/next buttons enable/disable correctly

### `DictionaryTab.test.tsx` (extend existing, +3 tests)

- Shows empty state when no table is selected (extend existing setup)
- Selecting a table triggers column grid render
- Upload modal opens on button click and closes on cancel

---

## Constraints

- No behaviour changes — this is a pure structural refactor
- `DictionaryTab`'s external API (no props) does not change
- The existing `DictionaryTab.test.tsx` test must continue to pass without modification
- Follow Bootstrap/Reactstrap-only UI conventions
- CSS file (`dictionaryTab.css`) is not touched
