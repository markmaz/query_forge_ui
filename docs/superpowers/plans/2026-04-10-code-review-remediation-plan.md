# Code Review Remediation Plan

Date: 2026-04-10
Repo: `query-forge-ui`
Commit reviewed: `4a1c66e`

## Scope

This plan captures the remediation work for the current committed review findings:

1. `PURGE_QUERY` is exposed in the UI but not implemented.
2. The app shell leaks `resize` listeners.
3. The shared MSW server lifecycle is masking test isolation problems.
4. `SavedQueriesPanel` contains dead code from an incomplete refactor.
5. `SubMenu` contains dead pinning code and broad hook-rule suppression.
6. Repo hygiene is weak enough to create avoidable review noise.

## Execution Order

1. Fix `PURGE_QUERY`
2. Fix the app-shell resize listener leak
3. Normalize the MSW lifecycle
4. Remove dead code from saved queries
5. Remove dead code and suppressions from submenu
6. Tighten repo hygiene

## Work Plan

## Missing Tests To Add

### High Priority

- Add saved-query trash purge tests:
  - trash query menu exposes `Purge` only when the action is supported
  - clicking `Purge` calls the purge API path
  - the saved-query tree refreshes after purge
  - unsupported purge states surface a clear error or are not rendered
- Add app-shell resize lifecycle tests:
  - registers a single resize listener
  - removes the listener on unmount
  - does not accumulate listeners as `sidebarTypes` changes
- Add MSW lifecycle safety coverage:
  - shared setup owns `listen/resetHandlers/close`
  - shared-server tests do not require local `listen/close`
  - unhandled requests still fail when expected

### Medium Priority

- Add saved-queries panel regression coverage:
  - panel search filters the rendered tree path correctly
  - removing dead flat-list logic does not change visible behavior
- Add submenu regression coverage:
  - guarded items hide/show correctly
  - active/open route state initializes correctly after mount
  - pinning behavior is either covered or removed entirely

### 1. Fix `PURGE_QUERY`

#### Goal

Ensure the UI does not expose a destructive action that silently does nothing.

#### Tasks

- Inspect whether a saved-query purge endpoint already exists in the frontend service layer.
- If a purge endpoint exists:
  - Wire `PURGE_QUERY` in `src/features/query-forge/ui/useQueryForgeSavedQueries.ts`.
  - Add success and error feedback.
  - Refetch or invalidate the saved-query tree after purge.
- If no purge endpoint exists:
  - Add saved-query purge support in the frontend query-tree service/client layer if the backend contract already exists but the wrapper is missing.
  - Otherwise remove or disable the `Purge` action for trash queries in `src/shared/components/saved-queries/SavedQueriesTreeSection.tsx`.
  - Ensure the UI remains internally consistent with the backend capability set.
- Add or update tests for trash-query purge behavior.

#### Validation

- Targeted saved-query component tests
- Manual interaction check in the QueryForge saved-queries panel

### 2. Fix the app-shell resize listener leak

#### Goal

Prevent duplicate resize handlers and repeated sidebar dispatches across long sessions.

#### Tasks

- Refactor the `useEffect` in `src/app/shell/index.tsx` to use a stable resize handler.
- Return cleanup that removes the exact registered listener.
- Reevaluate the file-level `react-hooks/exhaustive-deps` suppression:
  - remove it if unnecessary
  - otherwise replace it with the smallest possible local suppression and an explicit reason

#### Validation

- Sidebar still responds correctly to width changes
- No repeated event registration on rerender/state changes

### 3. Normalize the MSW lifecycle

#### Goal

Make test-server ownership explicit and predictable.

#### Tasks

- Revert `src/qa/msw/server.ts` to a plain `setupServer(...handlers)` export.
- Keep `src/qa/setupTests.ts` as the single owner of shared `listen/resetHandlers/close`.
- Remove redundant `server.listen()` and `server.close()` calls from test files that already use the shared setup.
- Preserve standalone `setupServer(...)` usage only where tests intentionally own their own isolated server.
- Rerun the full test suite and fix any tests that were relying on the ref-count wrapper.

#### Validation

- Targeted reruns of semantic-admin, Forge Insights, Workspace LLM, QueryForge page tests
- Full Vitest run

### 4. Remove dead code from saved queries

#### Goal

Eliminate unused code paths left behind by the saved-queries refactor.

#### Tasks

- Remove the unused `filtered` computation from `src/shared/components/saved-queries/SavedQueriesPanel.tsx`.
- Remove the unused `QueryList` component from the same file if it is no longer part of the rendering path.
- Recheck imports and exported types after cleanup.

#### Validation

- Saved-queries component tests
- Type-check/build verification through the existing build pipeline

### 5. Remove dead code and suppressions from submenu

#### Goal

Reduce stale logic and avoid hiding real dependency issues.

#### Tasks

- Remove unused pinning logic from `src/app/chrome/sidebar/widgets/menuList/SubMenu.tsx` if pinning is no longer supported there.
- Remove the commented-out pinning UI if the feature is intentionally retired.
- Remove the file-level `react-hooks/exhaustive-deps` suppression and fix any real dependency issues that surface.

#### Validation

- Existing sidebar/menu tests
- Manual route-navigation sanity check

### 6. Tighten repo hygiene

#### Goal

Reduce generated diff noise from normal validation workflows.

#### Tasks

- Add `coverage/` to `.gitignore`.
- Review whether any other generated local artifacts should also be ignored consistently.

#### Validation

- Run tests/coverage as needed
- Confirm `git status --short` remains clean after validation

## Final Validation

After all changes:

```bash
npm run test -- --run
```

Then verify the repo is clean:

```bash
git status --short
```

## Expected Outcome

- No unsupported destructive actions exposed in the UI
- No app-shell resize listener leak
- Simpler, more predictable shared MSW test lifecycle
- Less dead code in saved-queries and sidebar components
- Cleaner worktree after normal test runs
