import { useMemo, useState } from "react";

import type { ForgeMatchSourcePreview, ForgeMatchSourceRecord } from "../types";

type PreviewRow = ForgeMatchSourcePreview | ForgeMatchSourceRecord;

type Props = {
  rows: PreviewRow[];
};

function rowKey(row: PreviewRow, index: number): string {
  if (row.row_id) return String(row.row_id);
  return `${row.sheet_name ?? "sheet"}-${row.row_number ?? index}-${index}`;
}

function isLikelyFieldRow(row: PreviewRow): boolean {
  if (row.source_field_name && String(row.source_field_name).trim().length > 0) return true;
  if (row.source_type && String(row.source_type).trim().length > 0) return true;
  return false;
}

export default function ForgeMatchExtractionPreview({ rows }: Props) {
  const [expanded, setExpanded] = useState(false);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aScore = isLikelyFieldRow(a) ? 0 : 1;
      const bScore = isLikelyFieldRow(b) ? 0 : 1;
      if (aScore !== bScore) return aScore - bScore;
      return Number(a.row_number ?? 0) - Number(b.row_number ?? 0);
    });
  }, [rows]);

  const visible = expanded ? sortedRows.slice(0, 20) : sortedRows.slice(0, 6);

  return (
    <section className="fm-card" aria-label="ForgeMatch extraction preview">
      <div className="fm-section-head">
        <div>
          <h2 className="fm-card-title">2. Extraction Preview</h2>
          <p className="fm-card-subtitle">Sample extracted source fields with provenance from the uploaded workbook.</p>
        </div>
        {rows.length > 6 ? (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Collapse Preview" : "Expand Preview"}
          </button>
        ) : null}
      </div>

      <div className="table-responsive fm-preview-table-wrap">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Source Field</th>
              <th>Description</th>
              <th>Type</th>
              <th>Source Object</th>
              <th>Provenance</th>
              <th>Row Class</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted text-center py-3">No extracted rows available yet.</td>
              </tr>
            ) : (
              visible.map((row, index) => {
                const fieldRow = isLikelyFieldRow(row);
                return (
                  <tr key={rowKey(row, index)} className={fieldRow ? "" : "fm-preview-noise-row"}>
                    <td className="fw-semibold">{row.source_field_name ?? "-"}</td>
                    <td>{row.source_description ?? "-"}</td>
                    <td>{row.source_type ?? "-"}</td>
                    <td>{row.source_object_name ?? "-"}</td>
                    <td>{row.sheet_name ?? "-"} row {row.row_number ?? "-"}</td>
                    <td>
                      <span className={`fm-preview-row-kind ${fieldRow ? "fm-preview-row-kind-field" : "fm-preview-row-kind-noise"}`}>
                        {fieldRow ? "Field" : "Metadata"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="fm-table-footnote" role="status">
        Showing {visible.length} of {rows.length} extracted rows.
      </div>
    </section>
  );
}
