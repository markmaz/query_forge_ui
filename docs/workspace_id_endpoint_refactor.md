# Workspace-First Endpoint Refactor Inventory

## Scope
- Semantic admin API clients
- Domain studio API clients
- Query/cache keys for semantic and domain screens

## Updated call sites

### Workspace-ready
- `src/shared/services/semantic/conceptColumnMaps.ts`
  - Uses `workspace_column_id` for list/create/update when workspace payload mode is enabled.
  - Strips deprecated `model_column_id` on writes and list filters in workspace mode.
- `src/shared/services/semantic/semanticMappings.ts`
  - New service for `/semantic/mappings` with workspace-first request shape.
  - Strips deprecated `model_column_id` on writes and list filters in workspace mode.
- `src/shared/services/queryStudioAdminApi.ts`
  - `createDomain` / `updateDomain` strip `model_table_id` in workspace payload mode.

### Mixed / compatibility
- `src/shared/services/semantic/schemas.ts`
  - Response parsing tolerates both `model_column_id` and `workspace_column_id`.
  - Mutation schema requires `workspace_column_id`; allows optional `model_column_id` fallback.
- `src/shared/services/semantic/common.ts`
  - One-time warning logger for legacy model-id fields in workspace mode.

### UI screens refactored
- `src/features/semantic-admin/ui/ConceptColumnMapsPage.tsx`
  - Drawer now selects `Workspace Table` + `Workspace Column`.
  - List filter supports `workspace_column_id`.
  - Cache key includes workspace ID.
- `src/features/domain-studio/ui/components/DomainsTab.tsx`
  - Domain create no longer sends `model_table_id`.
  - Cache keys scoped by workspace ID.
- `src/features/domain-studio/ui/components/DomainDrawer.tsx`
  - Domain update no longer sends `model_table_id`.
  - Cache invalidation includes workspace-scoped keys.
- `src/features/domain-studio/ui/components/DomainTableModal.tsx`
  - Workspace-scoped query keys and API calls.

## Feature flag
- Added `REACT_APP_USE_WORKSPACE_IDS` / `VITE_USE_WORKSPACE_IDS`.
- Runtime key: `appRuntimeConfig.useWorkspaceIdPayloads`.
- Default behavior:
  - non-prod: `true`
  - prod: `false` unless explicitly enabled

## Follow-up
- Remove residual model-ID read compatibility once backend/client telemetry shows no legacy dependency.
