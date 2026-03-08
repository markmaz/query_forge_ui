export type ExportExcelConfig = {
  allowed?: boolean;
  maxRows?: number;
};

export type ExportConfig = {
  excel?: ExportExcelConfig | null;
} | null;

export type ExcelExportState = {
  totalRowCount: number | null;
  allowed: boolean;
  maxRows: number;
  warning: string | null;
};

export const DEFAULT_EXCEL_MAX_ROWS = 1_048_576;

function normalizeTotalRows(totalRowCount: number | null | undefined): number | null {
  return typeof totalRowCount === "number" ? totalRowCount : null;
}

function buildExportWarning(isAllowed: boolean, totalRows: number | null, maxRows: number) {
  if (isAllowed || totalRows == null) {
    return null;
  }
  return `Excel supports up to ${maxRows.toLocaleString()} rows. Your result has ${totalRows} rows.`;
}

export function getExcelExportState(
  totalRowCount: number | null | undefined,
  exportConfig: ExportConfig | undefined
): ExcelExportState {
  const maxRows = exportConfig?.excel?.maxRows ?? DEFAULT_EXCEL_MAX_ROWS;
  const explicitAllowed = exportConfig?.excel?.allowed;
  const total = normalizeTotalRows(totalRowCount);
  const exceedsLimit = total != null && total > maxRows;
  const allowed = explicitAllowed !== false && !exceedsLimit;
  const warning = buildExportWarning(allowed, total, maxRows);

  return { totalRowCount: total, allowed, maxRows, warning };
}

export function buildExcelFilename(fileName: string, folderPath?: string) {
  const trimmedName = fileName.trim();
  const base = trimmedName || "export.xlsx";
  const withExt = base.toLowerCase().endsWith(".xlsx") ? base : `${base}.xlsx`;
  const rawPath = folderPath?.trim() ?? "";
  const normalizedPath = rawPath.replace(/[\\/]+$/g, "");
  const apiFilename = normalizedPath ? `${normalizedPath}/${withExt}` : withExt;
  return { apiFilename, downloadFilename: withExt };
}
