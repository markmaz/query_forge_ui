# Shared Domain Model `any` Cleanup — Design Spec (ISSUE-015/031 Sub-project B)

## Goal

Remove `any` type usages from `FiltersSection.tsx`, `ColumnsSection.tsx`, and `useQueryForgeBuilderState.ts` (~109 usages) by fixing the shared type definitions that drive them. Also enforces the backend to always emit `workspace_table_id` in column key serialization.

## Root Causes Addressed

| # | Root cause | Casts eliminated | Files |
|---|------------|-----------------|-------|
| 1 | `workspaceTableId` optional on `SqlColumnKey` | ~14 | ColumnsSection, useQueryForgeBuilderState |
| 2 | `dataType` not on `SqlColumnKey` | ~3 | FiltersSection, useQueryForgeBuilderState |
| 3 | `SqlDerivedColumnRef` missing (rule outputs typed as `SqlColumnKey`) | ~4 | DataPrepSection |
| 4 | `SqlFilterNode` union not narrowed | ~10 | FiltersSection |
| 5 | Snake_case field accesses on `DomainColumnRef` | ~5 | useQueryForgeBuilderState |
| 6 | False-miss `as any` casts (field already exists on type) | ~11 | All three |

## Architecture

Three layers of change:

1. **`sqlJson.ts`** — Type definition changes (source of truth for the domain model)
2. **`filterHelpers.ts`** (new) — `SqlFilterNode` type predicates with unit tests
3. **Consumer fixes** — `FiltersSection.tsx`, `ColumnsSection.tsx`, `useQueryForgeBuilderState.ts`, `DataPrepSection.tsx`, `dataPrepHelpers.ts`
4. **Backend** — Audit column key serialization; run `./scripts/lint.sh` to verify no breakage

---

## Section 1: `sqlJson.ts` Type Changes

### 1a. `SqlColumnKey` — `workspaceTableId` required, `dataType` added

```typescript
export type SqlColumnKey = {
  modelColumnId: number | null;
  columnName: string;
  workspaceTableId: number;        // was: workspaceTableId?: number | null
  dataType?: string | null;        // new: eliminates post-construction mutation in useQueryForgeBuilderState
  exprId?: string | null;
  alias?: string | null;
};
```

`workspaceTableId` is required and non-null — every real workspace column reference always has one. `dataType` is optional (not all column keys carry type metadata) but explicitly declared so it can be set at construction time rather than smuggled in via `as any`.

Since `SqlColumnRef` already declares `dataType?: string | null` as an intersection field, that duplicate declaration is removed from `SqlColumnRef` — it is now inherited from `SqlColumnKey`.

### 1b. New `SqlDerivedColumnRef` — for DataPrepSection rule outputs

```typescript
export type SqlDerivedColumnRef = {
  exprId: string;
  columnName: string;
  alias?: string | null;
};
```

No `workspaceTableId`, no `modelColumnId`. A derived/computed expression has no workspace table identity. This type is used only for `SqlDataPrepRuleBase.output`.

### 1c. `SqlDataPrepRuleBase.output` changes to `SqlDerivedColumnRef`

```typescript
export type SqlDataPrepRuleBase = {
  id: string;
  enabled: boolean;
  target: SqlColumnKey;           // unchanged: always a real workspace column
  output: SqlDerivedColumnRef;    // was: SqlColumnKey
  applyScope: "query_wide";
};
```

`target` is the input column (always a real workspace column). `output` is the derived expression this rule produces (never a real column).

### 1d. Named `SqlFilterNode` variants exported

The `SqlFilterNode` union members are extracted into named exported types so `filterHelpers.ts` can use them in predicate return types:

```typescript
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
  value: any;       // FilterValue union is out of scope for this sub-project
  negate?: boolean;
};

export type SqlFilterNode = SqlFilterGroupNode | SqlFilterConditionNode;
```

---

## Section 2: New `filterHelpers.ts`

New file: `src/features/query-forge/ui/components/filterHelpers.ts`

```typescript
import type { SqlFilterNode, SqlFilterGroupNode, SqlFilterConditionNode } from "../../model/sqlJson";

export function isGroupNode(n: SqlFilterNode): n is SqlFilterGroupNode {
  return n.type === "group";
}

export function isConditionNode(n: SqlFilterNode): n is SqlFilterConditionNode {
  return n.type === "condition";
}
```

Test file: `src/features/query-forge/ui/components/__tests__/filterHelpers.test.ts`

Tests: `isGroupNode` returns true for group, false for condition; `isConditionNode` returns true for condition, false for group.

---

## Section 3: Consumer Changes

### 3a. `FiltersSection.tsx`

- Import `isGroupNode`, `isConditionNode` from `./filterHelpers`
- In `asNode` / `sqlNodeToRootModel`: replace all `(n as any).match`, `(n as any).children`, `(n as any).field`, `(n as any).op`, `(n as any).value`, `(n as any).id` with properly-narrowed accesses after predicate guards
- Remove 3 tautological `Node as any` casts in `updateNode`/`removeNode`/`coerceFields` — use the `Node` type alias consistently in array generics
- Remove 2 false-miss casts: `(r as any).id` (id is on `SqlDataPrepRuleBase`) and `(c as any).alias` (alias is on `SqlColumnKey`)
- Remove `(output as any).dataType` / `(output as any).data_type` — use `output.dataType` directly (now on `SqlColumnKey`); drop the snake_case fallback
- One `{ modelColumnId: null, columnName: "" } as any` → remove `as any` (valid `SqlColumnKey` shape once `workspaceTableId` is required — provide the value)

### 3b. `ColumnsSection.tsx`

All 14 casts are false misses once `workspaceTableId` becomes required and non-optional:
- `(c as any).workspaceTableId` → `c.workspaceTableId`
- `(c as any).exprId` → `c.exprId`
- `(c as any).tableAlias` → `c.tableAlias`

No structural changes needed — just remove the casts.

### 3c. `useQueryForgeBuilderState.ts`

- Remove `(column as any).workspaceTableId` casts (~9 occurrences) → `column.workspaceTableId`
- Remove `(column as any).exprId` casts → `column.exprId`
- Replace `(key as any).dataType = row.dataType ?? row.data_type ?? null` mutation with `dataType: row.dataType ?? null` at construction time (the `data_type` snake_case fallback is removed — see 3d)
- Fix snake_case field accesses: `row.table_name` → `row.modelTableName`, `row.data_type` → `row.dataType`, `row.full_name` → `row.fullName`, `row.workspace_table_id` → `row.workspaceTableId` (these were early-era mistakes hidden by `as any`)
- Remove `allRows.map((row: any) => ...)` and `pageRows.map((row: any) => ...)` widening — use `DomainColumnRef` directly
- Replace `(rule as any).output` → `rule.output` using `rule as SqlDataPrepRuleBase` (not `as any`) for union access; same for `(rule as any).id`
- `hit: any` → `hit: DomainColumnRef | undefined` once the snake_case fields are corrected

### 3d. `DataPrepSection.tsx`

- `makeOutput()` return type: `SqlColumnKey` → `SqlDerivedColumnRef`
- `makeDatePartOutput()` return type: `SqlColumnKey` → `SqlDerivedColumnRef`
- Callers that assign the output to `SqlDataPrepRuleBase.output` now correctly accept `SqlDerivedColumnRef`
- Where `output` fields are constructed inline in `updateRule` switch cases, ensure they produce `SqlDerivedColumnRef` shapes (i.e., use `exprId`, not `workspaceTableId`)

### 3e. `dataPrepHelpers.ts`

- `DataPrepRulePatch` does not include an `output` field (it uses `outputName?: string` which maps to `output.columnName` inside `updateRule`) — no change needed
- `mkColumnRef(col: SqlColumnKey): SqlValueRef` — callers must pass a `SqlColumnKey` with `workspaceTableId: number`. Construction sites in `DataPrepSection.tsx` that build column refs for concat inputs already use real workspace columns, so this is satisfied.

---

## Section 4: Backend Verification

**Change required:** `workspace_table_id` must always be present in every serialized `SqlColumnKey` emitted by the backend (in filters, columns, aggregations, sorts, data prep targets). Derived rule outputs (`SqlDerivedColumnRef`) are identified by the presence of `expr_id` and the absence of `workspace_table_id`.

**Verification step (required before marking complete):**
```bash
cd query-forge-api && ./scripts/lint.sh
```

This must pass with zero new errors. If any backend serialization path is found to produce a column key without `workspace_table_id`, it must be fixed as part of this sub-project.

---

## Testing

- `filterHelpers.test.ts` — 4 tests (positive + negative for each predicate)
- Full Vitest suite (`npm run test -- --run`) must pass after each consumer change
- Backend lint (`./scripts/lint.sh`) must pass after backend audit

## Out of Scope

- `SqlFilterNode` condition `value: any` → typed `FilterValue` union (a larger change, deferred)
- `DomainColumnRef.sampleValues` / `sampleStats` typed as `any` (out of scope)
- Sub-project C (`queryStudioAdminApi.ts` API boundary types)
