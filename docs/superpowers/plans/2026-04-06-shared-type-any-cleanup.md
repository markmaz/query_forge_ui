# Shared Domain Model `any` Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove ~109 `any` type usages from `FiltersSection.tsx`, `ColumnsSection.tsx`, and `useQueryForgeBuilderState.ts` by fixing the shared type definitions in `sqlJson.ts` and correcting snake_case field access mistakes.

**Architecture:** Fix root causes in shared types first, then fix consumers one file at a time. Backend lint runs last to confirm no serialization regressions. One commit per task.

**Tech Stack:** TypeScript, React, Vitest, Python Flask (backend lint only)

**Spec:** `docs/superpowers/specs/2026-04-06-shared-type-any-cleanup-design.md`

**Note on `workspaceTableId`:** The spec says `workspaceTableId: number` (non-null). The implementation uses `workspaceTableId: number | null` (required but nullable) because derived column keys built from expression outputs legitimately carry `null` (they have no workspace table). This is still a significant improvement over the previous `workspaceTableId?: number | null` — it removes `undefined` from the type, so direct property access (without optional chaining or `as any`) becomes valid everywhere.

---

## File Map

| File | Action |
|------|--------|
| `src/features/query-forge/model/sqlJson.ts` | Modify — type changes |
| `src/features/query-forge/ui/components/filterHelpers.ts` | Create — type predicates |
| `src/features/query-forge/ui/components/__tests__/filterHelpers.test.ts` | Create — unit tests |
| `src/features/query-forge/ui/components/DataPrepSection.tsx` | Modify — output type changes |
| `src/features/query-forge/ui/useQueryForgeBuilderState.ts` | Modify — remove casts, fix snake_case |
| `src/features/query-forge/ui/components/ColumnsSection.tsx` | Modify — remove false-miss casts |
| `src/features/query-forge/ui/components/FiltersSection.tsx` | Modify — import predicates, remove casts |
| `query-forge-api/` | Verify — run `./scripts/lint.sh` |

---

### Task 1: Create `filterHelpers.ts` failing tests and stub

**Files:**
- Create: `src/features/query-forge/ui/components/__tests__/filterHelpers.test.ts`
- Create: `src/features/query-forge/ui/components/filterHelpers.ts` (stub)

- [ ] **Step 1: Write the test file**

```typescript
// src/features/query-forge/ui/components/__tests__/filterHelpers.test.ts
import { describe, expect, it } from "vitest";
import type { SqlFilterGroupNode, SqlFilterConditionNode, SqlFilterNode } from "../../../model/sqlJson";
import { isGroupNode, isConditionNode } from "../filterHelpers";

const GROUP: SqlFilterGroupNode = {
  type: "group",
  id: "g1",
  match: "and",
  children: [],
};

const CONDITION: SqlFilterConditionNode = {
  type: "condition",
  id: "c1",
  field: { modelColumnId: 1, columnName: "col_a", workspaceTableId: 10 },
  op: "equals",
  value: "foo",
};

describe("isGroupNode", () => {
  it("returns true for a group node", () => {
    expect(isGroupNode(GROUP)).toBe(true);
  });
  it("returns false for a condition node", () => {
    expect(isGroupNode(CONDITION as SqlFilterNode)).toBe(false);
  });
});

describe("isConditionNode", () => {
  it("returns true for a condition node", () => {
    expect(isConditionNode(CONDITION as SqlFilterNode)).toBe(true);
  });
  it("returns false for a group node", () => {
    expect(isConditionNode(GROUP)).toBe(false);
  });
});
```

- [ ] **Step 2: Create stub**

```typescript
// src/features/query-forge/ui/components/filterHelpers.ts
export {};
```

- [ ] **Step 3: Run tests — confirm failure**

```bash
cd "query-forge-ui" && npm run test -- --run --reporter=verbose src/features/query-forge/ui/components/__tests__/filterHelpers.test.ts 2>&1 | tail -15
```

Expected: 4 tests FAIL with missing exports / type errors.

- [ ] **Step 4: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/components/__tests__/filterHelpers.test.ts src/features/query-forge/ui/components/filterHelpers.ts && git commit -m "$(cat <<'EOF'
test: add failing tests for filterHelpers type predicates

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Update `sqlJson.ts` type definitions

**Files:**
- Modify: `src/features/query-forge/model/sqlJson.ts`

This is the structural change that drives all subsequent consumer fixes. Make all changes in one commit.

- [ ] **Step 1: Change `SqlColumnKey` — make `workspaceTableId` required (nullable), add `dataType`**

```typescript
// BEFORE
export type SqlColumnKey = {
  modelColumnId: number | null;
  columnName: string;
  workspaceTableId?: number | null;
  exprId?: string | null;
  alias?: string | null;
}

// AFTER
export type SqlColumnKey = {
  modelColumnId: number | null;
  columnName: string;
  workspaceTableId: number | null;   // required (was optional); null is valid for derived/draft column slots
  dataType?: string | null;          // new — eliminates post-construction mutation
  exprId?: string | null;
  alias?: string | null;
};
```

- [ ] **Step 2: Remove duplicate `dataType` from `SqlColumnRef`**

```typescript
// BEFORE
export type SqlColumnRef = SqlColumnKey & {
  modelTableId?: number | null;
  modelTableName?: string | null;
  fullName?: string | null;
  tableAlias?: string | null;
  dataType?: string | null;    // ← remove this line (now inherited from SqlColumnKey)
  nullable?: boolean | null;
  alias?: string | null;
};

// AFTER
export type SqlColumnRef = SqlColumnKey & {
  modelTableId?: number | null;
  modelTableName?: string | null;
  fullName?: string | null;
  tableAlias?: string | null;
  nullable?: boolean | null;
  alias?: string | null;
};
```

- [ ] **Step 3: Export named `SqlFilterNode` variants**

Replace the inline `SqlFilterNode` union with named exported types. Find the current `SqlFilterNode` definition and replace it:

```typescript
// BEFORE
export type SqlFilterNode =
  | { type: "group"; id: string; match: "and" | "or"; children: SqlFilterNode[] }
  | { type: "condition"; id: string; field: SqlColumnKey; op: SqlFilterOp; value: any };

// AFTER
export type SqlFilterGroupNode = {
  type: "group";
  id: string;
  match: "and" | "or";
  children: SqlFilterNode[];
};

export type SqlFilterConditionNode = {
  type: "condition";
  id: string;
  field: SqlColumnKey;
  op: SqlFilterOp;
  value: any;
  negate?: boolean;
};

export type SqlFilterNode = SqlFilterGroupNode | SqlFilterConditionNode;
```

- [ ] **Step 4: Add `SqlDerivedColumnRef` and update `SqlDataPrepRuleBase.output`**

Add the new type after `SqlColumnRef` and update the rule base:

```typescript
/** Output reference for a DataPrep rule — a computed expression, not a workspace column */
export type SqlDerivedColumnRef = {
  exprId: string;
  columnName: string;
  alias?: string | null;
};
```

Then find `SqlDataPrepRuleBase` and change the `output` field:

```typescript
// BEFORE
export type SqlDataPrepRuleBase = {
  id: string;
  enabled: boolean;
  target: SqlColumnKey;
  output: SqlColumnKey;
  applyScope: "query_wide";
};

// AFTER
export type SqlDataPrepRuleBase = {
  id: string;
  enabled: boolean;
  target: SqlColumnKey;
  output: SqlDerivedColumnRef;   // was SqlColumnKey
  applyScope: "query_wide";
};
```

- [ ] **Step 5: Run TypeScript check to see the cascade of errors**

```bash
cd "query-forge-ui" && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -60
```

These errors are expected — they are the consumer fixup checklist for Tasks 3–7. Note the files and line numbers.

- [ ] **Step 6: Commit the type changes**

```bash
cd "query-forge-ui" && git add src/features/query-forge/model/sqlJson.ts && git commit -m "$(cat <<'EOF'
feat: tighten SqlColumnKey, add SqlDerivedColumnRef, export SqlFilterNode variants

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Implement `filterHelpers.ts`

**Files:**
- Modify: `src/features/query-forge/ui/components/filterHelpers.ts`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// src/features/query-forge/ui/components/filterHelpers.ts
import type {
  SqlFilterNode,
  SqlFilterGroupNode,
  SqlFilterConditionNode,
} from "../../model/sqlJson";

export function isGroupNode(n: SqlFilterNode): n is SqlFilterGroupNode {
  return n.type === "group";
}

export function isConditionNode(n: SqlFilterNode): n is SqlFilterConditionNode {
  return n.type === "condition";
}
```

- [ ] **Step 2: Run tests — confirm pass**

```bash
cd "query-forge-ui" && npm run test -- --run --reporter=verbose src/features/query-forge/ui/components/__tests__/filterHelpers.test.ts 2>&1 | tail -10
```

Expected: 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/components/filterHelpers.ts && git commit -m "$(cat <<'EOF'
feat: implement filterHelpers type predicates for SqlFilterNode

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Fix `DataPrepSection.tsx` — output type changes

**Files:**
- Modify: `src/features/query-forge/ui/components/DataPrepSection.tsx`

`SqlDataPrepRuleBase.output` is now `SqlDerivedColumnRef`. The two output-builder functions and all inline output reconstructions need updating.

- [ ] **Step 1: Add `SqlDerivedColumnRef` to imports**

Find the `import type { ... } from "../../model/sqlJson"` block and add `SqlDerivedColumnRef`:

```typescript
import type {
  SqlColumnKey,
  SqlDataPrepJson,
  SqlDataPrepRule,
  SqlDataPrepOp,
  SqlFillEmptyRule,
  SqlCastRule,
  SqlNormalizeTextRule,
  SqlParseDateRule,
  SqlDatePartRule,
  SqlRoundRule,
  SqlConcatRule,
  SqlValueRef,
  SqlDerivedColumnRef,   // ADD
} from "../../model/sqlJson";
```

- [ ] **Step 2: Update `makeOutput` to return `SqlDerivedColumnRef`**

```typescript
// BEFORE
function makeOutput(ruleId: string, name: string): SqlColumnKey {
  return {
    modelColumnId: null,
    columnName: name,
    workspaceTableId: null,
    exprId: ruleId,
  };
}

// AFTER
function makeOutput(ruleId: string, name: string): SqlDerivedColumnRef {
  return { exprId: ruleId, columnName: name };
}
```

- [ ] **Step 3: Update `makeDatePartOutput` to return `SqlDerivedColumnRef`**

```typescript
// BEFORE
function makeDatePartOutput(
  target: SqlColumnKey,
  part: SqlDatePartRule["part"],
  alias?: string | null,
): SqlColumnKey {
  const defaultAlias = makeDatePartAlias(target, part);
  const name = (alias ?? defaultAlias).trim() || defaultAlias;
  return {
    modelColumnId: null,
    columnName: name,
    alias: name,
    exprId: makeDatePartExprId(target, part),
  };
}

// AFTER
function makeDatePartOutput(
  target: SqlColumnKey,
  part: SqlDatePartRule["part"],
  alias?: string | null,
): SqlDerivedColumnRef {
  const defaultAlias = makeDatePartAlias(target, part);
  const name = (alias ?? defaultAlias).trim() || defaultAlias;
  return { exprId: makeDatePartExprId(target, part), columnName: name, alias: name };
}
```

- [ ] **Step 4: Fix the three inline output reconstruction blocks in `updateRule`**

There are three `next.output = { ..., modelColumnId: null, ... }` blocks. Remove `modelColumnId: null`, the spread, and keep only the `SqlDerivedColumnRef` fields. Find them by searching for `modelColumnId: null` inside `updateRule`.

**Block A — when `patch.target` is set and rule is not date_part:**
```typescript
// BEFORE
next.output = {
  ...(next.output ?? makeOutput(r.id, newTargetName)),
  exprId: r.id,
  modelColumnId: null,
  columnName: outputWasDefault
    ? newTargetName
    : (next.output?.columnName ?? prevOutName),
};
// AFTER
next.output = {
  exprId: r.id,
  columnName: outputWasDefault ? newTargetName : (next.output?.columnName ?? prevOutName),
  alias: next.output?.alias,
};
```

**Block B — when `patch.target` is not set and rule is not date_part:**
```typescript
// BEFORE
next.output = {
  ...(next.output ?? makeOutput(r.id, prevOutName)),
  exprId: r.id,
  modelColumnId: null,
  columnName: next.output?.columnName ?? prevOutName,
};
// AFTER
next.output = {
  exprId: r.id,
  columnName: next.output?.columnName ?? prevOutName,
  alias: next.output?.alias,
};
```

**Block C — when `patch.outputName` is set and rule is not date_part:**
```typescript
// BEFORE
next.output = {
  ...(next.output ?? makeOutput(r.id, prevOutName)),
  exprId: r.id,
  modelColumnId: null,
  columnName: nextName,
};
// AFTER
next.output = {
  exprId: r.id,
  columnName: nextName,
  alias: next.output?.alias,
};
```

- [ ] **Step 5: Fix inline output in the selectedColumns upgrade `useEffect`**

Find the `output:` expression in the `nextRules` map inside the `useEffect` that depends on `[selectedSig]`. The non-date-part branch spreads `r.output` and adds `modelColumnId: null`:

```typescript
// BEFORE
output:
  isDatePart && nextTarget
    ? makeDatePartOutput(...)
    : {
        ...(r.output ?? makeOutput(r.id, nextTarget?.columnName ?? "derived")),
        exprId: r.id,
        modelColumnId: null,
      },

// AFTER
output:
  isDatePart && nextTarget
    ? makeDatePartOutput(...)
    : {
        exprId: r.id,
        columnName: r.output?.columnName ?? nextTarget?.columnName ?? "derived",
        alias: r.output?.alias,
      },
```

- [ ] **Step 6: Run TypeScript check on this file**

```bash
cd "query-forge-ui" && npx tsc --noEmit 2>&1 | grep "DataPrepSection" | head -20
```

Expected: no errors in DataPrepSection.tsx.

- [ ] **Step 7: Run tests**

```bash
cd "query-forge-ui" && npm run test -- --run 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/components/DataPrepSection.tsx && git commit -m "$(cat <<'EOF'
refactor: update DataPrepSection output functions to use SqlDerivedColumnRef

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Fix `useQueryForgeBuilderState.ts`

**Files:**
- Modify: `src/features/query-forge/ui/useQueryForgeBuilderState.ts`

This file has the most changes: derived column key construction, workspaceTableId casts, snake_case field access, and SqlDataPrepRule union access.

- [ ] **Step 1: Fix `derivedColumnKeys` — use `SqlDataPrepRuleBase` and `SqlDerivedColumnRef`**

Find the `derivedColumnKeys` useMemo (around line 65-101). The block builds `SqlColumnKey[]` from rule outputs. `output` is now `SqlDerivedColumnRef` so `output.exprId` and `output.alias` are directly accessible.

Import `SqlDataPrepRuleBase` if not already imported, and `SqlDerivedColumnRef`:

```typescript
import type {
  // ... existing imports ...
  SqlDataPrepRuleBase,
  SqlDerivedColumnRef,
} from "../model/sqlJson";
```

Fix the output access block (around lines 71-77):

```typescript
// BEFORE
out.push({
  modelColumnId: null,
  columnName: output.columnName,
  workspaceTableId: null,
  exprId: output.exprId ?? rule.id,
  alias: (output as any).alias ?? output.columnName,
});

// AFTER
out.push({
  modelColumnId: null,
  columnName: output.columnName,
  workspaceTableId: null,
  exprId: output.exprId,
  alias: output.alias ?? output.columnName,
});
```

Fix the loop that reads `rule.output` (around lines 60-78). `rule` is `SqlDataPrepRule`. Access `output` and `id` via `SqlDataPrepRuleBase`:

```typescript
// BEFORE (loop header area)
for (const rule of rules ?? []) {
  const output = rule.output;  // if this was using as any, fix it
  // ...
}

// The loop typically looks like:
for (const rule of (sqlJson.dataPrep?.rules ?? []) as SqlDataPrepRule[]) {
  const base = rule as SqlDataPrepRuleBase;
  const output: SqlDerivedColumnRef = base.output;
  if (!output?.exprId) continue;
  // ...
}
```

Read the actual loop first, then apply the cast `rule as SqlDataPrepRuleBase` to access `.output` without `as any`.

- [ ] **Step 2: Fix `availableColumnKeys`, `selectedColumns`, `aliasByKey` — remove `workspaceTableId` casts**

Three memos (lines ~103-148) use `(column as any).workspaceTableId ?? null`. `column` is `SqlColumnRef` which now has `workspaceTableId: number | null` (required). Replace each cast:

```typescript
// BEFORE
workspaceTableId: (column as any).workspaceTableId ?? null,
// AFTER
workspaceTableId: column.workspaceTableId,
```

Do this for all three occurrences (lines ~107, ~128, ~142).

- [ ] **Step 3: Fix `allColumnKeysForFilters` — remove `as any`, add `dataType` at construction**

Find the memo around line 205-231. Fix:

```typescript
// BEFORE
const base: SqlColumnKey[] = allRows.map((row: any) => {
  const exprId = row.identityKey?.startsWith("expr:")
    ? row.identityKey.slice(5)
    : null;
  const key: SqlColumnKey = {
    modelColumnId: row.modelColumnId ?? null,
    columnName: row.columnName,
    workspaceTableId: row.workspaceTableId ?? null,
    exprId,
  };
  (key as any).dataType = row.dataType ?? row.data_type ?? null;
  const alias = aliasByKey.get(colKey(key)) ?? null;
  return { ...key, alias };
});

// AFTER
const base: SqlColumnKey[] = allRows.map((row) => {
  const exprId = row.identityKey?.startsWith("expr:")
    ? row.identityKey.slice(5)
    : null;
  const key: SqlColumnKey = {
    modelColumnId: row.modelColumnId ?? null,
    columnName: row.columnName,
    workspaceTableId: row.workspaceTableId,
    dataType: row.dataType ?? null,   // set at construction, not post-mutation
    exprId,
  };
  const alias = aliasByKey.get(colKey(key)) ?? null;
  return { ...key, alias };
});
```

- [ ] **Step 4: Fix the `pageRows` sync `useEffect` — remove casts, fix snake_case fields**

Find the `useEffect` around lines 563-610. Fix the `byKey`/`byName` maps and the `hit` variable:

```typescript
// BEFORE
const byKey = new Map(pageRows.map((row: any) => [row.identityKey, row]));
const byName = new Map<string, any>();
pageRows.forEach((row: any) => {
  if (!byName.has(row.columnName)) byName.set(row.columnName, row);
});
// ...
const wtId = (column as any).workspaceTableId;
const key =
  typeof wtId === "number"
    ? `${wtId}:${column.columnName}`
    : (identityKeyByName.get(column.columnName) ?? column.columnName);
const hit: any = byKey.get(key) ?? byName.get(column.columnName);
// ...
const next: SqlColumnRef = {
  ...column,
  modelColumnId: column.modelColumnId ?? hit.modelColumnId ?? null,
  workspaceTableId:
    (column as any).workspaceTableId ?? hit.workspaceTableId ?? null,
  modelTableName:
    column.modelTableName ?? hit.modelTableName ?? hit.table_name ?? null,
  fullName: column.fullName ?? hit.full_name ?? hit.fullName ?? null,
  dataType: column.dataType ?? hit.dataType ?? hit.data_type ?? null,
};
if (
  next.modelColumnId !== column.modelColumnId ||
  (next as any).workspaceTableId !== (column as any).workspaceTableId ||
  ...
)

// AFTER
const byKey = new Map(pageRows.map((row) => [row.identityKey, row]));
const byName = new Map<string, typeof pageRows[number]>();
pageRows.forEach((row) => {
  if (!byName.has(row.columnName)) byName.set(row.columnName, row);
});
// ...
const key =
  typeof column.workspaceTableId === "number"
    ? `${column.workspaceTableId}:${column.columnName}`
    : (identityKeyByName.get(column.columnName) ?? column.columnName);
const hit = byKey.get(key) ?? byName.get(column.columnName);
// ...
const next: SqlColumnRef = {
  ...column,
  modelColumnId: column.modelColumnId ?? hit?.modelColumnId ?? null,
  workspaceTableId: column.workspaceTableId ?? hit?.workspaceTableId ?? null,
  modelTableName: column.modelTableName ?? hit?.modelTableName ?? null,  // removed hit.table_name
  fullName: column.fullName ?? hit?.fullName ?? null,                    // removed hit.full_name
  dataType: column.dataType ?? hit?.dataType ?? null,                    // removed hit.data_type
};
if (
  next.modelColumnId !== column.modelColumnId ||
  next.workspaceTableId !== column.workspaceTableId ||                   // removed as any
  ...
)
```

- [ ] **Step 5: Fix `columnsMeta` memo — remove `as any`, fix `row.workspace_table_id` snake_case**

Find around lines 612-650. The `pageRows.map((row: any) => ...)` widens to `any` to access snake_case. Fix:

```typescript
// BEFORE
if (typeof (column as any).workspaceTableId === "number") {
  aliasByWorkspaceKey.set(
    `${(column as any).workspaceTableId}:${column.columnName}`,
    alias,
  );
}
// ...
return pageRows.map((row: any) => {
  const modelId = row.modelColumnId ?? null;
  const wtId = row.workspaceTableId ?? row.workspace_table_id ?? null;

// AFTER
if (typeof column.workspaceTableId === "number") {
  aliasByWorkspaceKey.set(
    `${column.workspaceTableId}:${column.columnName}`,
    alias,
  );
}
// ...
return pageRows.map((row) => {
  const modelId = row.modelColumnId;
  const wtId = row.workspaceTableId;   // DomainColumnRef.workspaceTableId is number (non-null)
```

- [ ] **Step 6: Fix `collectExprIds` — use `SqlDataPrepRuleBase` instead of `as any`**

Find around lines 407-415:

```typescript
// BEFORE
const output = (rule as any).output as SqlColumnKey | undefined;
const exprId = (output as any)?.exprId ?? (rule as any).id ?? null;

// AFTER
const base = rule as SqlDataPrepRuleBase;
const exprId = base.output?.exprId ?? base.id ?? null;
```

Wait — `base.output` is `SqlDerivedColumnRef` (required, not optional). So `base.output.exprId` is always present. Simplify:

```typescript
const base = rule as SqlDataPrepRuleBase;
const exprId = base.output.exprId;
```

- [ ] **Step 7: Fix `filteredColumns` false-miss cast**

Find around line 422-426:

```typescript
// BEFORE
const exprId = (column as any).exprId ?? null;

// AFTER
const exprId = column.exprId ?? null;
```

(`column` is `SqlColumnRef` which inherits `exprId?: string | null` from `SqlColumnKey`.)

- [ ] **Step 8: Run TypeScript check**

```bash
cd "query-forge-ui" && npx tsc --noEmit 2>&1 | grep "useQueryForgeBuilderState" | head -20
```

Fix any remaining errors. Expected: 0 errors in this file.

- [ ] **Step 9: Run tests**

```bash
cd "query-forge-ui" && npm run test -- --run 2>&1 | tail -5
```

- [ ] **Step 10: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/useQueryForgeBuilderState.ts && git commit -m "$(cat <<'EOF'
refactor: remove any casts from useQueryForgeBuilderState, fix snake_case field access

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Fix `ColumnsSection.tsx`

**Files:**
- Modify: `src/features/query-forge/ui/components/ColumnsSection.tsx`

All 14 casts here are false misses — the fields exist on `SqlColumnRef` (which inherits from `SqlColumnKey`). With `workspaceTableId: number | null` now required (not optional), all direct accesses are valid.

- [ ] **Step 1: Remove all `workspaceTableId` casts**

Find every `(c as any).workspaceTableId` (5 occurrences at ~lines 111, 287, 369, 492, 518) and change to `c.workspaceTableId`. Also fix the comparison at ~line 518:

```typescript
// BEFORE
const prevWt = prev ? (prev as any).workspaceTableId : null;
// AFTER
const prevWt = prev?.workspaceTableId ?? null;
```

- [ ] **Step 2: Remove all `exprId` casts**

Find every `(c as any).exprId` (6 occurrences at ~lines 268, 290, 305, 372, 495, 519) and change to `c.exprId`:

```typescript
// BEFORE
const exprId = (c as any).exprId ?? null;
if ((c as any).exprId) return `expr:${(c as any).exprId}`;
// AFTER
const exprId = c.exprId ?? null;
if (c.exprId) return `expr:${c.exprId}`;
```

- [ ] **Step 3: Remove `tableAlias` casts**

Find `(c as any).tableAlias` (~lines 114, 541) and change to `c.tableAlias`:

```typescript
// BEFORE
(c as any).tableAlias ?? "",
(prev as any)?.tableAlias ?? row?.tableAlias ?? null,
// AFTER
c.tableAlias ?? "",
prev?.tableAlias ?? row?.tableAlias ?? null,
```

- [ ] **Step 4: Check `colsSig` uses `workspaceTableId` as string key**

At ~line 111: `(c as any).workspaceTableId ?? ""` is used in a string key. After fix: `c.workspaceTableId?.toString() ?? ""`. (`workspaceTableId` is `number | null` so `.toString()` needs the optional chain.)

- [ ] **Step 5: Run TypeScript check**

```bash
cd "query-forge-ui" && npx tsc --noEmit 2>&1 | grep "ColumnsSection" | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Run tests**

```bash
cd "query-forge-ui" && npm run test -- --run 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/components/ColumnsSection.tsx && git commit -m "$(cat <<'EOF'
refactor: remove false-miss any casts from ColumnsSection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Fix `FiltersSection.tsx`

**Files:**
- Modify: `src/features/query-forge/ui/components/FiltersSection.tsx`

- [ ] **Step 1: Import `isGroupNode` and `isConditionNode`**

Add to imports near the top of the file:

```typescript
import { isGroupNode, isConditionNode } from "./filterHelpers";
```

Also import named filter node types if needed:

```typescript
import type {
  // ... existing sqlJson imports ...
  SqlFilterGroupNode,
  SqlFilterConditionNode,
} from "../../model/sqlJson";
```

- [ ] **Step 2: Fix `asNode` inner function in `sqlNodeToRootModel`**

Replace all `(n as any)` accesses with predicate-narrowed access:

```typescript
// BEFORE
const asNode = (n: SqlFilterNode): GroupNode | ConditionNode => {
  if (n.type === "group") {
    return {
      type: "group",
      id: (n as any).id ?? newId(),
      match: (((n as any).match ?? "and") as LogicOp) ?? "and",
      children: (((n as any).children ?? []) as SqlFilterNode[]).map(asNode) as any,
    };
  }
  const field = (n as any).field as SqlColumnKey | null | undefined;
  const op = normalizeFilterOperator((n as any).op) as ConditionOp;
  const value = normalizeFilterValueForOperator(op, (n as any).value);
  return {
    type: "condition",
    id: (n as any).id ?? newId(),
    field: field ?? fallback,
    op,
    value,
  };
};

// AFTER
const asNode = (n: SqlFilterNode): GroupNode | ConditionNode => {
  if (isGroupNode(n)) {
    return {
      type: "group",
      id: n.id,
      match: (n.match as LogicOp) ?? "and",
      children: n.children.map(asNode),
    };
  }
  // n is SqlFilterConditionNode
  const op = normalizeFilterOperator(n.op) as ConditionOp;
  const value = normalizeFilterValueForOperator(op, n.value);
  return {
    type: "condition",
    id: n.id,
    field: n.field ?? fallback,
    op,
    value,
  };
};
```

- [ ] **Step 3: Fix the outer `v.type === "group"` block in `sqlNodeToRootModel`**

Replace `(v as any).children` and `(v as any).match` with direct access after `isGroupNode` narrowing:

```typescript
// BEFORE
if (v.type === "group") {
  const children = (((v as any).children ?? []) as SqlFilterNode[]).map(asNode);
  // ...
  return {
    match: (((v as any).match ?? "and") as LogicOp) ?? "and",
    groups,
  };
}

// AFTER
if (isGroupNode(v)) {
  const children = v.children.map(asNode);
  // ...
  return {
    match: (v.match as LogicOp) ?? "and",
    groups,
  };
}
```

- [ ] **Step 4: Fix tautological `as any` casts in `updateNode` and `removeNode`**

The `walk` function returns `[Node, boolean]` where `Node = GroupNode | ConditionNode`. The `nextC as any` and `nextChildren.push(nextC as any)` casts are unnecessary since `Node` satisfies `GroupNode | ConditionNode`. Remove them:

```typescript
// BEFORE (~line 274)
return nextC as any;
// AFTER
return nextC;

// BEFORE (~lines 301, 334)
nextChildren.push(nextC as any);
// AFTER
nextChildren.push(nextC);
```

- [ ] **Step 5: Fix false-miss casts**

**Line ~145** — `(r as any).id` where `r` is `SqlDataPrepRule`. `id` is on `SqlDataPrepRuleBase`:
```typescript
// BEFORE
const exprId = output.exprId ?? (r as any).id ?? null;
// AFTER — output is SqlDerivedColumnRef, r.id accessible via cast to base
const base = r as SqlDataPrepRuleBase;
const exprId = output.exprId ?? base.id ?? null;
```

Wait — `output` is now `SqlDerivedColumnRef`. But `FiltersSection` may reference `rule.output` typed differently. Read the actual context around line 145 in FiltersSection before applying. The pattern is: `output` is built from rule output, and `exprId` falls back to `rule.id`. Use `(r as SqlDataPrepRuleBase).id`.

**Line ~473** — `(c as any).alias` where `c` is `SqlColumnKey`. `alias` IS on `SqlColumnKey`:
```typescript
// BEFORE
const label = (c as any).alias?.toString().trim() || labelFor(c);
// AFTER
const label = c.alias?.toString().trim() || labelFor(c);
```

- [ ] **Step 6: Fix `dataType` access — use direct field now on `SqlColumnKey`**

**Line ~151** — `(output as any).dataType ?? (output as any).data_type ?? null`:
```typescript
// BEFORE
dataType: r.op === "date_part" ? "int" : (output as any).dataType ?? (output as any).data_type ?? null,
// AFTER
dataType: r.op === "date_part" ? "int" : output.dataType ?? null,
```
(`output` is `SqlDerivedColumnRef` which doesn't have `dataType` — but `FiltersSection` builds this from `rule.output` which is a `SqlDerivedColumnRef`. Check if `dataType` should come from `rule.target.dataType` instead. Read the surrounding context before applying.)

**Line ~488** — `(c as any).dataType ?? (c as any).data_type ?? null`:
```typescript
// BEFORE
const raw = (c as any).dataType ?? (c as any).data_type ?? null;
// AFTER
const raw = c.dataType ?? null;
```

- [ ] **Step 7: Fix the fallback `SqlColumnKey` construction**

**Line ~984** — `{ modelColumnId: null, columnName: "" } as any`. With `workspaceTableId` now required (but nullable), provide it:

```typescript
// BEFORE
const fallback: SqlColumnKey = columnOptions[0] ?? { modelColumnId: null, columnName: "" } as any;
// AFTER
const fallback: SqlColumnKey = columnOptions[0] ?? { modelColumnId: null, columnName: "", workspaceTableId: null };
```

- [ ] **Step 8: Run TypeScript check**

```bash
cd "query-forge-ui" && npx tsc --noEmit 2>&1 | grep "FiltersSection" | head -20
```

Fix any remaining errors. Expected: 0 errors.

- [ ] **Step 9: Run full test suite**

```bash
cd "query-forge-ui" && npm run test -- --run 2>&1 | tee /tmp/queryforge-full-vitest.log; test ${PIPESTATUS[1]} -eq 0
```

- [ ] **Step 10: Commit**

```bash
cd "query-forge-ui" && git add src/features/query-forge/ui/components/FiltersSection.tsx && git commit -m "$(cat <<'EOF'
refactor: replace SqlFilterNode any casts with typed predicates in FiltersSection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Backend audit and lint verification

**Files:**
- Read: `query-forge-api/` — audit column key serialization

The `workspaceTableId` field on `SqlColumnKey` is now required (not optional). The backend must always emit `workspace_table_id` in serialized column references for `filters`, `columns`, `aggregations`, `sorts`, and data prep `target` fields.

- [ ] **Step 1: Run backend lint**

```bash
cd "query-forge-api" && ./scripts/lint.sh 2>&1 | tail -20
```

If this passes with no new errors, the backend is fine and you can skip to Step 4.

- [ ] **Step 2: If lint fails — find column key serialization**

Search for the backend code that serializes `SqlColumnKey`-shaped dicts:

```bash
cd "query-forge-api" && grep -rn "workspace_table_id\|workspaceTableId\|column_key\|columnKey" app/ --include="*.py" | grep -v test | head -30
```

- [ ] **Step 3: If any serialization path omits `workspace_table_id` — add it**

For any dict-building code that constructs a column key without `workspace_table_id`, add it. Example pattern:

```python
# BEFORE (missing workspace_table_id)
col_key = {"modelColumnId": col.model_column_id, "columnName": col.column_name}

# AFTER
col_key = {
    "modelColumnId": col.model_column_id,
    "columnName": col.column_name,
    "workspaceTableId": col.workspace_table_id,
}
```

Note: derived expression outputs (`SqlDerivedColumnRef`) are identified by the presence of `exprId` and should NOT have `workspaceTableId`.

- [ ] **Step 4: Re-run backend lint to confirm clean**

```bash
cd "query-forge-api" && ./scripts/lint.sh 2>&1 | tail -10
```

Expected: passes with no new errors.

- [ ] **Step 5: Commit backend changes (if any)**

```bash
cd "query-forge-api" && git add -p && git commit -m "$(cat <<'EOF'
fix: always emit workspace_table_id in column key serialization

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Version bump and audit update

**Files:**
- Modify: `query-forge-ui/package.json`
- Modify: `.claude/audits/frontend-audit.md`

- [ ] **Step 1: Bump patch version**

In `query-forge-ui/package.json`, increment the patch version by 1 (e.g. `0.3.48` → `0.3.49`).

- [ ] **Step 2: Update audit entries**

In `.claude/audits/frontend-audit.md`, update ISSUE-015 and mark ISSUE-031 sub-project B resolved:

```
ISSUE-015 sub-project B (shared domain model types): ✅ RESOLVED 2026-04-06
  - SqlColumnKey.workspaceTableId: number | null (required, was optional)
  - SqlColumnKey.dataType?: string | null added
  - SqlDerivedColumnRef added for DataPrepSection rule outputs
  - SqlFilterGroupNode / SqlFilterConditionNode named exports added
  - filterHelpers.ts: isGroupNode / isConditionNode type predicates
  - Consumer fixes: FiltersSection, ColumnsSection, useQueryForgeBuilderState, DataPrepSection
  - Snake_case field access mistakes corrected in useQueryForgeBuilderState
```

- [ ] **Step 3: Final full test run**

```bash
cd "query-forge-ui" && npm run test -- --run 2>&1 | tee /tmp/queryforge-full-vitest.log; test ${PIPESTATUS[1]} -eq 0
```

- [ ] **Step 4: Commit**

```bash
cd "query-forge-ui" && git add package.json && git commit -m "$(cat <<'EOF'
chore: bump version, mark ISSUE-015/031 sub-project B resolved

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
