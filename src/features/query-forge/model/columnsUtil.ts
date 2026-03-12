import type { SqlColumnKey, SqlColumnRef } from "./sqlJson";
import { colKey } from "./sqlJson";

function preserveStableFields(current: SqlColumnRef, incoming: SqlColumnRef): SqlColumnRef {
  const merged: SqlColumnRef = { ...current, ...incoming };

  const incomingAlias = (incoming.alias ?? "").trim();
  if (!incomingAlias && (current.alias ?? "").trim()) {
    merged.alias = current.alias ?? null;
  }

  if (!merged.exprId && (current as { exprId?: string | null }).exprId) {
    merged.exprId = (current as { exprId?: string | null }).exprId;
  }

  if (merged.workspaceTableId == null && current.workspaceTableId != null) {
    merged.workspaceTableId = current.workspaceTableId;
  }

  if (merged.modelColumnId == null && current.modelColumnId != null) {
    merged.modelColumnId = current.modelColumnId;
  }

  if (!merged.columnName) {
    merged.columnName = current.columnName;
  }

  return merged;
}

export function normalizeColumns(cols: SqlColumnRef[]): SqlColumnRef[] {
  const seen = new Set<string>();
  return cols.filter((column) => {
    const key = colKey(column);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function upsertSelectedColumn(
  cols: SqlColumnRef[],
  col: SqlColumnRef
): SqlColumnRef[] {
  const targetKey = colKey(col);
  let didReplace = false;

  const updated = cols.map((existing) => {
    if (colKey(existing) !== targetKey) return existing;
    didReplace = true;
    return preserveStableFields(existing, col);
  });

  if (!didReplace) updated.push(col);
  return normalizeColumns(updated);
}

export function removeSelectedColumn(
  cols: SqlColumnRef[],
  col: SqlColumnKey
): SqlColumnRef[] {
  const targetKey = colKey(col);
  return cols.filter((column) => colKey(column) !== targetKey);
}

export function getResultFieldName(col: SqlColumnRef): string {
  const alias = (col.alias ?? "").trim();
  return alias.length > 0 ? alias : col.columnName;
}
