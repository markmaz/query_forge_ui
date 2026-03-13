# ForgeMatch V1 Developer Notes

## Backend contracts (implemented)
All requests are workspace-scoped (auth + `X-Workspace-Id`).

- `POST /forge-match/upload`
  - multipart: `file`
  - returns: `session_id`, `uploaded_filename`, `sheet_count`, `source_record_count`, `source_preview[]`
- `GET /forge-match`
  - params: `page`, `page_size`, `status`, `q`
  - returns: paginated `rows[]` of session metadata
- `POST /forge-match/{session_id}/analyze`
  - body: `{ top_n, domain_id?, vertical_norm?, force? }`
  - returns: `summary`, `mappings[]`, counts
- `POST /forge-match/{session_id}/analyze/start`
  - body: `{ top_n, domain_id?, vertical_norm?, force? }`
  - returns: `job_id`, `status=queued`, `source_total`
- `GET /forge-match/status/{job_id}`
  - returns live run progress (`status`, `current_phase`, `progress_pct`, `source_done/total`, etc.)
- `POST /forge-match/cancel/{job_id}`
  - cancels queued/running analyze runs
- `GET /forge-match/history?limit=n`
  - returns recent analyze run rows
- `GET /forge-match/{session_id}`
  - params: `source_limit/source_offset`, `mapping_limit/mapping_offset`
  - returns: `session`, `source_records[]`, `mappings[]`, `summary`
- `PATCH /forge-match/{session_id}/mappings`
  - body: `{ updates: [{ mapping_id, action?, status?, manually_selected_workspace_column_id?, review_notes? }] }`
  - returns: update ack (`updated`, `rows[]`)
- `GET /forge-match/{session_id}/export?format=csv|xlsx`
  - file response (blob)
- `POST /forge-match/{session_id}/create-view-draft`
- `POST /forge-match/{session_id}/create-domain-draft`
  - body: `{ name?, include_notes? }`
  - returns: `artifact_id`, `accepted_column_count`, `columns[]`

## Frontend behavior
- Upload and analyze use React Query mutations.
- Analyze now uses async run mode (`/analyze/start`) plus run polling:
  - cache key: `['forge-match-run', jobId]`
  - refetch interval: 1.5s while status is `queued|analyzing`
  - auto-stop on terminal status (`analyzed|failed|canceled`)
- Session retrieval uses React Query with cache key:
  - `['forge-match-session', sessionId]`
- Patch/analyze actions invalidate session query and refetch canonical backend data.
- Review actions map to backend `action` values:
  - `accept`, `reject`, `needs_review`, `remap`, `edit_notes`
- Manual remap posts `manually_selected_workspace_column_id`.
- Export uses blob download from backend file response.
- Workflow UI is organized into guided stages:
  - Upload -> Extract -> Analyze -> Review -> Finalize
- Route is workspace-facing at:
  - `/data-foundations/forge-match`
  - deep-link: `/data-foundations/forge-match?sessionId=<id>`
- Review workspace supports two modes:
  - Queue View (prioritized master/detail triage)
  - Table View (power-user grid with sticky headers and row actions)
- Sessions pane supports:
  - search, status filter, page size, pagination, refresh
  - row/open selection into the active review workspace session
  - auto-open of uploaded sessions
- Dashboard data is derived locally via hooks:
  - `useForgeMatchSession` (stepper + status pill)
  - `useForgeMatchSummary` (summary cards/charts/triage counts)
  - `useForgeMatchQueue` (priority ordering for queue review)
- If analysis is in flight, a staged analysis panel animates through extraction/retrieval/ranking phases.
- Active analyze run is deep-linkable with query params:
  - `/data-foundations/forge-match?sessionId=<id>&jobId=<job_id>`

## Main files
- API contracts/client:
  - `src/shared/services/forgeMatch/contracts.ts`
  - `src/shared/services/forgeMatch/service.ts`
- UI feature:
  - `src/features/forgeMatch/pages/ForgeMatchPage.tsx`
  - `src/features/forgeMatch/components/*`
  - `src/features/forgeMatch/hooks/useForgeMatchWorkflow.ts`
  - `src/features/forgeMatch/hooks/useForgeMatchSession.ts`
  - `src/features/forgeMatch/hooks/useForgeMatchSummary.ts`
  - `src/features/forgeMatch/hooks/useForgeMatchQueue.ts`

## Tests
- API client contract/payload tests:
  - `src/shared/services/forgeMatch/__tests__/service.test.ts`
- Schema contract tests:
  - `src/shared/services/forgeMatch/__tests__/contracts.test.ts`
- Page interaction tests:
  - `src/features/forgeMatch/__tests__/ForgeMatchPage.test.tsx`
- Route guard test:
  - `src/features/forgeMatch/__tests__/ForgeMatchRoute.test.tsx`
