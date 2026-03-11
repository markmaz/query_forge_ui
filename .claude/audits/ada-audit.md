# Accessibility Audit — Ingestion Components

**Date:** 2026-03-08
**Auditor:** ADA Accessibility Agent (claude-sonnet-4-6)
**Standard:** WCAG 2.1 Level AA
**Target assistive technologies:** NVDA + Firefox, JAWS + Chrome, VoiceOver + Safari

---

## Files Reviewed

1. `src/features/ingestion/ui/components/DatasourceSelector.tsx`
2. `src/features/ingestion/ui/components/SyncConfigForm.tsx`
3. `src/features/ingestion/ui/components/SyncProgressMonitor.tsx`
4. `src/features/ingestion/ui/components/SyncHistoryTable.tsx`
5. `src/features/ingestion/ui/IngestionPage.tsx`

---

## Findings & Disposition

### Component 1: DatasourceSelector.tsx

| # | WCAG Criterion | Check | Result | Action |
|---|---|---|---|---|
| 1.1 | 1.3.1 Info and Relationships | Label associated with select via `for`/`id` pairing | PASS | No change needed |
| 1.2 | 4.1.2 Name, Role, Value | Native `<select>` is keyboard navigable | PASS | No change needed |
| 1.3 | 1.3.3 / 4.1.3 Status Messages | Loading state has visible text alongside spinner | PASS | No change needed |
| 1.4 | 4.1.3 Status Messages | Error state Alert announces to screen readers | FAIL | FIXED |
| 1.5 | 1.4.1 Use of Color | Unavailable options communicate state via text "(unavailable)" | PASS | No change needed |

**Violation 1.4 — WCAG 4.1.3 Status Messages (Level AA)**

The error `<Alert>` rendered on fetch failure was a plain `<div>` with Bootstrap color styling. Screen readers would not automatically announce it when it appeared because it had neither `role="alert"` nor an `aria-live` region.

Before:
```tsx
<Alert color="danger">
  Could not load datasources. Check your connection and refresh the page.
</Alert>
```

After:
```tsx
<Alert color="danger" role="alert">
  Could not load datasources. Check your connection and refresh the page.
</Alert>
```

`role="alert"` implies `aria-live="assertive"` and `aria-atomic="true"`, which causes screen readers to interrupt and announce the message immediately when it is injected into the DOM.

---

### Component 2: SyncConfigForm.tsx

| # | WCAG Criterion | Check | Result | Action |
|---|---|---|---|---|
| 2.1 | 1.3.1 Info and Relationships | All inputs have persistent visible `<Label>` | PASS | No change needed |
| 2.2 | 1.3.1 Info and Relationships | Checkboxes have associated labels via `for`/`id` | PASS | No change needed |
| 2.3 | 3.3.1 Error Identification | Schema error message programmatically associated to input | FAIL | FIXED |
| 2.4 | 4.1.2 Name, Role, Value | Schema field communicates required state | FAIL | FIXED |
| 2.5 | 4.1.2 Name, Role, Value | "Start Sync" button has `aria-disabled` when disabled | FAIL | FIXED |
| 2.6 | 1.3.1 / 4.1.2 | Confirmation modal has `aria-labelledby` pointing to its header | FAIL | FIXED |
| 2.7 | 2.1.2 No Keyboard Trap | Modal focus is trapped while open | PASS (deferred — Reactstrap handles natively) | See deferred section |

**Violation 2.3 + 2.4 — WCAG 3.3.1 Error Identification & 1.3.1 (Level A)**

The schema input's validation error div was rendered with class `invalid-feedback d-block` but had no `id`, so the input could not reference it via `aria-describedby`. Screen readers would see the input go invalid (Bootstrap adds `aria-invalid` via the `invalid` prop in Reactstrap) but would not read the error message because it was not programmatically associated. Additionally the field had no `aria-required` attribute to inform AT that it must be filled before submission.

Before:
```tsx
<Input
  id="schema-input"
  type="text"
  invalid={schemaError}
  ...
/>
{schemaError && (
  <div className="invalid-feedback d-block">Schema is required.</div>
)}
```

After:
```tsx
<Input
  id="schema-input"
  type="text"
  invalid={schemaError}
  aria-describedby={schemaError ? "schema-error" : undefined}
  aria-required="true"
  ...
/>
{schemaError && (
  <div id="schema-error" className="invalid-feedback d-block" role="alert">
    Schema is required.
  </div>
)}
```

The `aria-describedby` is set conditionally so the association only exists when the error is present; this avoids a dangling reference to a non-existent element. `role="alert"` on the error div ensures the message is announced when it first appears after the blur event.

**Violation 2.5 — WCAG 4.1.2 Name, Role, Value (Level A)**

HTML `disabled` removes an element from the accessibility tree and prevents any interaction, but it also prevents AT from reporting why the element is unavailable. `aria-disabled="true"` keeps the button in the accessibility tree and lets screen readers announce that it is disabled, while the visual and interactive disabled state is still controlled by the native `disabled` attribute.

Before:
```tsx
<Button color="primary" onClick={handleStartClick} disabled={isSubmitting}>
  {isSubmitting ? "Syncing\u2026" : "Start Sync"}
</Button>
```

After:
```tsx
<Button
  color="primary"
  onClick={handleStartClick}
  disabled={isSubmitting}
  aria-disabled={isSubmitting}
>
  {isSubmitting ? "Syncing\u2026" : "Start Sync"}
</Button>
```

Note: The button text already changes to "Syncing..." during submission, which partially communicates state. The `aria-disabled` addition makes this unambiguous to AT.

**Violation 2.6 — WCAG 4.1.2 Name, Role, Value (Level A)**

The Reactstrap `<Modal>` renders a Bootstrap modal dialog. Without `aria-labelledby`, screen readers have no programmatic way to announce the dialog's title when focus moves into it. The modal header already had an implicit title but no `id` for association.

Before:
```tsx
<Modal isOpen={showConfirm} toggle={() => setShowConfirm(false)}>
  <ModalHeader toggle={() => setShowConfirm(false)}>
    Sync Already In Progress
  </ModalHeader>
```

After:
```tsx
<Modal
  isOpen={showConfirm}
  toggle={() => setShowConfirm(false)}
  aria-labelledby="confirm-modal-title"
>
  <ModalHeader
    id="confirm-modal-title"
    toggle={() => setShowConfirm(false)}
  >
    Sync Already In Progress
  </ModalHeader>
```

Reactstrap v9 passes `aria-labelledby` through to the rendered `<div role="dialog">` element. The `id="confirm-modal-title"` on `ModalHeader` targets the `<h5>` that Reactstrap renders inside it, completing the association.

---

### Component 3: SyncProgressMonitor.tsx

| # | WCAG Criterion | Check | Result | Action |
|---|---|---|---|---|
| 3.1 | 4.1.2 Name, Role, Value | Progress bar uses `role="progressbar"` with ARIA value attributes | FAIL | FIXED |
| 3.2 | 1.4.1 Use of Color | Status badge uses text label, not color alone | PASS | No change needed |
| 3.3 | 4.1.3 Status Messages | Network error Alert announced to AT | FAIL | FIXED |
| 3.4 | 1.3.1 / 4.1.3 | Loading state has visible text alongside spinner | PASS | No change needed |
| 3.5 | 1.3.1 | Elapsed time is readable text in the DOM | PASS | No change needed |
| 3.6 | 4.1.3 Status Messages | Completed state announced to AT | FAIL | FIXED |
| 3.7 | 4.1.3 Status Messages | Failed state announced to AT as assertive alert | FAIL | FIXED |

**Violation 3.1 — WCAG 4.1.2 Name, Role, Value (Level A)**

Reactstrap v9 `<Progress>` renders two divs: an outer `<div class="progress">` and an inner `<div class="progress-bar" role="progressbar">`. The ARIA value attributes (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`) are automatically placed on the inner bar using the `value`, `min`, and `max` props — they do not come from the spread `...attributes`. The original code passed these as explicit spread attributes, causing them to land on the outer wrapper where `role="progressbar"` is absent and they have no semantic effect.

Additionally, the progress bar had no accessible label. A screen reader would announce "progress bar 45%" with no context of what is being tracked.

Before:
```tsx
<Progress
  value={pct}
  max={100}
  aria-valuenow={pct}
  aria-valuemin={0}
  aria-valuemax={100}
  className="mb-2"
/>
<div className="d-flex gap-4 text-muted small mb-2">
  <span>{data.tables_done} / {data.tables_total} tables</span>
  ...
</div>
```

After:
```tsx
<div id="sync-progress-label" className="visually-hidden">
  Sync progress: {pct}% complete ({data.tables_done} of {data.tables_total} tables)
</div>
<Progress
  value={pct}
  min={0}
  max={100}
  barAriaLabelledBy="sync-progress-label"
  className="mb-2"
/>
<div className="d-flex gap-4 text-muted small mb-2" aria-hidden="true">
  <span>{data.tables_done} / {data.tables_total} tables</span>
  ...
</div>
```

The visually-hidden label gives the progress bar a descriptive accessible name via `barAriaLabelledBy` (which Reactstrap v9 maps to `aria-labelledby` on the inner `role="progressbar"` element). The visible stats row is marked `aria-hidden="true"` to prevent double-announcement since the same information is already in the hidden label.

**Violation 3.3 — WCAG 4.1.3 Status Messages (Level AA)**

The network error Alert on `useSyncJob` failure had no `role` or `aria-live` region.

Before:
```tsx
<Alert color="danger">
  Failed to load job status. Check your connection and try again.
</Alert>
```

After:
```tsx
<Alert color="danger" role="alert">
  Failed to load job status. Check your connection and try again.
</Alert>
```

**Violation 3.6 — WCAG 4.1.3 Status Messages (Level AA)**

The sync completion Alert was injected dynamically when polling changed the job status to "completed". Without a live region, screen readers would not announce it.

Before:
```tsx
<Alert color="success" className="mb-3">
  <strong>Sync complete.</strong> ...
</Alert>
```

After:
```tsx
<Alert color="success" className="mb-3" role="status" aria-live="polite">
  <strong>Sync complete.</strong> ...
</Alert>
```

`role="status"` with `aria-live="polite"` is appropriate here — the completion message is important but not urgent. It will be announced after the screen reader finishes its current reading task.

**Violation 3.7 — WCAG 4.1.3 Status Messages (Level AA)**

The sync failure Alert required assertive announcement because it signals an error requiring user attention.

Before:
```tsx
<Alert color="danger">
  <strong>Sync failed.</strong> ...
</Alert>
```

After:
```tsx
<Alert color="danger" role="alert" aria-live="assertive">
  <strong>Sync failed.</strong> ...
</Alert>
```

`role="alert"` implicitly sets `aria-live="assertive"` and `aria-atomic="true"`, but the explicit `aria-live="assertive"` is added for maximum screen reader compatibility across NVDA, JAWS, and VoiceOver.

---

### Component 4: SyncHistoryTable.tsx

| # | WCAG Criterion | Check | Result | Action |
|---|---|---|---|---|
| 4.1 | 1.3.1 Info and Relationships | Table has `aria-label` | PASS | No change needed |
| 4.2 | 1.3.1 Info and Relationships | All `<th>` have `scope="col"` | PASS | No change needed |
| 4.3 | 2.1.1 Keyboard | Clickable rows have `tabIndex={0}` and keyboard handler | PASS | No change needed |
| 4.4 | 2.4.6 Headings and Labels | Clickable rows have descriptive accessible name for the action | FAIL | FIXED |
| 4.5 | 1.4.1 Use of Color | Status badges display text labels alongside color | PASS | No change needed |
| 4.6 | 4.1.3 Status Messages | Empty state is announced when it appears | FAIL | FIXED |
| 4.7 | 4.1.3 Status Messages | Error Alert announced to AT | FAIL | FIXED |

**Violation 4.4 — WCAG 2.4.6 Headings and Labels & 4.1.2 Name, Role, Value (Level AA)**

Each table row was keyboard focusable and activatable, but had no accessible name describing what activating it would do. A screen reader user tabbing through the table would hear each row's cell contents read in sequence, with no indication that pressing Enter would navigate to the job detail view.

Before:
```tsx
<tr
  key={run.id}
  style={{ cursor: "pointer" }}
  onClick={() => onSelectRun(run.id)}
  tabIndex={0}
  onKeyDown={...}
>
```

After:
```tsx
<tr
  key={run.id}
  style={{ cursor: "pointer" }}
  onClick={() => onSelectRun(run.id)}
  tabIndex={0}
  aria-label={`View sync run for ${run.datasource} / ${run.schema_name}, started ${formatDateTime(run.started_at)}, status: ${run.status}`}
  onKeyDown={...}
>
```

The `aria-label` on the `<tr>` provides a complete, descriptive name that screen readers will use when the row receives focus, making the purpose and destination of the action clear.

**Violation 4.6 — WCAG 4.1.3 Status Messages (Level AA)**

The empty state paragraph appeared after a successful but empty data fetch. Without a live region, AT would not announce the state change from loading spinner to empty result.

Before:
```tsx
return <p className="text-muted">No sync runs yet.</p>;
```

After:
```tsx
return (
  <p className="text-muted" role="status" aria-live="polite">
    No sync runs yet.
  </p>
);
```

**Violation 4.7 — WCAG 4.1.3 Status Messages (Level AA)**

Before:
```tsx
<Alert color="danger">
  Could not load sync history. Refresh the page to try again.
</Alert>
```

After:
```tsx
<Alert color="danger" role="alert">
  Could not load sync history. Refresh the page to try again.
</Alert>
```

---

### Component 5: IngestionPage.tsx

| # | WCAG Criterion | Check | Result | Action |
|---|---|---|---|---|
| 5.1 | 1.3.1 / 2.4.6 | Page has a logical heading hierarchy with `<h1>` | FAIL | FIXED |
| 5.2 | 1.3.1 Info and Relationships | Card headers use semantic heading elements | FAIL | FIXED |

**Violation 5.1 + 5.2 — WCAG 1.3.1 Info and Relationships & 2.4.6 Headings and Labels (Level A / AA)**

The page had no `<h1>` landmark heading, which is required for users navigating by heading (a common screen reader navigation strategy). The two card headers used `<strong>` inside `<CardHeader>`, which is purely visual emphasis with no semantic heading meaning. Screen reader users would not be able to locate "Metadata Sync" or "Sync History" as navigable sections.

Before:
```tsx
<Container fluid>
  <Row>
    <Col sm="12" lg="6">
      <Card className="mb-3">
        <CardHeader>
          <strong>Metadata Sync</strong>
        </CardHeader>
        ...
      </Card>
    </Col>
    <Col sm="12" lg="6">
      <Card>
        <CardHeader>
          <strong>Sync History</strong>
        </CardHeader>
```

After:
```tsx
<Container fluid>
  <h1 className="visually-hidden">Ingestion</h1>
  <Row>
    <Col sm="12" lg="6">
      <Card className="mb-3">
        <CardHeader tag="h2" className="h6 mb-0">
          Metadata Sync
        </CardHeader>
        ...
      </Card>
    </Col>
    <Col sm="12" lg="6">
      <Card>
        <CardHeader tag="h2" className="h6 mb-0">
          Sync History
        </CardHeader>
```

The `<h1>` is visually hidden using Bootstrap's `visually-hidden` utility (equivalent to a CSS clip technique that keeps the element in the accessibility tree while removing it from visual flow). This avoids duplicating a heading that may already appear in the application's global page chrome. The card headers are promoted to `<h2>` elements using Reactstrap's `tag` prop, styled with `h6` to match the original visual appearance without disrupting the heading hierarchy. The `<strong>` wrappers are removed as they are no longer needed — heading elements carry semantic weight inherently.

---

## Deferred Items

### SyncConfigForm — Modal Focus Trap (Manual Test Required)

**WCAG 2.1.2 No Keyboard Trap (Level A)**

Reactstrap v9 Modal uses `focus-trap-react` internally and manages focus trapping automatically. The modal also returns focus to the trigger element on close. This was verified by code inspection of the Reactstrap source. A manual test with NVDA + Firefox and VoiceOver + Safari is required to confirm that:
- Focus moves into the modal when it opens
- Tab key cycles only through modal contents while open
- Focus returns to the "Start Sync" button when the modal is dismissed via Cancel or the X button

This cannot be fully verified by static analysis or automated axe-core checks.

### Color Contrast — Not Audited

Color contrast ratios for Bootstrap's default theme colors (danger red, warning yellow, success green) and text colors were not verified against the specific CSS implementation in this project. A dedicated contrast audit using a tool such as the WebAIM Contrast Checker or browser DevTools should be performed against the deployed stylesheet.

**Criteria affected:** WCAG 1.4.3 Contrast (Minimum) (Level AA), 1.4.11 Non-text Contrast (Level AA)

### SyncProgressMonitor — Polling Live Region

The `SyncProgressMonitor` polls `useSyncJob` on an interval while the job is running. The progress percentage and table counts update on each poll. Currently the visually-hidden label `sync-progress-label` is a static `<div>`, which means AT will not re-announce updates as the percentage changes mid-sync. This is intentional — continuous announcements on every poll tick would be highly disruptive. If a future requirement calls for periodic progress announcements, a dedicated `aria-live="polite"` region with a meaningful throttle (e.g., every 10%) should be introduced separately from the `barAriaLabelledBy` mechanism.

---

## Summary of Changes Made

| File | Changes |
|---|---|
| `DatasourceSelector.tsx` | Added `role="alert"` to error Alert |
| `SyncConfigForm.tsx` | Added `id="schema-error"` and `role="alert"` to error div; added `aria-describedby` and `aria-required="true"` to schema input; added `aria-disabled={isSubmitting}` to Start Sync button; added `aria-labelledby="confirm-modal-title"` to Modal; added `id="confirm-modal-title"` to ModalHeader |
| `SyncProgressMonitor.tsx` | Replaced incorrect spread ARIA attributes on Progress with `min`/`max` props and `barAriaLabelledBy`; added visually-hidden progress label div; added `aria-hidden="true"` to visible stats row; added `role="alert"` to network error Alert; added `role="status"` and `aria-live="polite"` to completion Alert; added `role="alert"` and `aria-live="assertive"` to failure Alert |
| `SyncHistoryTable.tsx` | Added `role="alert"` to error Alert; added `role="status"` and `aria-live="polite"` to empty state paragraph; added descriptive `aria-label` to each clickable table row |
| `IngestionPage.tsx` | Added visually-hidden `<h1>Ingestion</h1>` page heading; changed both CardHeader elements from `<strong>` to semantic `<h2>` via `tag="h2"` prop with `h6` visual styling |

**Total violations fixed:** 13
**Items deferred for manual testing:** 1 (modal focus trap)
**Items deferred for separate audit:** 1 (color contrast)
