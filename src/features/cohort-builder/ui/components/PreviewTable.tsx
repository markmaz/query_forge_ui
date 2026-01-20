import React, { useMemo, useState } from 'react';
import type { PreviewColumn } from '../../model/types';

export const PreviewTable: React.FC<{
  rows: any[];
  columns?: PreviewColumn[];
  sql?: string | null;
  params?: Record<string, any> | any[];
  total?: number | null;
  loading?: boolean;
  elapsedMs?: number;
  exportWarning?: string | null;
}> = ({ rows, columns, sql, params, total, loading, elapsedMs = 0, exportWarning = null }) => {
  const showEmpty = rows.length === 0 && !loading && !sql;
  const showNoResults = rows.length === 0 && !loading && !!sql;
  const showSkeleton = !!loading;
  const normalizedColumns = normalizeColumns(columns, rows);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const sqlWithValues = useMemo(() => renderSqlWithParams(sql, params), [sql, params]);
  const hasSql = !!sql;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="text-muted small">Preview</div>
        {hasSql ? (
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-link text-decoration-none"
              onClick={() => setShowSql((v) => !v)}
              title={showSql ? "Hide SQL" : "Show SQL"}
            >
              {showSql ? "Hide SQL" : "Show SQL"}
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="progress mb-2" style={{ height: 4 }}>
          <div
            className="progress-bar progress-bar-striped progress-bar-animated"
            style={{ width: "100%" }}
          />
        </div>
      ) : null}

      <div style={{ position: "relative", minHeight: 240 }}>
        <div
          style={{
            opacity: showSql ? 0 : 1,
            transition: "opacity 320ms ease",
            pointerEvents: showSql ? "none" : "auto",
          }}
        >
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            <span className="badge bg-primary text-white" style={{ fontSize: 13, padding: "6px 10px" }}>
              Total: {total != null ? total : rows.length}
            </span>
            <span className="badge bg-light text-secondary" style={{ fontSize: 13, padding: "6px 10px" }}>
              Rows shown: {rows.length}
            </span>
            {elapsedMs > 0 ? (
              <span className="badge bg-warning text-dark" style={{ fontSize: 13, padding: "6px 10px" }}>
                {loading ? "Running…" : "Last run"} {(elapsedMs / 1000).toFixed(1)}s
              </span>
            ) : null}
          </div>
          {exportWarning ? <div className="text-warning small mb-2">{exportWarning}</div> : null}

          {showNoResults ? (
            <NoResultsState />
          ) : showEmpty ? (
            <EmptyPreviewState />
          ) : showSkeleton ? (
            <SkeletonPreviewTable columns={normalizedColumns} />
          ) : (
            <RealPreviewTable rows={rows} columns={normalizedColumns} />
          )}
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: showSql ? 1 : 0,
            transition: "opacity 320ms ease",
            pointerEvents: showSql ? "auto" : "none",
          }}
        >
          {sqlWithValues || sql ? (
            <div
              className="rounded px-3 py-2"
              style={{
                background: "rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.12)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                position: "relative",
                height: "100%",
                overflow: "auto",
              }}
            >
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(sqlWithValues);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  } catch (e) {
                    console.error("Copy SQL failed", e);
                  }
                }}
                title={copied ? "Copied" : "Copy SQL"}
                style={{ position: "absolute", top: 8, right: 8 }}
              >
                <i className={`fa ${copied ? "fa-check" : "fa-copy"}`} />
              </button>
              {sqlWithValues ?? sql}
            </div>
          ) : null}
        </div>

        {loading ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.65)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              paddingTop: 16,
              zIndex: 1,
            }}
          >
            <div
              className="rounded"
              style={{
                width: "92%",
                padding: 12,
                background: "rgba(0,0,0,0.02)",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <div className="placeholder-glow mb-2 d-flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span key={`head-${i}`} className="placeholder col-2" />
                ))}
              </div>
              {Array.from({ length: 6 }).map((_, rowIdx) => (
                <div key={`row-${rowIdx}`} className="placeholder-glow mb-2 d-flex gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={`cell-${rowIdx}-${i}`} className="placeholder col-2" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* ---------- EMPTY STATE (before Run) ---------- */

const EmptyPreviewState: React.FC = () => (
  <div
    className="rounded p-4"
    style={{
      minHeight: 220,
      background:
        'linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.01))',
      border: '1px dashed rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div style={{ maxWidth: 520 }}>
      <div
        className="rounded mb-3"
        style={{
          height: 90,
          background:
            'radial-gradient(circle at 25% 30%, rgba(0,0,0,0.06), transparent 55%),' +
            'radial-gradient(circle at 75% 70%, rgba(0,0,0,0.05), transparent 55%)',
          filter: 'grayscale(1)',
          opacity: 0.75,
        }}
      />
      <div className="fw-semibold">Run preview to see results</div>
      <div className="text-muted small mt-1">
        Once filters are generated, click <span className="fw-semibold">Run</span>{' '}
        to preview matching patients.
      </div>
    </div>
  </div>
);

const NoResultsState: React.FC = () => (
  <div
    className="rounded p-4"
    style={{
      minHeight: 180,
      background: "rgba(0,0,0,0.02)",
      border: "1px solid rgba(0,0,0,0.12)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div className="text-center" style={{ maxWidth: 520 }}>
      <div className="fw-semibold">No results returned</div>
      <div className="text-muted small mt-1">Try relaxing or adjusting your filters.</div>
    </div>
  </div>
);

/* ---------- SKELETON (while running) ---------- */

const SkeletonPreviewTable: React.FC<{ columns: PreviewColumn[] }> = ({ columns }) => {
  const colCount = columns.length || 5;
  return (
  <div className="table-responsive" style={{ maxWidth: "100%", overflowX: "auto" }}>
    <table className="table table-sm" style={{ width: "100%" }}>
      <thead>
        <tr>
          {Array.from({ length: colCount }).map((_, idx) => (
            <th key={idx} style={{ whiteSpace: "nowrap", maxWidth: 240 }}>
              —
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 6 }).map((_, i) => (
          <tr key={i}>
            {Array.from({ length: colCount }).map((_, c) => (
              <td key={c} style={{ maxWidth: 240 }}>
                <span className="placeholder-glow">
                  <span className="placeholder col-6" />
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};

/* ---------- REAL TABLE ---------- */

const RealPreviewTable: React.FC<{ rows: any[]; columns: PreviewColumn[] }> = ({ rows, columns }) => (
  <div className="table-responsive" style={{ maxWidth: "100%", overflowX: "auto" }}>
    <table className="table table-sm" style={{ width: "100%" }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={{ whiteSpace: "nowrap", maxWidth: 240 }}>
              {c.label ?? c.key}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={r?.id ?? idx}>
            {columns.map((c) => (
              <td
                key={c.key}
                style={{
                  maxWidth: 240,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={formatCell(r?.[c.key])}
              >
                {formatCell(r?.[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

function normalizeColumns(columns: PreviewColumn[] | undefined, rows: any[]): PreviewColumn[] {
  if (columns && columns.length) {
    return columns.map((c: any) => {
      if (typeof c === 'string') return { key: c, label: c };
      if (c && typeof c === 'object') {
        const key = c.key ?? c.columnName ?? c.name ?? '';
        const label = c.label ?? c.key ?? c.columnName ?? c.name ?? key;
        return { key, label };
      }
      return { key: String(c), label: String(c) };
    }).filter((c) => c.key);
  }
  if (!rows || rows.length === 0) return [];
  const first = rows[0];
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    return Object.keys(first).map((k) => ({ key: k, label: k }));
  }
  return [];
}

function formatCell(value: any) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderSqlWithParams(sql?: string | null, params?: Record<string, any>) {
  if (!sql) return null;
  if (!params || Object.keys(params).length === 0) return sql;

  return sql.replace(/:p(\\d+)/g, (match, idx) => {
    const key = `p${idx}`;
    const n = Number(idx);
    let val;
    if (Array.isArray(params)) {
      val = params[n - 1];
    } else {
      val = params[key] ?? params[idx] ?? params[n] ?? params[match];
    }
    if (val === undefined) return match;
    return formatSqlValue(val);
  });
}

function formatSqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (Array.isArray(value)) {
    return `(${value.map(formatSqlValue).join(', ')})`;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  const s = String(value).replace(/'/g, "''");
  return `'${s}'`;
}
