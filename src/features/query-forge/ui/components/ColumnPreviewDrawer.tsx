import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/columnPreviewDrawer.css"
import { DomainColumnRef } from "../../model/domainCatalog";

function safeParseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;

  // ✅ already parsed (object or array)
  if (typeof raw === "object") {
    return raw as T;
  }

  // ✅ legacy stringified JSON
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return (v ?? fallback) as T;
    } catch {
      return fallback;
    }
  }

  // everything else (number, boolean, etc.)
  return fallback;
}

function toIsoString(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  // last resort
  try {
    return String(v);
  } catch {
    return null;
  }
}

const STAT_HELP: Record<string, string> = {
  sample_row_count: "How many rows were scanned in the sample slice used to compute these stats (may be capped).",
  non_null_count: "Count of sampled rows where this column had a non-null value.",
  null_count: "Count of sampled rows where this column was null.",
  null_pct: "Percent of sampled rows where this column was null.",
  approx_distinct: "Approximate number of distinct values in the sample (fast estimate).",
  sample_percent: "Percent of the table targeted for sampling (not always exact due to caps).",
  sample_row_cap: "Maximum number of rows allowed in the sample to keep sampling fast.",
  sample_empty: "True if the sample had no rows (or produced no usable values).",
};

function humanizeStatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bPct\b/i, "%");
}

function formatStatValue(key: string, v: any) {
  if (v === null || v === undefined) return "—";

  // special-case pct keys
  if (typeof v === "number" && (key.endsWith("_pct") || key === "sample_percent")) {
    // null_pct in your payload is 0..1, sample_percent looks like 0..1 too
    // If you ever store 10 for 10%, this still looks fine because 10*100=1000; you'll notice quickly.
    return `${(v * 100).toFixed(2)}%`;
  }

  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function formatSampleValue(v: unknown): string {
  if (v === null) return "NULL";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (typeof v === "object") {
    const record = v as Record<string, unknown>;
    if (!Array.isArray(v) && Object.prototype.hasOwnProperty.call(record, "value")) {
      const value = record.value;
      const count = record.count;
      let renderedValue: string;
      if (value === null) {
        renderedValue = "NULL";
      } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        renderedValue = String(value);
      } else {
        try {
          renderedValue = JSON.stringify(value);
        } catch {
          renderedValue = String(value);
        }
      }

      if (typeof count === "number" && Number.isFinite(count)) {
        return `${renderedValue} (count: ${count.toLocaleString()})`;
      }
      return renderedValue;
    }

    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  return String(v);
}

export const ColumnPreviewDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  col: DomainColumnRef;
  onSelectAndClose?: () => void;
  isSelected: boolean;
  showSelectAction?: boolean;
}> = ({ open, onClose, col, onSelectAndClose, isSelected, showSelectAction = true }) => {


  const sampleValues = useMemo(
    () => safeParseJson<Array<unknown>>(col?.sampleValues, []),
    [col]
  );

const stats = useMemo(() => {
  return safeParseJson<Record<string, any>>(
    col?.sampleStats,
    {}
  );
}, [col]);

  const sampleRanAt = col?.sampleRanAt ?? null;
  const sampleError = col?.sampleError ?? null;
  const statEntries = useMemo(() => Object.entries(stats ?? {}), [stats]);
  if (!open) return null;

  return createPortal(
    <>
      <div className="offcanvas-backdrop fade show" onClick={onClose} />

      <div
        className="offcanvas offcanvas-end show column-preview-offcanvas"
        style={{ width: 920 }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
<div className="offcanvas-header border-bottom column-preview-header">
  <div className="column-preview-title-wrap">
    <div className="column-preview-title-row">
      <span className="column-preview-title">{col?.columnName}</span>

      {isSelected && (
        <span className="badge bg-primary column-preview-selected-badge">
          Selected
        </span>
      )}
    </div>

    <div className="column-preview-subtitle">
      {col?.modelTableName ? <span>{col.modelTableName}</span> : null}
      {col?.modelTableName && col?.fullName ? <span> • </span> : null}
      {col?.fullName ? <span>{col.fullName}</span> : null}
    </div>
  </div>

  <button type="button" className="btn-close" onClick={onClose} />
</div>

        <div className="offcanvas-body">
          {sampleError ? (
            <div className="alert alert-danger py-2">
              <div className="fw-semibold">Sampling error</div>
              <div className="small">{sampleError}</div>
            </div>
          ) : null}

          <div className="mb-3">
            <div className="text-muted small fw-semibold mb-1">Description</div>
            <div className="small">
              {(col?.description || "").trim() ? col.description : <span className="text-muted">No description yet.</span>}
            </div>
          </div>

          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <div className="text-muted small fw-semibold">Sample values</div>
              {sampleRanAt ? <div className="text-muted small">as of {sampleRanAt}</div> : null}
            </div>

            <div className="table-responsive border rounded">
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "100%" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleValues.length === 0 ? (
                    <tr>
                      <td className="text-muted small p-3">No sample values.</td>
                    </tr>
                  ) : (
                    sampleValues.map((v, idx) => (
                      <tr key={idx}>
                        <td
                          className="small"
                          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                        >
                          {formatSampleValue(v)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-muted small mt-2">
              Note: these are “top values” from the sampled slice (not raw rows).
            </div>
          </div>

          <div>
            <div className="text-muted small fw-semibold mb-1">Stats</div>
            <div className="border rounded p-2">
                {statEntries.map(([k, v]) => {
                const help = STAT_HELP[k] ?? "Stat definition coming soon.";

                return (
                    <div
                    key={k}
                    className="d-flex justify-content-between align-items-start gap-3 py-1"
                    style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                    >
                    <div className="text-muted small d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                        <span>{humanizeStatKey(k)}</span>

                        <i
                        className="fa fa-circle-info text-muted"
                        aria-hidden="true"
                        title={help}          // ✅ native tooltip
                        style={{ cursor: "help" }}
                        />
                    </div>

                    <div className="small fw-medium text-end">
                        {formatStatValue(k, v)}
                    </div>
                    </div>
                );
                })}
            </div>
          </div>
        </div>

        <div
          className={`offcanvas-footer border-top p-3 d-flex align-items-center ${
            showSelectAction ? "justify-content-between" : "justify-content-end"
          }`}
        >
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Close
          </button>

          {showSelectAction ? (
            <button className="btn btn-primary btn-sm" onClick={onSelectAndClose ?? onClose}>
              {isSelected ? "Keep Selected & Close" : "Select Column & Close"}
            </button>
          ) : null}
        </div>
      </div>
    </>,
    document.body
  );
};
