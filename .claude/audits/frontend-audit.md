# Frontend Agent Audit

## Date
2026-03-09

## Files Reviewed
- `src/features/ingestion/ui/components/DatasourceSelector.tsx` — reference pattern for Reactstrap + useQuery
- `src/features/ingestion/ui/__tests__/DatasourceSelector.test.tsx` — reference test pattern
- `src/shared/services/ingestion.ts` — confirmed `getSchemas(datasource, catalog)` is available
- `src/qa/msw/server.ts` — MSW server setup via `setupServer`

## Completed Work

### Task 6: SchemaSelector + CatalogSchemaSelector + tests

**Files created:**

1. `src/features/ingestion/ui/__tests__/SchemaSelector.test.tsx`
   - 5 tests covering: schema options render, loading state, error fallback (text input), empty schema fallback (text input), disabled state when no datasource

2. `src/features/ingestion/ui/components/SchemaSelector.tsx`
   - Props: `datasource`, `catalog`, `value`, `onChange`, `disabled`
   - Four render branches: no datasource (disabled text input), loading (Spinner), error/empty (Alert + text input fallback), success (select dropdown)
   - Uses `useQuery` with `enabled: Boolean(datasource)`, `staleTime: 30_000`
   - Query key: `["ingestion", "schemas", datasource, catalog]`

3. `src/features/ingestion/ui/components/CatalogSchemaSelector.tsx`
   - Props: `datasource`, `catalog`, `schema`, `onCatalogChange`, `onSchemaChange`, `disabled`
   - Debounces schema query via `committedCatalog` state — only commits catalog value on blur to prevent per-keystroke fetches
   - Resets schema to `""` when catalog changes on blur
   - Composes `SchemaSelector` internally

## Test Results
- 5/5 tests passing
- TypeScript: no errors in ingestion/SchemaSelector/CatalogSchema paths

## Findings
None — implementation is clean. No accessibility issues flagged (semantic HTML throughout: `<label>`, `<select>`, `<input>`, `aria-required`, `aria-busy`, `role="alert"`).

## Recommendations
- ADA agent review recommended for the new components before shipping.

---

### Task 7: SyncConfigForm + test updates

**Date:** 2026-03-09

**Files modified:**

1. `src/features/ingestion/ui/components/SyncConfigForm.tsx`
   - Added `import CatalogSchemaSelector from "./CatalogSchemaSelector"`
   - Added `const [catalog, setCatalog] = useState("")` after schema state
   - Removed `schemaOptions` useMemo (was deriving schemas from workspace tables)
   - Added `useEffect` to reset `schema` and `catalog` when `datasource` changes
   - Replaced the schema `<FormGroup>` + `<Input type="select">` block with `<CatalogSchemaSelector>` + schema error div
   - Updated `buildPayload`: `catalog: null` changed to `catalog: catalog.trim() || null`

2. `src/features/ingestion/ui/__tests__/SyncConfigForm.test.tsx`
   - Added `schemasPath` regex for `GET /ingestion/schemas`
   - Updated `mockDatasourceAndWorkspaceTables()` to register schemas handler returning `["asset", "analytics", "raw"]`
   - Consolidated the two schema-error tests into one: "shows schema required error when submitted without schema" (Start Sync click as trigger)
   - All four tests retained: error on submit without schema, valid payload, confirmation modal, table selection

**Test Results (Task 7):**
- 24/24 tests passing across 6 test files
- TypeScript: no errors in ingestion paths

---

### Task 3 (Data Refinery): Expand patchDictionaryColumn, add patchDictionaryTable, add MSW handler

**Date:** 2026-03-17

**Files modified:**

1. `src/shared/services/queryStudioAdminApi.ts`
   - `patchDictionaryColumn` patch type expanded from 3 fields to 7 — added `semantic_type`, `semantic_entity`, `semantic_sub_type`, `semantic_confidence`
   - `patchDictionaryTable(id, patch)` exported immediately after — returns `{ row: DictionaryTableRow }`

2. `src/qa/msw/handlers.ts`
   - Added `http.patch(API_BASE + /dictionary/tables/:id)` handler returning a sample `DictionaryTableRow` — inserted immediately before the columns PATCH handler

**Test Results:**
- 7 pre-existing test file failures (13 tests) confirmed present on baseline before our changes — no new failures introduced
- TypeScript: no errors on either modified file

---

### Task 4 (Data Refinery): Create DataRefineryPage and register /admin/data-refinery route

**Date:** 2026-03-17

**Files created/modified:**

1. `src/features/system-admin/ui/data-refinery/DataRefineryPage.tsx` (created)
   - Two-level expand/edit UI: table rows expand inline to show columns; separate Edit button per table row opens `TableEditorDrawer`
   - Column rows have row-level `onClick` opening `ColumnEditorDrawer` (semantic metadata: data_type, description, semantic_type, semantic_entity, semantic_sub_type, semantic_confidence, is_active)
   - `patchColumnMut` patch type uses `Parameters<typeof patchDictionaryColumn>[1]` — no `any` on the patch shape
   - Full async state handling: loading skeleton, error message, success view
   - No `createModel*` / `deleteModel*` calls anywhere in file

2. `src/app/navigation/routes.ts` (modified)
   - Added `AdminDataRefinery: "/admin/data-refinery"` immediately after `AdminModelCatalog`

3. `src/app/navigation/AppRoutes.tsx` (modified)
   - Added `import DataRefineryPage` after `ModelCatalogPage` import
   - Added route entry `{ path: routes.AdminDataRefinery, element: <DataRefineryPage />, access: { kind: "admin" } }` immediately after `AdminModelCatalog` entry
   - `AdminModelCatalog` route and import retained

**Test Results:**
- 7 failing test files, 12 failing tests — exactly matches pre-existing baseline; no new failures
- TypeScript: no errors on data-refinery or queryStudioAdminApi paths
