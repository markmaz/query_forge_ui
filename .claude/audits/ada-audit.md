# ADA / WCAG 2.1 AA Audit — Workspace LLM Feature

**Date:** 2026-03-11
**Scope:** WorkspaceLLMPage, CustomerInitializationPage (Step 4), useWorkspaceLLM hooks, workspaceLLMApi

---

## Findings

### F-01 — High: Delete confirmation buttons lack descriptive labels

**File:** `src/features/system-admin/ui/tenancy/WorkspaceLLMPage.tsx`

**Issue:** The inline "Yes" and "No" delete-confirmation buttons have no `aria-label`. Screen readers announce them as just "Yes" and "No" with no context about what is being deleted.

**WCAG:** 4.1.2 Name, Role, Value (Level A)

**Fix:**
```tsx
<button
  aria-label={`Yes, delete ${llm.name}`}
  onClick={() => handleDelete(llm.id)}
>
  Yes
</button>
<button
  aria-label={`No, cancel delete of ${llm.name}`}
  onClick={() => setDeleteConfirmId(null)}
>
  No
</button>
```

---

### F-02 — Medium: Loading state missing live region announcement

**File:** `src/features/system-admin/ui/tenancy/WorkspaceLLMPage.tsx`

**Issue:** The loading spinner/text is not in a live region. Screen reader users get no announcement when data finishes loading.

**WCAG:** 4.1.3 Status Messages (Level AA)

**Fix:**
```tsx
<div role="status" aria-live="polite" aria-busy="true">
  Loading LLM configurations…
</div>
```

---

### F-03 — High: Endpoint URL field missing aria-required in wizard Step 4

**File:** `src/features/system-admin/ui/tenancy/CustomerInitializationPage.tsx`

**Issue:** The Endpoint URL input is conditionally required (when provider is `ollama` or `generic`), but never sets `aria-required="true"`. Users relying on assistive technology cannot discover the constraint before submitting.

**WCAG:** 1.3.1 Info and Relationships (Level A), 3.3.2 Labels or Instructions (Level A)

**Fix:** Add `aria-required={requiresEndpoint}` to the Endpoint URL `<input>` element, where `requiresEndpoint` is `true` for `ollama` / `generic` providers.

---

### F-04 — Medium: "+ Add LLM" button in wizard has no descriptive label

**File:** `src/features/system-admin/ui/tenancy/CustomerInitializationPage.tsx`

**Issue:** The button to append a new draft LLM row is labeled "+ Add LLM" — acceptable as visible text but should also carry `aria-label="Add a new LLM configuration"` for assistive technology.

**WCAG:** 2.4.6 Headings and Labels (Level AA)

**Fix:**
```tsx
<button aria-label="Add a new LLM configuration">
  + Add LLM
</button>
```

---

## Warnings (non-blocking)

| ID   | Severity | Component             | Issue                                                                                                        |
|------|----------|-----------------------|--------------------------------------------------------------------------------------------------------------|
| W-01 | Low      | WorkspaceLLMPage      | Required field indicators (*) have no legend or aria-describedby pointing to "* = required" explanation |
| W-02 | Low      | WorkspaceLLMPage      | After delete succeeds, focus is not programmatically moved — consider moving focus to the table or a status message |
| W-03 | Low      | CustomerInitializationPage | Step 4 "Skip" button could be more descriptive: "Skip LLM configuration" clarifies the action |
| W-04 | Low      | WorkspaceLLMPage      | The section heading hierarchy may skip levels — verify heading order |
| W-05 | Low      | WorkspaceLLMPage      | Test result uses alert() — consider an in-page role="alert" element for less disruptive feedback  |

---

## Summary

| Priority | Count |
|----------|-------|
| High     | 2     |
| Medium   | 2     |
| Low (warnings) | 5 |

The two High findings (F-01, F-03) should be addressed before shipping. F-02 and F-04 are recommended. Warnings can be addressed in a follow-up pass.
