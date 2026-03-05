import type { ExecutionResultsResponse } from "../../../shared/services/executionsApi";

export type PivotMetricColumn = ExecutionResultsResponse["columns"];
export type PivotMetricRow = Record<string, unknown>;
type ExecutionColumn = NonNullable<ExecutionResultsResponse["columns"]>[number];

export type AdmPivotRow = {
  id: string;
  label: string;
  values: Record<string, number>;
  rowTotal: number;
};

export type AdmPivotResult = {
  columns: string[];
  rows: AdmPivotRow[];
  grandTotals: Record<string, number>;
};

const REPORT_PERIOD_KEYS = new Set(["reportperiod"]);
const SCHOOL_YEAR_KEYS = new Set(["schoolyear"]);
const SCHOOL_NAME_KEYS = new Set(["schoolname"]);
const STUDENT_UNIQUE_ID_KEYS = new Set(["studentuniqueid"]);
const FIRST_NAME_KEYS = new Set(["firstname"]);
const LAST_NAME_KEYS = new Set(["lastname"]);
const ADM_METRIC_KEYS = new Set(["totaladm", "adm", "admtotal"]);

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toColumnRecord(column: ExecutionColumn): {
  key: string | null;
  label: string | null;
} {
  if (typeof column === "string") {
    const normalized = column.trim();
    return {
      key: normalized.length > 0 ? normalized : null,
      label: normalized.length > 0 ? normalized : null,
    };
  }
  if (column && typeof column === "object") {
    const record = column as Record<string, unknown>;
    const keyCandidate = record.key;
    const labelCandidate = record.label;
    const key = typeof keyCandidate === "string" && keyCandidate.trim() ? keyCandidate.trim() : null;
    const label = typeof labelCandidate === "string" && labelCandidate.trim() ? labelCandidate.trim() : null;
    return { key, label };
  }
  return { key: null, label: null };
}

function toRowValue(row: PivotMetricRow, key: string | null): unknown {
  if (!key) return undefined;
  return row[key];
}

function toDisplayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function toNumericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isNumericToken(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

function reportPeriodSort(a: string, b: string): number {
  const aTrimmed = a.trim();
  const bTrimmed = b.trim();
  const aNumeric = isNumericToken(aTrimmed);
  const bNumeric = isNumericToken(bTrimmed);
  if (aNumeric && bNumeric) return Number(aTrimmed) - Number(bTrimmed);
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return aTrimmed.localeCompare(bTrimmed, undefined, { numeric: true, sensitivity: "base" });
}

function firstRow(rows: PivotMetricRow[]): PivotMetricRow | null {
  return rows.length > 0 ? rows[0] : null;
}

function findRowKeyByNormalizedSet(row: PivotMetricRow | null, validKeys: Set<string>): string | null {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const key of keys) {
    if (validKeys.has(normalizeToken(key))) return key;
  }
  return null;
}

function findRowKeyFromColumns(
  columns: PivotMetricColumn,
  row: PivotMetricRow | null,
  validKeys: Set<string>
): string | null {
  if (!Array.isArray(columns) || !row) return null;
  const rowKeys = Object.keys(row);

  for (const column of columns) {
    const parsed = toColumnRecord(column);
    const normalizedKey = parsed.key ? normalizeToken(parsed.key) : "";
    const normalizedLabel = parsed.label ? normalizeToken(parsed.label) : "";
    const matches = validKeys.has(normalizedKey) || validKeys.has(normalizedLabel);
    if (!matches) continue;

    if (parsed.key) {
      const directMatch = rowKeys.find((rowKey) => rowKey === parsed.key);
      if (directMatch) return directMatch;

      const looseMatch = rowKeys.find(
        (rowKey) => normalizeToken(rowKey) === normalizeToken(parsed.key as string)
      );
      if (looseMatch) return looseMatch;
    }
  }

  return null;
}

function findMetricKey(columns: PivotMetricColumn, rows: PivotMetricRow[]): string | null {
  const row = firstRow(rows);
  if (!row) return null;
  return (
    findRowKeyFromColumns(columns, row, ADM_METRIC_KEYS) ??
    findRowKeyByNormalizedSet(row, ADM_METRIC_KEYS)
  );
}

function findReportPeriodKey(columns: PivotMetricColumn, rows: PivotMetricRow[]): string | null {
  const row = firstRow(rows);
  if (!row) return null;
  return (
    findRowKeyFromColumns(columns, row, REPORT_PERIOD_KEYS) ??
    findRowKeyByNormalizedSet(row, REPORT_PERIOD_KEYS)
  );
}

function buildSchoolLabel(row: PivotMetricRow, schoolNameKey: string, schoolYearKey: string | null): {
  id: string;
  label: string;
} {
  const schoolName = toDisplayValue(toRowValue(row, schoolNameKey)) ?? "Unknown school";
  const schoolYear = toDisplayValue(toRowValue(row, schoolYearKey));
  const id = `${schoolName}::${schoolYear ?? ""}`;
  return {
    id,
    label: schoolYear ? `${schoolName} (${schoolYear})` : schoolName,
  };
}

function buildStudentLabel(
  row: PivotMetricRow,
  studentUniqueIdKey: string | null,
  firstNameKey: string | null,
  lastNameKey: string | null,
  schoolYearKey: string | null
): { id: string; label: string } {
  const studentUniqueId = toDisplayValue(toRowValue(row, studentUniqueIdKey));
  const firstName = toDisplayValue(toRowValue(row, firstNameKey));
  const lastName = toDisplayValue(toRowValue(row, lastNameKey));
  const schoolYear = toDisplayValue(toRowValue(row, schoolYearKey));
  const fullName = [firstName, lastName].filter((entry): entry is string => Boolean(entry)).join(" ").trim();
  const primaryLabel = fullName || studentUniqueId || "Unknown student";
  const suffixParts = [studentUniqueId, schoolYear].filter((entry): entry is string => Boolean(entry));
  const suffix = suffixParts.length > 0 ? ` (${suffixParts.join(" • ")})` : "";
  const id = [studentUniqueId ?? "", firstName ?? "", lastName ?? "", schoolYear ?? ""].join("::");
  return {
    id,
    label: `${primaryLabel}${suffix}`,
  };
}

function buildYearLabel(row: PivotMetricRow, schoolYearKey: string | null): { id: string; label: string } {
  const schoolYear = toDisplayValue(toRowValue(row, schoolYearKey)) ?? "Unknown year";
  return {
    id: schoolYear,
    label: schoolYear,
  };
}

export function isAdmResult(columns: PivotMetricColumn, rows: PivotMetricRow[]): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const reportPeriodKey = findReportPeriodKey(columns, rows);
  const metricKey = findMetricKey(columns, rows);
  return Boolean(reportPeriodKey && metricKey);
}

export function buildAdmPivot(columns: PivotMetricColumn, rows: PivotMetricRow[]): AdmPivotResult {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { columns: [], rows: [], grandTotals: {} };
  }

  const reportPeriodKey = findReportPeriodKey(columns, rows);
  const metricKey = findMetricKey(columns, rows);
  if (!reportPeriodKey || !metricKey) {
    return { columns: [], rows: [], grandTotals: {} };
  }

  const rowProbe = firstRow(rows);
  const schoolYearKey = findRowKeyByNormalizedSet(rowProbe, SCHOOL_YEAR_KEYS);
  const schoolNameKey = findRowKeyByNormalizedSet(rowProbe, SCHOOL_NAME_KEYS);
  const studentUniqueIdKey = findRowKeyByNormalizedSet(rowProbe, STUDENT_UNIQUE_ID_KEYS);
  const firstNameKey = findRowKeyByNormalizedSet(rowProbe, FIRST_NAME_KEYS);
  const lastNameKey = findRowKeyByNormalizedSet(rowProbe, LAST_NAME_KEYS);

  const hasSchoolName = Boolean(schoolNameKey);
  const hasStudentShape = Boolean(studentUniqueIdKey || firstNameKey || lastNameKey);

  const periodSet = new Set<string>();
  const rowMap = new Map<string, AdmPivotRow>();
  const grandTotals: Record<string, number> = {};

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const periodLabel = toDisplayValue(toRowValue(row, reportPeriodKey));
    const metricValue = toNumericValue(toRowValue(row, metricKey));
    if (!periodLabel || metricValue === null) continue;

    periodSet.add(periodLabel);

    const rowIdentity = hasSchoolName && schoolNameKey
      ? buildSchoolLabel(row, schoolNameKey, schoolYearKey)
      : hasStudentShape
        ? buildStudentLabel(row, studentUniqueIdKey, firstNameKey, lastNameKey, schoolYearKey)
        : buildYearLabel(row, schoolYearKey);

    const existing = rowMap.get(rowIdentity.id);
    if (existing) {
      existing.values[periodLabel] = (existing.values[periodLabel] ?? 0) + metricValue;
      existing.rowTotal += metricValue;
    } else {
      rowMap.set(rowIdentity.id, {
        id: rowIdentity.id,
        label: rowIdentity.label,
        values: {
          [periodLabel]: metricValue,
        },
        rowTotal: metricValue,
      });
    }

    grandTotals[periodLabel] = (grandTotals[periodLabel] ?? 0) + metricValue;
  }

  const periodColumns = Array.from(periodSet).sort(reportPeriodSort);
  const pivotRows = Array.from(rowMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true })
  );

  return {
    columns: periodColumns,
    rows: pivotRows,
    grandTotals,
  };
}

export function formatAdmValue(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
