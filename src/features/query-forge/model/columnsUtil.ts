import type { SqlColumnKey, SqlColumnRef } from "./sqlJson";
import { colKey } from "./sqlJson";

export function normalizeColumns(cols: SqlColumnRef[]): SqlColumnRef[] {
  const seen = new Set<string>();
  const out: SqlColumnRef[] = [];
  for (const c of cols) {
    const k = colKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

export function upsertSelectedColumn(cols: SqlColumnRef[], col: SqlColumnRef): SqlColumnRef[] {
  const key = colKey(col);
  let replaced = false;
  const next = cols.map((c) => {
    if (colKey(c) !== key) return c;
    replaced = true;

    const alias = (col.alias ?? "").trim();
    const merged: SqlColumnRef = { ...c, ...col };

    if (!alias && (c.alias ?? "").trim()) merged.alias = c.alias ?? null;
    if (!merged.exprId && (c as any).exprId) merged.exprId = (c as any).exprId;
    if (merged.workspaceTableId == null && (c as any).workspaceTableId != null) {
      (merged as any).workspaceTableId = (c as any).workspaceTableId;
    }
    if (merged.modelColumnId == null && c.modelColumnId != null) merged.modelColumnId = c.modelColumnId;
    if (!merged.columnName) merged.columnName = c.columnName;

    return merged;
  });

  if (!replaced) next.push(col);
  return normalizeColumns(next);
}

export function removeSelectedColumn(cols: SqlColumnRef[], col: SqlColumnKey): SqlColumnRef[] {
  const key = colKey(col);
  return cols.filter((c) => colKey(c) !== key);
}

export function getResultFieldName(col: SqlColumnRef): string {
  const alias = (col.alias ?? "").trim();
  return alias ? alias : col.columnName;
}
