import React, { useMemo } from "react";

import type { ExecutionResultsResponse } from "../../../shared/services/executionsApi";
import { buildAdmPivot, formatAdmValue } from "./admPivot";

type AdmPivotTableProps = {
  rows: Array<Record<string, unknown>>;
  columns: ExecutionResultsResponse["columns"];
  showRowTotal?: boolean;
  showGrandTotal?: boolean;
};

export default function AdmPivotTable({
  rows,
  columns,
  showRowTotal = true,
  showGrandTotal = true,
}: AdmPivotTableProps) {
  const pivot = useMemo(() => buildAdmPivot(columns, rows), [columns, rows]);

  if (pivot.columns.length === 0 || pivot.rows.length === 0) {
    return <div className="text-muted small">No ADM pivot rows available.</div>;
  }

  const grandTotalAll = pivot.columns.reduce((sum, period) => sum + (pivot.grandTotals[period] ?? 0), 0);

  return (
    <div className="table-responsive">
      <table className="table table-sm mb-0 qf-chat-results-table qf-chat-adm-pivot-table">
        <thead>
          <tr>
            <th className="qf-chat-adm-sticky-col">Group</th>
            {pivot.columns.map((period) => (
              <th key={`period-${period}`} className="text-end">
                {period}
              </th>
            ))}
            {showRowTotal ? (
              <th className="text-end">Total</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {pivot.rows.map((row) => (
            <tr key={row.id}>
              <td className="qf-chat-adm-sticky-col">{row.label}</td>
              {pivot.columns.map((period) => {
                const value = row.values[period];
                return (
                  <td key={`${row.id}-${period}`} className="text-end">
                    {typeof value === "number" ? formatAdmValue(value) : "-"}
                  </td>
                );
              })}
              {showRowTotal ? (
                <td className="text-end fw-semibold">{formatAdmValue(row.rowTotal)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
        {showGrandTotal ? (
          <tfoot>
            <tr>
              <th className="qf-chat-adm-sticky-col">Grand total</th>
              {pivot.columns.map((period) => (
                <th key={`grand-${period}`} className="text-end">
                  {formatAdmValue(pivot.grandTotals[period] ?? 0)}
                </th>
              ))}
              {showRowTotal ? (
                <th className="text-end">{formatAdmValue(grandTotalAll)}</th>
              ) : null}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
