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
