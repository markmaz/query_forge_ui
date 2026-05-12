export function isFlowForgeTableName(tableName: string | null | undefined): boolean {
  const normalized = String(tableName ?? "").trim().toLowerCase();
  const unqualified = normalized.split(".").pop() ?? normalized;
  return unqualified.startsWith("flowforge_") || unqualified.startsWith("v_flowforge_");
}

export function isSystemDictionaryTableName(tableName: string | null | undefined): boolean {
  return isFlowForgeTableName(tableName);
}

export function dictionaryTableBadgeLabel(tableName: string | null | undefined): string | null {
  return isFlowForgeTableName(tableName) ? "Workflow" : null;
}
