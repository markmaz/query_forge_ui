// src/shared/services/mappers/domainColumns.ts
import type { BuilderColumnRow } from "@/shared/services/queryStudioAdminApi";
import type { DomainColumnRef } from "../../model/domainCatalog";

function safeParseJson(s: string | null): any | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function toDomainColumnRef(r: BuilderColumnRow): DomainColumnRef {
  const identityKey =
    typeof r.workspaceTableId === "number" && r.columnName
      ? `${r.workspaceTableId}:${r.columnName}`
      : typeof r.modelColumnId === "number"
        ? `id:${r.modelColumnId}`
        : `name:${r.columnName}`;
  return {
    modelColumnId: r.modelColumnId ?? null,
    identityKey,
    columnName: r.columnName,
    modelTableName: r.modelTableName,
    fullName: r.fullName,
    tableAlias: r.tableAlias ?? null,
    columnLabel: r.columnLabel ?? null,

    dataType: r.dataType,
    nullable: typeof r.nullable === "boolean" ? r.nullable : Boolean(r.nullable),
    description: r.description,

    workspaceTableId: r.workspaceTableId,
    modelTableId: r.modelTableId,
    baseTableName: r.baseTableName,
    schemaName: r.schemaName,
    catalogName: r.catalogName,

    domainId: r.domainId,
    domainName: r.domainName,

    variantCode: r.variantCode,
    isQe: r.isQe,
    existsInDbx: r.existsInDbx,
    lastSeenAt: r.lastSeenAt,

    ordinalPosition: r.ordinalPosition,

    sampleValues: safeParseJson(r.sampleValuesJson),
    sampleStats: safeParseJson(r.sampleStatsJson),
    sampleRanAt: r.sampleRanAt,
    sampleError: r.sampleError,

    tableColumnCount: r.tableColumnCount,
  };
}
