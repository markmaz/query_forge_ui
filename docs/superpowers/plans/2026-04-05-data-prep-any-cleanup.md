# DataPrepSection `any` Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all `any` type usages from `DataPrepSection.tsx` by extracting typed helpers and fixing one latent bug (`nulls: "empty"` → `"skip"`).

**Architecture:** New `dataPrepHelpers.ts` exports typed helpers; `DataPrepSection.tsx` imports them and drops all `as any` casts. No changes to `sqlJson.ts`.

**Tech Stack:** TypeScript, Vitest, React Testing Library

---

## File Map

| File | Action |
|------|--------|
| `src/features/query-forge/ui/components/dataPrepHelpers.ts` | Create — types and helpers |
| `src/features/query-forge/ui/components/__tests__/dataPrepHelpers.test.ts` | Create — unit tests |
| `src/features/query-forge/ui/components/DataPrepSection.tsx` | Modify — remove `any`, import helpers |

---

### Task 1: Create `dataPrepHelpers.ts` with failing tests

**Files:**
- Create: `src/features/query-forge/ui/components/__tests__/dataPrepHelpers.test.ts`
- Create: `src/features/query-forge/ui/components/dataPrepHelpers.ts` (stub only)

- [ ] **Step 1: Write the failing test file**

```typescript
// src/features/query-forge/ui/components/__tests__/dataPrepHelpers.test.ts
import { describe, expect, it } from "vitest";
import type {
  SqlConcatRule,
  SqlFillEmptyRule,
  SqlDataPrepRule,
} from "../../../model/sqlJson";
import {
  isRuleConcat,
  isFillEmpty,
  mkColumnRef,
  mkLiteralRef,
  getValueRefCol,
  getValueRefLiteral,
} from "../dataPrepHelpers";

const CONCAT_RULE: SqlConcatRule = {
  id: "r1",
  enabled: true,
  op: "concat",
  target: { modelColumnId: 1, columnName: "col_a" },
  output: { modelColumnId: null, columnName: "combined", exprId: "r1" },
  applyScope: "query_wide",
  inputs: [],
};

const FILL_RULE: SqlFillEmptyRule = {
  id: "r2",
  enabled: true,
  op: "fill_empty",
  target: { modelColumnId: 2, columnName: "col_b" },
  output: { modelColumnId: null, columnName: "col_b", exprId: "r2" },
  applyScope: "query_wide",
  value: "",
};

describe("isRuleConcat", () => {
  it("returns true for a concat rule", () => {
    expect(isRuleConcat(CONCAT_RULE)).toBe(true);
  });

  it("returns false for a non-concat rule", () => {
    expect(isRuleConcat(FILL_RULE as SqlDataPrepRule)).toBe(false);
  });
});

describe("isFillEmpty", () => {
  it("returns true for a fill_empty rule", () => {
    expect(isFillEmpty(FILL_RULE as SqlDataPrepRule)).toBe(true);
  });

  it("returns false for a non-fill_empty rule", () => {
    expect(isFillEmpty(CONCAT_RULE)).toBe(false);
  });
});

describe("mkColumnRef", () => {
  it("produces a column SqlValueRef", () => {
    const col = { modelColumnId: 1, columnName: "x" };
    const ref = mkColumnRef(col);
    expect(ref.type).toBe("column");
    expect(getValueRefCol(ref)).toEqual(col);
  });
});

describe("mkLiteralRef", () => {
  it("produces a literal SqlValueRef with a string value", () => {
    const ref = mkLiteralRef("hello");
    expect(ref.type).toBe("literal");
    expect(getValueRefLiteral(ref)).toBe("hello");
  });

  it("produces a literal SqlValueRef with null", () => {
    const ref = mkLiteralRef(null);
    expect(ref.type).toBe("literal");
    expect(getValueRefLiteral(ref)).toBeNull();
  });
});

describe("getValueRefCol", () => {
  it("returns null for a literal ref", () => {
    expect(getValueRefCol(mkLiteralRef("x"))).toBeNull();
  });
});

describe("getValueRefLiteral", () => {
  it("returns null for a column ref", () => {
    const col = { modelColumnId: 1, columnName: "x" };
    expect(getValueRefLiteral(mkColumnRef(col))).toBeNull();
  });
});
```

- [ ] **Step 2: Create a stub `dataPrepHelpers.ts` so the import resolves**

```typescript
// src/features/query-forge/ui/components/dataPrepHelpers.ts
export {};
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd "query-forge-ui" && npm run test -- --run --reporter=verbose src/features/query-forge/ui/components/__tests__/dataPrepHelpers.test.ts 2>&1 | tail -30
```

Expected: multiple FAIL lines about missing exports.

---

### Task 2: Implement `dataPrepHelpers.ts`

**Files:**
- Modify: `src/features/query-forge/ui/components/dataPrepHelpers.ts`

- [ ] **Step 1: Replace the stub with the full implementation**

```typescript
// src/features/query-forge/ui/components/dataPrepHelpers.ts
import type {
  SqlColumnKey,
  SqlConcatRule,
  SqlDataPrepOp,
  SqlDataPrepRule,
  SqlDatePartRule,
  SqlFillEmptyRule,
  SqlNormalizeTextRule,
  SqlValueRef,
} from "../../model/sqlJson";

// ---- Type predicates -------------------------------------------------------

export function isRuleConcat(r: SqlDataPrepRule): r is SqlConcatRule {
  return r.op === "concat";
}

export function isFillEmpty(r: SqlDataPrepRule): r is SqlFillEmptyRule {
  return r.op === "fill_empty";
}

// ---- SqlValueRef constructors -----------------------------------------------

export function mkColumnRef(col: SqlColumnKey): SqlValueRef {
  return { type: "column", col };
}

export function mkLiteralRef(value: string | number | boolean | null): SqlValueRef {
  return { type: "literal", value };
}

// ---- SqlValueRef accessors --------------------------------------------------

export function getValueRefCol(v: SqlValueRef): SqlColumnKey | null {
  return v.type === "column" ? v.col : null;
}

export function getValueRefLiteral(v: SqlValueRef): string | number | boolean | null {
  return v.type === "literal" ? v.value : null;
}

// ---- Patch type for updateRule ----------------------------------------------

/**
 * Flat union of all fields that any SqlDataPrepRule variant can accept as
 * an incremental patch.  This is intentionally wider than any single rule type
 * so that updateRule() can accept patches for any op without `as any`.
 */
export type DataPrepRulePatch = {
  op?: SqlDataPrepOp;
  target?: SqlColumnKey | null;
  outputName?: string;
  applyScope?: "query_wide";
  // SqlFillEmptyRule
  value?: string | number | boolean | null;
  fallbackCol?: SqlColumnKey | null;
  treatBlankAsEmpty?: boolean;
  // SqlCastRule
  toType?: string;
  safe?: boolean;
  // SqlNormalizeTextRule
  mode?: SqlNormalizeTextRule["mode"];
  // SqlParseDateRule
  format?: string | null;
  // SqlDatePartRule
  part?: SqlDatePartRule["part"];
  // SqlRoundRule
  decimals?: number;
  // SqlConcatRule
  inputs?: SqlValueRef[];
  separator?: string | null;
  nulls?: SqlConcatRule["nulls"];
};
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
cd "query-forge-ui" && npm run test -- --run --reporter=verbose src/features/query-forge/ui/components/__tests__/dataPrepHelpers.test.ts 2>&1 | tail -20
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/components/dataPrepHelpers.ts src/features/query-forge/ui/components/__tests__/dataPrepHelpers.test.ts && git commit -m "$(cat <<'EOF'
feat: add dataPrepHelpers with typed predicates, constructors, and patch type

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Fix `nulls` bug and remove `FillEmptyExtended`

**Files:**
- Modify: `src/features/query-forge/ui/components/DataPrepSection.tsx`

- [ ] **Step 1: Delete `FillEmptyExtended` (lines 138–141)**

Remove these lines entirely:
```typescript
// ---- FILL EMPTY EXTENSION (until you add it to sqlJson.ts)
type FillEmptyExtended = SqlFillEmptyRule & {
  fallbackCol?: SqlColumnKey | null;
};
```

- [ ] **Step 2: Replace all `FillEmptyExtended` casts with `SqlFillEmptyRule`**

There are three cast sites. Change each:

*Line ~543 in `addRule`:*
```typescript
// BEFORE
const r: FillEmptyExtended = {
// AFTER
const r: SqlFillEmptyRule = {
```

*Line ~748 in the `selectedColumns` upgrade effect:*
```typescript
// BEFORE
const rr = r as any as FillEmptyExtended;
if (rr.fallbackCol) next.fallbackCol = upgradeKey(rr.fallbackCol);
// AFTER
const rr = r as SqlFillEmptyRule;
if (rr.fallbackCol) next.fallbackCol = upgradeKey(rr.fallbackCol);
```

*Lines ~902–903 in the render loop:*
```typescript
// BEFORE
const rr = r as any as FillEmptyExtended;
// AFTER
const rr = r as SqlFillEmptyRule;
```

- [ ] **Step 3: Fix all four `nulls: "empty"` occurrences**

*In `updateRule` switch case "concat" (~line 645):*
```typescript
// BEFORE
nulls: "empty" as any,
} as any as SqlConcatRule;
// AFTER
nulls: "skip",
} as SqlConcatRule;
```

*In `openConcatDraft` (~line 783):*
```typescript
// BEFORE
const draft: SqlConcatRule = {
  ...rule,
  inputs,
  separator: "",
  nulls: "empty" as any,
} as any;
// AFTER
const draft: SqlConcatRule = {
  ...rule,
  inputs,
  separator: "",
  nulls: "skip",
};
```

*In `applyConcatDraft` (~line 795–799):*
```typescript
// BEFORE
updateRule(ruleId, {
  inputs: ensureMinTwoInputs(draft.inputs ?? [], seedCol),
  separator: "",
  nulls: "empty",
} as any);
// AFTER
updateRule(ruleId, {
  inputs: ensureMinTwoInputs(draft.inputs ?? [], seedCol),
  separator: "",
  nulls: "skip",
});
```

*In the inline expand handler (~line 954–963):*
```typescript
// BEFORE
setConcatDrafts((p) => ({
  ...p,
  [r.id]: {
    ...(r as any),
    inputs,
    separator: "",
    nulls: "empty" as any,
  } as any,
}));
// AFTER
setConcatDrafts((p) => ({
  ...p,
  [r.id]: {
    ...(r as SqlConcatRule),
    inputs,
    separator: "",
    nulls: "skip",
  },
}));
```

- [ ] **Step 4: Run full test suite to confirm no regressions**

```bash
cd "query-forge-ui" && npm run test -- --run 2>&1 | tee /tmp/queryforge-full-vitest.log; test ${PIPESTATUS[1]} -eq 0
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/components/DataPrepSection.tsx && git commit -m "$(cat <<'EOF'
fix: remove FillEmptyExtended redundant type and fix nulls bug (empty→skip)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Fix `isRuleConcat`, `ensureMinTwoInputs`, and `pillText`

**Files:**
- Modify: `src/features/query-forge/ui/components/DataPrepSection.tsx`

- [ ] **Step 1: Update imports at the top of `DataPrepSection.tsx`**

Add `dataPrepHelpers` imports after the existing `sqlJson` import block:

```typescript
import {
  isRuleConcat,
  isFillEmpty,
  mkColumnRef,
  mkLiteralRef,
  getValueRefCol,
  getValueRefLiteral,
} from "./dataPrepHelpers";
```

- [ ] **Step 2: Replace the inline `isRuleConcat` definition**

Remove lines ~146–148:
```typescript
function isRuleConcat(r: SqlDataPrepRule): r is SqlConcatRule {
  return (r as any)?.op === "concat";
}
```
(The imported version from `dataPrepHelpers` replaces it.)

- [ ] **Step 3: Fix `ensureMinTwoInputs` to use typed constructors**

```typescript
// BEFORE
function ensureMinTwoInputs(inputs: SqlValueRef[] | undefined | null, seedCol?: SqlColumnKey | null): SqlValueRef[] {
  const xs = (inputs ?? []).slice().filter(Boolean);
  if (xs.length >= 2) return xs;

  const out = xs.slice();
  while (out.length < 2) {
    if (seedCol && out.length === 0) out.push({ type: "column", col: seedCol } as any);
    else out.push({ type: "literal", value: "" } as any);
  }
  return out;
}

// AFTER
function ensureMinTwoInputs(inputs: SqlValueRef[] | undefined | null, seedCol?: SqlColumnKey | null): SqlValueRef[] {
  const xs = (inputs ?? []).slice().filter(Boolean);
  if (xs.length >= 2) return xs;

  const out = xs.slice();
  while (out.length < 2) {
    if (seedCol && out.length === 0) out.push(mkColumnRef(seedCol));
    else out.push(mkLiteralRef(""));
  }
  return out;
}
```

- [ ] **Step 4: Fix `pillText` to use typed accessors**

```typescript
// BEFORE
function pillText(v: SqlValueRef): string {
  if (v.type === "column") {
    const c = (v as any).col as SqlColumnKey | undefined;
    return c?.columnName ? labelFor(c) : "Choose column…";
  }
  const s = String((v as any).value ?? "");
  return s.length ? s : "Text…";
}

// AFTER
function pillText(v: SqlValueRef): string {
  if (v.type === "column") {
    const c = getValueRefCol(v);
    return c?.columnName ? labelFor(c) : "Choose column…";
  }
  const s = String(getValueRefLiteral(v) ?? "");
  return s.length ? s : "Text…";
}
```

- [ ] **Step 5: Run tests**

```bash
cd "query-forge-ui" && npm run test -- --run 2>&1 | tee /tmp/queryforge-full-vitest.log; test ${PIPESTATUS[1]} -eq 0
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/components/DataPrepSection.tsx && git commit -m "$(cat <<'EOF'
refactor: use dataPrepHelpers predicates and typed ValueRef constructors

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Tighten `updateRule` signature and fix call sites

**Files:**
- Modify: `src/features/query-forge/ui/components/DataPrepSection.tsx`

- [ ] **Step 1: Change `updateRule` signature**

```typescript
// BEFORE
const updateRule = (id: string, patch: Partial<SqlDataPrepRule> | any) => {
// AFTER
const updateRule = (id: string, patch: DataPrepRulePatch) => {
```

Add `DataPrepRulePatch` to the import from `./dataPrepHelpers`.

- [ ] **Step 2: Fix `updateRule` internals — the op-change switch**

The `as any` casts inside `updateRule` when building new rule objects during an op-switch need updating. Each `case` already returns a correctly-typed object; remove the `as any` wrapper where possible. The key change is the `fill_empty` case which uses `as any` because `fallbackCol` was believed missing:

```typescript
// BEFORE (fill_empty case)
return { ...base, op: "fill_empty", treatBlankAsEmpty: true, value: "", fallbackCol: null } as any;
// AFTER
return { ...base, op: "fill_empty", treatBlankAsEmpty: true, value: "", fallbackCol: null } as SqlFillEmptyRule;
```

The `concat` case was fixed in Task 3. The `const next = { ...r, ...patch, enabled: true } as any` intermediate (line ~658) can become:
```typescript
const next = { ...r, ...patch, enabled: true } as SqlDataPrepRule & DataPrepRulePatch;
```

The final `return next as SqlDataPrepRule;` at line ~710 stays.

- [ ] **Step 3: Remove `as any` from all `updateRule` call sites**

Find every call site matching `updateRule(r.id, { ... } as any)` and remove the `as any`. With `DataPrepRulePatch` in place all these patches are valid without casting:

- `updateRule(r.id, { op: e.target.value as SqlDataPrepOp })` — op change
- `updateRule(r.id, { target: v })` — target change  
- `updateRule(r.id, { fallbackCol: null })` — FillEmpty fallback clear
- `updateRule(r.id, { fallbackCol: seed })` — FillEmpty fallback set
- `updateRule(r.id, { value: parseScalar(e.target.value) })` — FillEmpty value
- `updateRule(r.id, { toType: e.target.value })` — Cast type
- `updateRule(r.id, { mode: e.target.value as SqlNormalizeTextRule["mode"] })` — NormalizeText
- `updateRule(r.id, { format: e.target.value || null })` — ParseDate
- `updateRule(r.id, { part: e.target.value as SqlDatePartRule["part"] })` — DatePart
- `updateRule(r.id, { decimals: Number(e.target.value) })` — Round
- `updateRule(r.id, { target: v })` — DatePart / general target
- `updateRule(r.id, { outputName: e.target.value })` — alias rename

Also fix the `addRule` body which calls `commitIfChanged({ ...model, rules: [...model.rules, r as any] })`:
```typescript
// BEFORE
commitIfChanged({ ...model, rules: [...model.rules, r as any] });
// AFTER
commitIfChanged({ ...model, rules: [...model.rules, r] });
```
(`r` is now typed as `SqlFillEmptyRule` from Task 3, which satisfies `SqlDataPrepRule`.)

- [ ] **Step 4: Fix `allColumns` construction — remove `as any[]` cast**

```typescript
// BEFORE
const domainCols = (columnsMeta ?? []) as any[];

const fromDomain: ColumnItem[] = domainCols
  .map((c) => {
    const columnName = (c.columnName as string | undefined) ?? (c.name as string | undefined) ?? "";
    if (!columnName) return null;
    const displayName =
      (c.alias as string | undefined) ??
      (c.label as string | undefined) ??
      columnName;

    const id =
      typeof c.modelColumnId === "number"
        ? c.modelColumnId
        : typeof c.model_column_id === "number"
        ? c.model_column_id
        : null;

    const table =
      (c.modelTableName as string | undefined) ??
      (c.model_table_name as string | undefined) ??
      (c.table as string | undefined) ??
      null;

    const data_type = (c.dataType as string | undefined) ?? (c.data_type as string | undefined) ?? null;

    const wtId =
      typeof (c as any).workspaceTableId === "number"
        ? (c as any).workspaceTableId
        : typeof (c as any).workspace_table_id === "number"
        ? (c as any).workspace_table_id
        : null;

    const key: SqlColumnKey = { modelColumnId: id ?? null, columnName, workspaceTableId: wtId };
    return { key, name: displayName, table, data_type } as ColumnItem;
  })
  .filter(Boolean) as ColumnItem[];

// AFTER
const fromDomain: ColumnItem[] = (columnsMeta ?? [])
  .map((c) => {
    if (!c.columnName) return null;
    const key: SqlColumnKey = {
      modelColumnId: c.modelColumnId,
      columnName: c.columnName,
      workspaceTableId: c.workspaceTableId,
    };
    return {
      key,
      name: c.columnLabel ?? c.columnName,
      table: c.modelTableName,
      data_type: c.dataType,
    } as ColumnItem;
  })
  .filter((x): x is ColumnItem => x !== null);
```

Also fix the `selectedColumns` fallback path that accesses non-existent fields on `SqlColumnKey`:
```typescript
// BEFORE
return selectedColumns.map((k) => ({
  key: k,
  name: labelFor(k),
  table: (k as any).modelTableName ?? null,
  data_type: (k as any).dataType ?? (k as any).data_type ?? null,
}));

// AFTER
return selectedColumns.map((k) => ({
  key: k,
  name: labelFor(k),
  table: null,
  data_type: null,
}));
```
(`SqlColumnKey` has no `modelTableName` or `dataType` — these fields are on `DomainColumnRef` and are only available via `columnsMeta`. The fallback path is only hit when `columnsMeta` is empty, so null is the correct value.)

- [ ] **Step 5: Fix remaining `as any` casts in the concat chip JSX**

In the expand handler inline draft creation (~line 958), `r as any` was already fixed in Task 3.

The `SqlColumnPicker` `onChange` callback in the chip editor uses `(v as any).col`:
```typescript
// BEFORE (~line 1300)
value={(v as any).col ?? null}
// AFTER
value={getValueRefCol(v)}
```

```typescript
// BEFORE (~line 1308)
col:
  picked ??
  (v as any).col ??
  ({ modelColumnId: null, columnName: "" } as SqlColumnKey),
} as any;
// AFTER
col: picked ?? getValueRefCol(v) ?? { modelColumnId: null, columnName: "" },
};
```

The typed input chip value access:
```typescript
// BEFORE (~line 1325)
value={String((v as any).value ?? "")}
// AFTER
value={String(getValueRefLiteral(v) ?? "")}
```

The new chip push uses `as any` for `SqlValueRef` construction — replace with typed constructors:
```typescript
// BEFORE (~line 1396)
next.push({
  type: "column",
  col: { modelColumnId: null, columnName: "" },
} as any);
// AFTER
next.push(mkColumnRef({ modelColumnId: null, columnName: "" }));
```

```typescript
// BEFORE (~line 1412)
next.push({ type: "literal", value: "" } as any);
// AFTER
next.push(mkLiteralRef(""));
```

The `selectedColumns` upgrade effect also accesses `SqlValueRef.col` with `as any`:
```typescript
// BEFORE (~line 755)
next.inputs = ensureMinTwoInputs(cr.inputs, seedCol).map((v: SqlValueRef) => {
  if (v.type === "column") return { ...v, col: upgradeKey((v as any).col) };
  return v;
});
// AFTER
next.inputs = ensureMinTwoInputs(cr.inputs, seedCol).map((v: SqlValueRef) => {
  const col = getValueRefCol(v);
  if (col) return mkColumnRef(upgradeKey(col));
  return v;
});
```

- [ ] **Step 6: Run full test suite**

```bash
cd "query-forge-ui" && npm run test -- --run 2>&1 | tee /tmp/queryforge-full-vitest.log; test ${PIPESTATUS[1]} -eq 0
```

Expected: all tests pass.

- [ ] **Step 7: Check TypeScript for remaining errors**

```bash
cd "query-forge-ui" && npx tsc --noEmit 2>&1 | grep "DataPrepSection\|dataPrepHelpers" | head -30
```

Expected: no errors in these two files.

- [ ] **Step 8: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/components/DataPrepSection.tsx && git commit -m "$(cat <<'EOF'
refactor: remove all any casts from DataPrepSection using typed helpers

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Bump version and update audit

**Files:**
- Modify: `package.json`
- Modify: `.claude/audits/frontend-audit.md`

- [ ] **Step 1: Bump patch version in `package.json`**

```json
// BEFORE
"version": "0.3.46",
// AFTER
"version": "0.3.47",
```

- [ ] **Step 2: Mark ISSUE-015/031 sub-project A as resolved in the audit**

In `.claude/audits/frontend-audit.md`, find the ISSUE-015 and ISSUE-031 entries and add a note:

```
Sub-project A (DataPrepSection.tsx): RESOLVED 2026-04-05
  - dataPrepHelpers.ts extracted with typed predicates, constructors, patch type
  - nulls: "empty" bug fixed to "skip"
  - FillEmptyExtended removed (fallbackCol already in SqlFillEmptyRule)
```

- [ ] **Step 3: Final test run**

```bash
cd "query-forge-ui" && npm run test -- --run 2>&1 | tee /tmp/queryforge-full-vitest.log; test ${PIPESTATUS[1]} -eq 0
```

- [ ] **Step 4: Commit**

```bash
cd "query-forge-ui" && git add package.json .claude/audits/frontend-audit.md && git commit -m "$(cat <<'EOF'
chore: bump version to 0.3.47, mark ISSUE-015/031 sub-project A resolved

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
