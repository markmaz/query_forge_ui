# Frontend Route Contract Migration

This document tracks frontend API call migrations to current Query Forge backend contracts.

## Changed Routes

| Previous Route | Current Route | Contract Changes | Frontend Files |
| --- | --- | --- | --- |
| `GET /api/v1/tenant-admin/:workspaceId` | Removed (no direct replacement). Workspace detail now derived from `GET /api/v1/users/:user_id/workspaces` + `GET /api/v1/workspaces`. | Tenant-admin namespace removed. Workspace detail must be composed from user-workspace membership + workspace catalog. | `src/shared/services/clients/workspaceClient.ts`, `src/shared/services/workspace.ts` |
| `GET /api/v1/tenant-admin/:workspaceId/namespaces` | Replaced by deriving namespaces from `GET /api/v1/domains/workspace-tables` | Namespace list now computed from workspace table inventory (`schema_name`, `catalog_name`), with `X-Workspace-Id` header. | `src/shared/services/queryStudioAdminApi.ts` |
| `GET /api/v1/tenant-admin/users` | `GET /api/v1/workspaces/:workspace_id/users` | Workspace ID is now path-scoped; no tenant-admin namespace. | `src/shared/services/queryStudioAdminApi.ts`, `src/features/domain-studio/ui/components/DomainDrawerUsersTab.tsx` |
| `GET /api/v1/dashboards` | Removed (no direct replacement) | Dashboards namespace removed. Frontend no longer calls removed list endpoint. | `src/shared/services/dashboards.ts` |
| `GET /api/v1/users/:user_id/tenant-admin/:workspace_id/dashboards/:dashboard_id/embed` | `GET /api/v1/users/:user_id/workspaces/:workspace_id/dashboards/:dashboard_id/embed` | Embed endpoint is user + workspace scoped. | `src/shared/services/dashboards.ts` |
| `POST /api/v1/ai/suggest` (legacy body/header behavior) | `POST /api/v1/ai/suggest` (current contract) | `X-Workspace-Id` is authoritative and required for this route. Do not rely on body workspace ID. Deprecation headers are parsed (`X-QueryForge-Deprecated`, `X-QueryForge-Replacement`). | `src/features/query-forge/ui/ai/aiCopilotApi.ts` |
| `POST /api/v1/query` (legacy no-code implementation) | `POST /api/v1/query` (Query Forge implementation) | Path unchanged; frontend keeps existing request shape and mode/paging query params. | `src/shared/services/queryStudioAdminApi.ts` |

## Auth + Workspace Compatibility Updates

| Area | Update | Files |
| --- | --- | --- |
| Workspace key compatibility | Normalize and persist both `workspaceId` and `workspace_id` keys in client storage/state. | `src/shared/services/api.ts` |
| Auth response workspace field normalization | Normalize `workspaceId ?? workspace_id` into `workspace_id` for login/verify responses. | `src/shared/services/auth.ts` |
| Auth state propagation | Apply normalized workspace ID to API workspace context during auth success flows and refresh. | `src/features/identity/model/authSlice.ts`, `src/shared/services/api.ts` |

## Header Contract Changes

- Protected routes continue using `Authorization: Bearer <token>`.
- Workspace-scoped routes now rely on `X-Workspace-Id` as source of truth.
- Added runtime guard/logging for missing workspace header on workspace-scoped endpoints in the API client interceptor.

## Removed Routes (No Remaining Frontend Calls)

- `GET /api/v1/tenant-admin/:workspaceId`
- `GET /api/v1/tenant-admin/:workspaceId/namespaces`
- `GET /api/v1/tenant-admin/users`
- `GET /api/v1/dashboards`

## Test Coverage Added/Updated

- `src/shared/services/__tests__/queryStudioRouteContracts.test.ts`
  - Workspace namespace derivation route
  - Workspace users route
  - Query route call contract
  - Dashboards removal + embed route migration
- `src/shared/services/__tests__/authWorkspaceNormalization.test.ts`
  - `workspaceId`/`workspace_id` auth response normalization
- Existing coverage retained:
  - `src/features/system-admin/api/promptFeedback.test.ts` (admin route family)
  - `src/features/query-forge/ui/ai/__tests__/aiCopilotApi.test.ts` (AI suggest family)
  - `src/shared/services/__tests__/adminSecurityHardening.test.ts` (removed endpoint safety checks)
