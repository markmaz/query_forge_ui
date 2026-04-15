# DataPrepSection `any` Cleanup — Design Spec (ISSUE-015/031 Sub-project A)

## Goal

Remove all `any` type usages from `DataPrepSection.tsx` by extracting typed helpers into a new `dataPrepHelpers.ts` module and fixing one latent bug (`nulls: "empty"` → `"skip"`). No changes to `sqlJson.ts` (sub-project B covers shared types).

## Architecture

Two files change:

1. **New: `src/features/query-forge/ui/components/dataPrepHelpers.ts`** — typed helpers, constructors, predicates, and the `DataPrepRulePatch` interface. This is the only file that knows about `SqlValueRef` discriminant access and rule-type narrowing.

2. **Modified: `src/features/query-forge/ui/components/DataPrepSection.tsx`** — imports helpers, removes `FillEmptyExtended`, tightens `updateRule` signature, fixes the `nulls` bug, and drops all `as any` casts.

## `dataPrepHelpers.ts` Exports

### `DataPrepRulePatch`

Flat interface covering every field any rule type can accept as a patch. Replaces `Partial<SqlDataPrepRule> | any` as the `updateRule` patch parameter, removing `as any` from all ~20 call sites.

```ts
export type DataPrepRulePatch = {
  op?: SqlDataPrepOp;
  target?: SqlColumnKey | null;
  outputName?: string;
  // SqlFillEmptyRule
  value?: string | number | boolean | null;
  fallbackCol?: SqlColumnKey | null;
  treatBlankAsEmpty?: boolean;
  applyScope?: "query_wide";
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

### Type predicates

```ts
export function isRuleConcat(r: SqlDataPrepRule): r is SqlConcatRule {
  return r.op === "concat";
}

export function isFillEmpty(r: SqlDataPrepRule): r is SqlFillEmptyRule {
  return r.op === "fill_empty";
}
```

`isRuleConcat` currently uses `(r as any)?.op === "concat"` — the union already exposes `op` without casting.

### `SqlValueRef` constructors

```ts
export function mkColumnRef(col: SqlColumnKey): SqlValueRef {
  return { type: "column", col };
}

export function mkLiteralRef(value: string | number | boolean | null): SqlValueRef {
  return { type: "literal", value };
}
```

Removes all `{ type: "column", col: ... } as any` and `{ type: "literal", value: ... } as any` inline constructions in `ensureMinTwoInputs` and the concat chip builder JSX.

### `SqlValueRef` accessors

```ts
export function getValueRefCol(v: SqlValueRef): SqlColumnKey | null {
  return v.type === "column" ? v.col : null;
}

export function getValueRefLiteral(v: SqlValueRef): string | number | boolean | null {
  return v.type === "literal" ? v.value : null;
}
```

Removes `(v as any).col` / `(v as any).value` in `pillText` and the concat chip renderer.

## `DataPrepSection.tsx` Changes

1. **Delete `FillEmptyExtended`** — `SqlFillEmptyRule` already declares `fallbackCol?: SqlColumnKey | null` in `sqlJson.ts`. Replace every `r as any as FillEmptyExtended` with `r as SqlFillEmptyRule` (or use `isFillEmpty` predicate).

2. **Fix `isRuleConcat`** — replace the inline implementation with an import from `dataPrepHelpers`.

3. **Fix `ensureMinTwoInputs`** — replace `as any` constructions with `mkColumnRef` / `mkLiteralRef`.

4. **Fix `pillText`** — replace `(v as any).col` and `(v as any).value` with `getValueRefCol(v)` and `getValueRefLiteral(v)`.

5. **Fix `updateRule` signature** — `patch: Partial<SqlDataPrepRule> | any` → `patch: DataPrepRulePatch`. Remove `as any` from all call sites.

6. **Fix `nulls` bug** — replace `nulls: "empty" as any` (×3) and `nulls: "empty"` (×1) with `nulls: "skip"` in all four initialization/reset paths.

7. **Simplify `allColumns` construction** — `columnsMeta` is typed as `DomainColumnRef[]`; drop the `as any[]` cast and the snake_case fallbacks (`c.name`, `c.model_column_id`, `c.model_table_name`, `c.data_type`, `c.workspace_table_id`). `DomainColumnRef` guarantees camelCase.

## Testing

One test file: `src/features/query-forge/ui/components/__tests__/dataPrepHelpers.test.ts`

Tests cover:
- `isRuleConcat` returns true for concat, false for others
- `isFillEmpty` returns true for fill_empty, false for others
- `mkColumnRef` / `mkLiteralRef` produce correct shapes
- `getValueRefCol` returns col for column refs, null for literals
- `getValueRefLiteral` returns value for literals, null for column refs

The existing DataPrepSection is a large render-heavy component with no current unit tests — a render smoke test is out of scope for this sub-project (ISSUE-024 covers missing test coverage broadly).

## Out of Scope

- Changes to `sqlJson.ts` (sub-project B)
- Changes to `queryStudioAdminApi.ts` (sub-project C)
- Adding `"empty"` to `SqlConcatRule["nulls"]` — confirmed latent bug, fix is to use `"skip"`
- Test coverage for `DataPrepSection` render paths (ISSUE-024)
