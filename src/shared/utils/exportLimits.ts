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

export function getExcelExportState(
  totalRowCount: number | null | undefined,
  exportConfig: ExportConfig | undefined
): ExcelExportState {
  const maxRows = exportConfig?.excel?.maxRows ?? DEFAULT_EXCEL_MAX_ROWS;
  const allowedFlag = exportConfig?.excel?.allowed;
  const total = typeof totalRowCount === "number" ? totalRowCount : null;
  const overLimit = total != null && total > maxRows;
  const allowed = allowedFlag !== false && !overLimit;

  const warning =
    !allowed && total != null
      ? `Excel supports up to ${maxRows.toLocaleString()} rows. Your result has ${total} rows.`
      : null;

  return { totalRowCount: total, allowed, maxRows, warning };
}

export function buildExcelFilename(fileName: string, folderPath?: string) {
  const base = fileName.trim() || "export.xlsx";
  const withExt = base.toLowerCase().endsWith(".xlsx") ? base : `${base}.xlsx`;
  const rawPath = folderPath ? folderPath.trim() : "";
  const normalizedPath = rawPath.replace(/[\\/]+$/g, "");
  const apiFilename = normalizedPath ? `${normalizedPath}/${withExt}` : withExt;
  return { apiFilename, downloadFilename: withExt };
}
