// src/features/domain-studio/ui/components/dictionaryTabUtils.ts
import React from "react";
import type { WorkspaceDictionaryColumn } from "../../../../shared/services/queryStudioAdminApi";
import type { DomainColumnRef } from "../../../query-forge/model/domainCatalog";

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderHighlightedText(
  text: string,
  query: string,
): React.ReactNode {
  if (!query) return text;
  const safe = escapeRegExp(query);
  const regex = new RegExp(`(${safe})`, "ig");
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${idx}`} className="dict-hit-mark">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
    ),
  );
}

export function buildDescriptionSnippet(
  description: string | null | undefined,
  query: string,
  maxLen = 110,
): string | null {
  const source = (description ?? "").trim();
  if (!source) return null;
  if (!query)
    return source.length > maxLen ? `${source.slice(0, maxLen)}…` : source;
  const lower = source.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0)
    return source.length > maxLen ? `${source.slice(0, maxLen)}…` : source;
  const contextBefore = 24;
  const contextAfter = maxLen - query.length - contextBefore;
  const start = Math.max(0, idx - contextBefore);
  const end = Math.min(
    source.length,
    idx + query.length + Math.max(24, contextAfter),
  );
  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

export function toColumnLookupKey(
  tableName: string,
  columnName: string,
): string {
  return `${tableName}::${columnName}`.toLowerCase();
}

export function toPreviewColumn(
  row: WorkspaceDictionaryColumn,
): DomainColumnRef {
  const raw = row as WorkspaceDictionaryColumn & Record<string, unknown>;
  const workspaceTableId = row.workspace_table_id;
  const domainId = Number(
    (raw as any).domainId ?? (raw as any).domain_id ?? 0,
  );
  return {
    modelColumnId: row.id || null,
    identityKey:
      `dict:${row.id}:${row.table_name ?? ""}:${row.column_name}`.toLowerCase(),
    columnName: row.column_name,
    modelTableName: row.table_name ?? "",
    fullName: String(
      (raw as any).fullName ??
        (raw as any).full_name ??
        `${row.table_name ?? ""}.${row.column_name}`,
    ),
    tableAlias: null,
    columnLabel: null,
    dataType: row.data_type ?? "unknown",
    nullable: true,
    description: row.description,
    workspaceTableId,
    modelTableId: null,
    baseTableName: row.table_name ?? "",
    schemaName: String((raw as any).schema_name ?? ""),
    catalogName: String((raw as any).catalog_name ?? ""),
    domainId,
    domainName: "Data Dictionary",
    variantCode: null,
    isQe: false,
    existsInDbx: false,
    lastSeenAt: row.sample_ran_at ?? null,
    ordinalPosition: row.ordinal_position ?? undefined,
    sampleValues: row.sample_values_json,
    sampleStats: row.sample_stats_json,
    sampleRanAt: row.sample_ran_at,
    sampleError: row.sample_error,
    tableColumnCount: undefined,
  };
}
