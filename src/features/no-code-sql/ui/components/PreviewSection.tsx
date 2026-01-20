// src/features/nocode-query/ui/components/PreviewCard.tsx
import React, { useMemo, useRef, useState } from "react";
import { SectionShell } from "./SectionShell"; // ✅ new
import type { SqlQueryJson } from "../../model/sqlJson";
import {
  runNoCodeQuery,
  type NoCodeRunResponse,
  type NoCodeRunMode,
} from "@/shared/api/noCodeAdminApi";
import { useRunTimer } from "../../../../shared/hooks/useRunTimer";
import { startExcelExport } from "../../../../shared/api/exportApi";
import { buildExcelFilename, getExcelExportState } from "../../../../shared/utils/exportLimits";
import { ExportExcelDialog } from "../../../../shared/ui/ExportExcelDialog";
import { toast } from "react-toastify";

type Props = {
  sqlJson: SqlQueryJson;
  persistKey?: string;
  exportBaseName?: string;

  collapsed: boolean;
  onToggleCollapsed: () => void;

  onHide?: () => void;

  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;

  heightPx?: number; // default 620
};

type ColumnDef = { key: string; label?: string };

function inferColumns(rows: any[]): ColumnDef[] {
  if (!rows || rows.length === 0) return [];
  const first = rows[0];
  if (first && typeof first === "object" && !Array.isArray(first)) {
    return Object.keys(first).map((k) => ({ key: k, label: k }));
  }
  return [];
}

function formatCell(v: any) {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export const PreviewCard: React.FC<Props> = ({
  sqlJson,
  persistKey,
  exportBaseName,
  collapsed,
  onToggleCollapsed,
  onHide,
  isFullscreen,
  onToggleFullscreen,
  heightPx = 620,
}) => {
  const [mode, setMode] = useState<NoCodeRunMode>("preview");
  const [hasRun, setHasRun] = useState(false);

  const limit = 200;
  const offset = 0;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { elapsedMs: previewElapsedMs, start: startPreviewTimer, stop: stopPreviewTimer } = useRunTimer();
  const [exportBusy, setExportBusy] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");

  const [data, setData] = useState<NoCodeRunResponse | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const hydratedRef = useRef(false);
  const hydratedKeyRef = useRef<string | null>(null);
  const lastSqlSigRef = useRef<string | null>(null);
  const sqlSig = useMemo(() => JSON.stringify(sqlJson), [sqlJson]);
  const storageKey = `query_builder_preview:${persistKey ?? "draft"}`;

  const canRun = useMemo(() => {
    return sqlJson.domainId != null && (sqlJson.columns?.length > 0 || sqlJson.aggs?.enabled);
  }, [sqlJson]);

  const rows: any[] = (data?.rows as any[]) ?? [];
  const sqlText = data?.sqlRendered ?? data?.sql;
  const columns: ColumnDef[] = useMemo(() => {
    const fromApi = (data?.columns as any[]) ?? [];
    if (fromApi.length) {
      return fromApi.map((c) => ({
        key: c.key ?? c.columnName ?? c,
        label: c.label ?? c.key ?? c,
      }));
    }
    return inferColumns(rows);
  }, [data?.columns, rows]);

  const total = data?.total ?? null;
  const totalRowCount = (data as any)?.totalRowCount ?? total;
  const exportState = useMemo(
    () => getExcelExportState(totalRowCount, (data as any)?.export),
    [totalRowCount, (data as any)?.export]
  );
  const elapsedLabel = previewElapsedMs > 0 ? `${(previewElapsedMs / 1000).toFixed(1)}s` : "";

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratedKeyRef.current === storageKey) return;

    hydratedRef.current = false;
    hydratedKeyRef.current = storageKey;

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.sqlSig === sqlSig && saved?.data) {
          setData(saved.data);
          setHasRun(true);
          setShowSql(false);
        }
      }
    } catch (e) {
      console.warn("Failed to restore preview cache", e);
    } finally {
      hydratedRef.current = true;
      lastSqlSigRef.current = sqlSig;
    }
  }, [storageKey, sqlSig]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydratedRef.current) return;
    if (lastSqlSigRef.current == null) {
      lastSqlSigRef.current = sqlSig;
      return;
    }
    if (lastSqlSigRef.current !== sqlSig) {
      let restored = false;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved?.sqlSig === sqlSig && saved?.data) {
            setData(saved.data);
            setHasRun(true);
            setShowSql(false);
            restored = true;
          }
        }
      } catch (e) {
        console.warn("Failed to restore preview cache", e);
      }
      if (!restored) {
        setHasRun(false);
        setData(null);
        setShowSql(false);
        localStorage.removeItem(storageKey);
      }
    }
    lastSqlSigRef.current = sqlSig;
  }, [sqlSig, storageKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!data) {
      localStorage.removeItem(storageKey);
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sqlSig, data, savedAt: new Date().toISOString() }));
    } catch (e) {
      console.warn("Failed to persist preview cache", e);
    }
  }, [data, sqlSig, storageKey]);

  const onRun = async (nextMode: NoCodeRunMode) => {
    if (!canRun) return;

    startPreviewTimer();
    setMode(nextMode);
    setLoading(true);
    setError(null);

    try {
      const res = await runNoCodeQuery(sqlJson, nextMode, { limit, offset } as any);
      setData(res);
      setHasRun(true);
      setShowSql(false);
    } catch (e: any) {
      setError(e?.message ?? "Preview failed");
    } finally {
      setLoading(false);
      stopPreviewTimer();
    }
  };

  const openExportDialog = () => {
    const base = (exportBaseName ?? "").trim() || "query_export";
    setExportFileName(buildExcelFilename(base).downloadFilename);
    setExportDialogOpen(true);
  };

  const onExportExcel = async (fileName: string) => {
    if (!exportState.allowed || exportBusy) return;
    setExportBusy(true);
    try {
      const { apiFilename } = buildExcelFilename(fileName);
      await startExcelExport({ sqlJson, filename: apiFilename });
    } catch (e: any) {
      if (e?.code === "EXCEL_ROW_LIMIT") {
        const rowCount = e?.rowCount ?? exportState.totalRowCount;
        const maxRows = e?.maxRows ?? exportState.maxRows;
        const msg =
          rowCount != null
            ? `Excel supports up to ${maxRows.toLocaleString()} rows. Your result has ${rowCount} rows.`
            : e?.message ?? "Excel export row limit exceeded.";
        toast.error(msg);
      } else {
        toast.error(e?.message ?? "Failed to export Excel.");
      }
    } finally {
      setExportBusy(false);
    }
  };

  const confirmExportExcel = () => {
    setExportDialogOpen(false);
    onExportExcel(exportFileName);
  };

  const onCopySql = async () => {
    if (!sqlText) return;
    try {
      await navigator.clipboard.writeText(sqlText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy SQL failed", e);
    }
  };

  // ✅ right side now only section-specific actions
  const right = (
    <div className="d-flex align-items-center gap-2">
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={openExportDialog}
        disabled={!canRun || !exportState.allowed || exportBusy}
        title={exportState.warning ?? "Export Excel"}
      >
        <i className={`fa ${exportBusy ? "fa-spinner fa-spin" : "fa-file-excel"} me-1`} />
        Export Excel
      </button>

      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={() => onRun("preview")}
        disabled={!canRun || loading}
        title="Run preview"
      >
        <i className={`fa ${loading ? "fa-spinner fa-spin" : "fa-bolt"} me-1`} />
        {loading ? "Running…" : "Run Preview"}
      </button>
    </div>
  );

  return (
    <>
      <style>{`
        .ncq-preview-wrap { display:flex; flex-direction:column; gap:12px; }
        .ncq-preview-content { display:flex; flex-direction:column; height: var(--ncqH); min-height:0; overflow:hidden; }

        .ncq-toprow { flex:0 0 auto; }
        .ncq-stage { flex:1 1 auto; min-height:0; overflow:hidden; }

        .ncq-panel {
          height: 100%;
          border: 1px solid rgba(0,0,0,0.10);
          border-radius: 10px;
          background: #fff;
          padding: 12px;
          display:flex;
          flex-direction:column;
          min-height:0;
          overflow:hidden;
        }

        .ncq-toolbar { flex:0 0 auto; margin-bottom:10px; }
        .ncq-summary {
          font-size: 12px;
          color: rgba(0,0,0,0.60);
          display:flex; align-items:center; gap:10px; flex-wrap:wrap;
        }

        .ncq-table-wrap {
          flex:1 1 auto;
          min-height:0;
          overflow:auto;
          border:1px solid rgba(0,0,0,0.10);
          border-radius:10px;
          -webkit-overflow-scrolling: touch;
        }

        .ncq-pager { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:10px; }
        .ncq-pagehint { font-size:12px; color: rgba(0,0,0,0.60); white-space:nowrap; }

        .ncq-sqlbox {
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          white-space: pre;
          padding: 10px;
          background: rgba(0,0,0,0.03);
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.08);
        }

        .ncq-swap { position: relative; flex: 1 1 auto; min-height:0; overflow:hidden; }
        .ncq-view {
          position:absolute; inset:0;
          display:flex; flex-direction:column;
          min-height:0;
          opacity:0;
          transform: translateY(6px);
          pointer-events:none;
          transition: opacity 160ms ease, transform 160ms ease;
        }
        .ncq-view.is-active {
          opacity:1;
          transform: translateY(0);
          pointer-events:auto;
        }
        @media (prefers-reduced-motion: reduce) {
          .ncq-view { transition:none; transform:none; }
        }
      `}</style>

      <SectionShell
        id="preview"
        title="Preview"
        subtitle="Preview results and export when ready."
        iconClass="fa-eye"
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        onHide={onHide}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        right={right}
      >
        <div
          className="ncq-preview-wrap ncq-preview-content"
          style={{
            ["--ncqH" as any]: `${Math.max(420, isFullscreen ? window.innerHeight - 120 : heightPx)}px`,
          } as React.CSSProperties}
        >
          <div className="ncq-toprow d-flex align-items-center justify-content-between">
            <small className="text-muted">Preview shows a sample. Export generates a full extract.</small>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setShowSql((s) => !s)}
              disabled={!sqlText}
              title={showSql ? "Show results" : "Show SQL"}
            >
              <i className={`fa ${showSql ? "fa-table" : "fa-code"} me-1`} />
              {showSql ? "Results" : "SQL"}
            </button>
          </div>
          </div>

          {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}

          {!canRun ? (
            <div className="border rounded p-3 bg-light">
              <div className="text-muted" style={{ fontSize: 13 }}>
                Select a domain and at least one column (or enable aggregations), then click <b>Run Preview</b>.
              </div>
            </div>
          ) : (
            <div className="ncq-stage">
              <div className="ncq-panel">
                <div className="ncq-swap">
                  {/* RESULTS VIEW */}
                  <div className={`ncq-view ${!showSql ? "is-active" : ""}`}>
                    <div className="ncq-toolbar">
                      <div className="ncq-summary">
                        <span className="badge bg-primary text-white" style={{ fontSize: 13, padding: "6px 10px" }}>
                          Total: {totalRowCount != null ? totalRowCount : rows.length}
                        </span>
                        <span
                          className="badge bg-light text-secondary"
                          style={{ fontSize: 13, padding: "6px 10px" }}
                        >
                          Rows shown: {rows.length}
                        </span>
                        {elapsedLabel ? (
                          <span className="badge bg-warning text-dark" style={{ fontSize: 13, padding: "6px 10px" }}>
                            {loading ? "Running…" : "Last run"} {elapsedLabel}
                          </span>
                        ) : null}
                      </div>
                      {exportState.warning ? (
                        <div className="text-warning small mt-1">{exportState.warning}</div>
                      ) : null}
                    </div>

                    <div className="ncq-table-wrap">
                      <table className="table table-sm table-hover mb-0 align-middle">
                        <thead className="table-light">
                          <tr>
                            {columns.map((c) => (
                              <th key={c.key} style={{ whiteSpace: "nowrap" }}>
                                {c.label ?? c.key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={Math.max(1, columns.length)} className="text-muted text-center py-4">
                                {loading ? "Query running…" : "No rows returned."}
                              </td>
                            </tr>
                          ) : (
                            rows.map((r, i) => (
                              <tr key={i}>
                                {columns.map((c) => (
                                  <td key={c.key} style={{ maxWidth: 320 }}>
                                    <span title={formatCell(r?.[c.key])}>{formatCell(r?.[c.key])}</span>
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="ncq-pagehint">Showing up to {limit} rows.</div>
                  </div>

                  {/* SQL VIEW */}
                  <div className={`ncq-view ${showSql ? "is-active" : ""}`}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-semibold" style={{ fontSize: 13 }}>
                      Generated SQL
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={onCopySql}
                        disabled={!sqlText}
                        title={copied ? "Copied" : "Copy SQL"}
                      >
                        <i className={`fa ${copied ? "fa-check" : "fa-copy"}`} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setShowSql(false)}
                      >
                        <i className="fa fa-arrow-left me-1" />
                        Back
                      </button>
                    </div>
                  </div>

                    <div className="ncq-sqlbox">{sqlText ?? "-- Run preview to see SQL --"}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionShell>

      <ExportExcelDialog
        open={exportDialogOpen}
        title="Export Excel"
        fileName={exportFileName}
        onChangeFileName={setExportFileName}
        onConfirm={confirmExportExcel}
        onClose={() => setExportDialogOpen(false)}
      />
    </>
  );
};
