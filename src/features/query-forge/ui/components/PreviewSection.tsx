// src/features/nocode-query/ui/components/PreviewCard.tsx
import React, { useMemo, useRef, useState } from "react";
import { SectionShell } from "./SectionShell"; // ✅ new
import type { SqlQueryJson, SqlColumnRef } from "../../model/sqlJson";
import { labelFor } from "../../model/sqlJson";
import type { NoCodeRunResponse } from "@/shared/services/queryStudioAdminApi";
import { useExecutionTimer } from "../../../../shared/react-hooks/useExecutionTimer";
import { startExcelExport } from "../../../../shared/services/exportApi";
import {
  buildExcelFilename,
  getExcelExportState,
} from "../../../../shared/helpers/exportLimits";
import { ExportExcelDialog } from "../../../../shared/components/ExportExcelDialog";
import { toast } from "react-toastify";
import {
  cancelExecution,
  getExecutionResults,
  getExecutionStatus,
  startExecution,
} from "../../../../shared/services/executionsApi";
import { getResultFieldName } from "../../model/columnsUtil";
import QueryAnalysisPanel from "./QueryAnalysisPanel";
import { ResultSummary } from "./ResultSummary/ResultSummary";
import { useResultSummary, buildQueryKey } from "../hooks/useResultSummary";

type Props = {
  sqlJson: SqlQueryJson;
  persistKey?: string;
  persistKeyPrefix?: string;
  exportBaseName?: string;

  collapsed: boolean;
  onToggleCollapsed: () => void;

  onHide?: () => void;

  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;

  heightPx?: number; // default 620
  title?: string;
  subtitle?: string;
  count?: number;
  canRunOverride?: boolean;
  runDisabledTitle?: string;
  onRunPreview?: () => void;
  getLatestSqlJson?: () => SqlQueryJson;
  datasource?: string | null;

  helpAction?: {
    label?: string;
    ariaLabel?: string;
    iconClass?: string;
    onClick: () => void;
    hidden?: boolean;
  };
  extraActions?: React.ReactNode;
  queryId?: string | null;
  workspaceId?: string | number | null;
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

function SkeletonWord({
  text,
  widthPct,
  delayMs,
}: {
  text: string;
  widthPct: number;
  delayMs: number;
}) {
  return (
    <span
      className="ncq-skeleton-word"
      style={{
        display: "inline-block",
        width: `${widthPct}%`,
        maxWidth: 220,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        animationDelay: `${delayMs}ms`,
      }}
    >
      {text}
    </span>
  );
}

export const PreviewCard: React.FC<Props> = ({
  sqlJson,
  persistKey,
  persistKeyPrefix = "query_builder_preview",
  exportBaseName,
  collapsed,
  onToggleCollapsed,
  onHide,
  isFullscreen,
  onToggleFullscreen,
  heightPx = 620,
  title = "Results",
  subtitle = "Preview results and export when ready.",
  count,
  canRunOverride,
  runDisabledTitle,
  onRunPreview,
  getLatestSqlJson,
  helpAction,
  extraActions,
  datasource,
  queryId,
  workspaceId,
}) => {
  const [hasRun, setHasRun] = useState(false);

  const limit = 200;
  const offset = 0;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [previewStatementId, setPreviewStatementId] = useState<string | null>(
    null,
  );
  const [previewStartedAtMs, setPreviewStartedAtMs] = useState<number | null>(
    null,
  );
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [previewElapsedMs, setPreviewElapsedMs] = useState(0);
  const executionTimer = useExecutionTimer(loading, previewStartedAtMs);
  const previewPollRef = useRef<number | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");

  const [data, setData] = useState<NoCodeRunResponse | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [summaryEnabled, setSummaryEnabled] = useState(true);

  // Reset analysis panel when query re-runs
  React.useEffect(() => {
    if (loading) setShowAnalysis(false);
  }, [loading]);
  const [copied, setCopied] = useState(false);
  const hydratedRef = useRef(false);
  const hydratedKeyRef = useRef<string | null>(null);
  const lastSqlSigRef = useRef<string | null>(null);
  const lastRunSqlJsonRef = useRef<SqlQueryJson | null>(null);
  const sqlSig = useMemo(() => JSON.stringify(sqlJson), [sqlJson]);
  const storageKey = `${persistKeyPrefix}:${persistKey ?? "draft"}`;

  const computedCanRun = useMemo(() => {
    return (
      sqlJson.domainId != null &&
      (sqlJson.columns?.length > 0 || sqlJson.aggs?.enabled)
    );
  }, [sqlJson]);
  const canRun =
    typeof canRunOverride === "boolean" ? canRunOverride : computedCanRun;
  const runTitle = !canRun
    ? (runDisabledTitle ?? "Run preview")
    : "Run preview";

  const rows: any[] = (data?.rows as any[]) ?? [];
  const sqlText = data?.sqlRendered ?? data?.sql;
  const effectiveCount = count ?? (rows.length ? rows.length : undefined);
  const labelByField = useMemo(() => {
    const m = new Map<string, string>();
    (sqlJson.columns ?? []).forEach((c: SqlColumnRef) => {
      const field = getResultFieldName(c);
      m.set(field, labelFor(c));
    });
    return m;
  }, [sqlJson.columns]);
  const fieldBySourceName = useMemo(() => {
    const m = new Map<string, string>();
    (sqlJson.columns ?? []).forEach((c: SqlColumnRef) => {
      const field = getResultFieldName(c);
      if (c.columnName) m.set(c.columnName, field);
    });
    return m;
  }, [sqlJson.columns]);
  const columns: ColumnDef[] = useMemo(() => {
    if (!data) return [];
    const fromApi = (data?.columns as any[]) ?? [];
    if (fromApi.length) {
      return fromApi.map((c) => {
        const rawKey = c.key ?? c.columnName ?? c;
        const key = fieldBySourceName.get(rawKey) ?? rawKey;
        const label = labelByField.get(key) ?? c.label ?? c.key ?? c;
        return { key, label };
      });
    }
    const inferred = inferColumns(rows).map((c) => ({
      key: c.key,
      label: labelByField.get(c.key) ?? c.label ?? c.key,
    }));
    return inferred;
  }, [data, data?.columns, rows, labelByField, fieldBySourceName]);

  const {
    summary: resultSummary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    retry: retrySummary,
  } = useResultSummary({
    workspaceId: String(workspaceId ?? ""),
    queryName: exportBaseName ?? "Draft Query",
    columnNames: columns.map((c) => c.key),
    rows: rows as Record<string, unknown>[],
    enabled: rows.length > 0 && !!workspaceId,
  });

  const summaryKey = useMemo(
    () =>
      JSON.stringify(
        buildQueryKey(
          String(workspaceId ?? ""),
          exportBaseName ?? "Draft Query",
          columns.map((c) => c.key),
          rows as Record<string, unknown>[],
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, exportBaseName, columns, rows],
  );

  const total = data?.total ?? null;
  const totalRowCount = (data as any)?.totalRowCount ?? total;
  const exportState = useMemo(
    () => getExcelExportState(totalRowCount, (data as any)?.export),
    [totalRowCount, (data as any)?.export],
  );
  const elapsedLabel =
    previewElapsedMs > 0 ? `${(previewElapsedMs / 1000).toFixed(1)}s` : "";
  const skeletonCols = 6;
  const skeletonRows = 100;
  const skeletonWords = [
    "patient",
    "claims",
    "encounters",
    "diagnosis",
    "procedure",
    "medication",
    "cohort",
    "provider",
    "admit_date",
    "member_id",
    "paid_amount",
    "service_date",
  ];
  const skeletonColumns = useMemo<ColumnDef[]>(
    () => Array.from({ length: skeletonCols }, (_, i) => ({ key: `sk-${i}` })),
    [skeletonCols],
  );
  const showInitial = !hasRun && !loading;
  const showSkeleton = loading;

  React.useEffect(() => {
    if (!loading || previewStartedAtMs == null) return;
    setPreviewElapsedMs(Date.now() - previewStartedAtMs);
    const id = window.setInterval(() => {
      setPreviewElapsedMs(Date.now() - previewStartedAtMs);
    }, 250);
    return () => window.clearInterval(id);
  }, [loading, previewStartedAtMs]);

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
      localStorage.setItem(
        storageKey,
        JSON.stringify({ sqlSig, data, savedAt: new Date().toISOString() }),
      );
    } catch (e) {
      console.warn("Failed to persist preview cache", e);
    }
  }, [data, sqlSig, storageKey]);

  const stopPreviewPolling = () => {
    if (previewPollRef.current) {
      window.clearInterval(previewPollRef.current);
      previewPollRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => stopPreviewPolling();
  }, []);

  const pollPreviewStatus = async (jobId: string) => {
    try {
      const statusRes = await getExecutionStatus(jobId);
      const status = statusRes.status;
      setPreviewStatus(status);

      const terminal =
        status === "SUCCEEDED" ||
        status === "FAILED" ||
        status === "CANCELED" ||
        status === "CANCELLED";
      if (!terminal) return;

      stopPreviewPolling();

      if (status === "SUCCEEDED") {
        const execRes = await getExecutionResults(jobId, { limit, offset });
        setData(execRes as NoCodeRunResponse);
        setHasRun(true);
        setShowSql(false);
      } else if (status !== "CANCELED" && status !== "CANCELLED") {
        setError("Preview failed");
      }

      setLoading(false);
    } catch (e) {
      stopPreviewPolling();
      setPreviewStatus("FAILED");
      setLoading(false);
      setError("Preview failed");
      console.error("Preview status polling failed", e);
    }
  };

  const startPreviewPolling = (jobId: string) => {
    stopPreviewPolling();
    previewPollRef.current = window.setInterval(() => {
      void pollPreviewStatus(jobId);
    }, 1000);
    void pollPreviewStatus(jobId);
  };

  const onRun = async () => {
    // Give section components that emit sqlJson changes via effects
    // a frame to flush before we snapshot the payload for execution.
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    const sqlForRun = getLatestSqlJson?.() ?? sqlJson;
    const canRunNow =
      sqlForRun.domainId != null &&
      ((sqlForRun.columns?.length ?? 0) > 0 || sqlForRun.aggs?.enabled);
    if (!canRunNow) return;

    onRunPreview?.();
    setLoading(true);
    setError(null);
    setPreviewStatus("RUNNING");
    setPreviewStartedAtMs(Date.now());
    setPreviewElapsedMs(0);
    setPreviewJobId(null);
    setPreviewStatementId(null);
    lastRunSqlJsonRef.current = sqlForRun;

    try {
      const exec = await startExecution({
        sqlJson: sqlForRun,
        kind: "query_builder",
        limit,
        offset,
        datasource: datasource ?? null,
      });
      setPreviewJobId(exec.jobId);
      setPreviewStatementId(exec.statementId);
      startPreviewPolling(exec.jobId);
    } catch (e: any) {
      setLoading(false);
      setPreviewStatus("FAILED");
      setError(e?.message ?? "Preview failed");
    }
  };

  const onCancelPreview = async () => {
    if (
      !previewStatementId ||
      !(loading || previewStatus === "RUNNING" || previewStatus === "CANCELING")
    )
      return;
    setPreviewStatus("CANCELING");
    try {
      await cancelExecution(previewStatementId);
    } catch (e) {
      console.error("Cancel preview failed", e);
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
      const sqlForExport = getLatestSqlJson?.() ?? sqlJson;
      await startExcelExport({ sqlJson: sqlForExport, fileName: apiFilename });
    } catch (e: any) {
      if (e?.code === "EXCEL_ROW_LIMIT") {
        const rowCount = e?.rowCount ?? exportState.totalRowCount;
        const maxRows = e?.maxRows ?? exportState.maxRows;
        const msg =
          rowCount != null
            ? `Excel supports up to ${maxRows.toLocaleString()} rows. Your result has ${rowCount} rows.`
            : (e?.message ?? "Excel export row limit exceeded.");
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

  const canCancel =
    !!previewStatementId &&
    (loading || previewStatus === "RUNNING" || previewStatus === "CANCELING");

  // ✅ right side now only section-specific actions
  const right = (
    <div className="d-flex align-items-center gap-2">
      {extraActions}
      <div className="d-flex align-items-center gap-1">
        <label
          htmlFor="ai-summary-toggle"
          className="form-check-label small text-muted mb-0"
          style={{ cursor: "pointer" }}
        >
          AI Summary
        </label>
        <div className="form-check form-switch mb-0 ms-1">
          <input
            id="ai-summary-toggle"
            type="checkbox"
            className="form-check-input"
            checked={summaryEnabled}
            onChange={(e) => setSummaryEnabled(e.target.checked)}
            title={summaryEnabled ? "Disable AI Summary" : "Enable AI Summary"}
          />
        </div>
      </div>
      {rows.length > 0 && (
        <button
          type="button"
          className={`btn btn-sm ${showAnalysis && queryId ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => {
            if (!queryId) {
              toast.info("Save this query first to use AI Analysis.");
              return;
            }
            setShowAnalysis((v) => !v);
          }}
          title={
            queryId
              ? "AI analysis of results"
              : "Save this query first to use AI Analysis"
          }
        >
          <span style={{ filter: "hue-rotate(-30deg) saturate(2)" }}>✨</span>{" "}
          Analyze
        </button>
      )}
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={openExportDialog}
        disabled={!canRun || !exportState.allowed || exportBusy}
        title={exportState.warning ?? "Export Excel"}
      >
        <i
          className={`fa ${exportBusy ? "fa-spinner fa-spin" : "fa-file-excel"} me-1`}
        />
        Export Excel
      </button>

      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={onCancelPreview}
        title={canCancel ? "Cancel preview" : "No preview running"}
        disabled={!canCancel}
      >
        Cancel
      </button>

      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={() => onRun()}
        disabled={!canRun || loading}
        title={runTitle}
      >
        <i
          className={`fa ${loading ? "fa-spinner fa-spin" : "fa-bolt"} me-1`}
        />
        {loading && executionTimer
          ? `Running… ${executionTimer}`
          : loading
            ? "Running…"
            : "Run Preview"}
      </button>
      {!loading && previewStatus === "CANCELED" ? (
        <span className="text-muted small">Canceled</span>
      ) : null}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes ncq-skel-focus {
          0% { filter: blur(7px); opacity: 0.35; transform: scaleX(0.99); }
          70% { filter: blur(5px); opacity: 0.5; transform: scaleX(0.995); }
          85% { filter: blur(3px); opacity: 0.65; transform: scaleX(1); }
          100% { filter: blur(7px); opacity: 0.35; transform: scaleX(0.99); }
        }
        .ncq-skeleton-word {
          animation: ncq-skel-focus 30s ease-in-out infinite;
          will-change: filter, opacity, transform;
        }
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
        title={title}
        subtitle={subtitle}
        iconClass="fa-eye"
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        onHide={onHide}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        right={right}
        count={effectiveCount}
        helpAction={helpAction}
      >
        <div
          className="ncq-preview-wrap ncq-preview-content"
          style={
            {
              ["--ncqH" as any]: `${Math.max(420, isFullscreen ? window.innerHeight - 120 : heightPx)}px`,
            } as React.CSSProperties
          }
        >
          <div className="ncq-toprow d-flex align-items-center justify-content-between">
            <small className="text-muted">
              Preview shows a sample. Export generates a full extract.
            </small>

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

          {error ? (
            <div className="alert alert-danger py-2 mb-0">{error}</div>
          ) : null}

          {!canRun ? (
            <div className="border rounded p-3 bg-light">
              <div className="text-muted" style={{ fontSize: 13 }}>
                Select a domain and at least one column (or enable
                aggregations), then click <b>Run Preview</b>.
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
                        <span
                          className="badge bg-primary text-white"
                          style={{ fontSize: 13, padding: "6px 10px" }}
                        >
                          Total:{" "}
                          {totalRowCount != null ? totalRowCount : rows.length}
                        </span>
                        <span
                          className="badge bg-light text-secondary"
                          style={{ fontSize: 13, padding: "6px 10px" }}
                        >
                          Rows shown: {rows.length}
                        </span>
                        {elapsedLabel ? (
                          <span
                            className="badge bg-warning text-dark"
                            style={{ fontSize: 13, padding: "6px 10px" }}
                          >
                            {loading ? "Running…" : "Last run"} {elapsedLabel}
                          </span>
                        ) : null}
                      </div>
                      {exportState.warning ? (
                        <div className="text-warning small mt-1">
                          {exportState.warning}
                        </div>
                      ) : null}
                    </div>

                    <ResultSummary
                      key={summaryKey}
                      summary={resultSummary}
                      isLoading={isSummaryLoading}
                      isError={isSummaryError}
                      isVisible={summaryEnabled && rows.length > 0}
                      onRetry={retrySummary}
                    />

                    {showAnalysis && rows.length > 0 && (
                      <QueryAnalysisPanel
                        queryId={queryId ?? undefined}
                        workspaceId={workspaceId ?? undefined}
                        results={rows as any}
                        rowCount={totalRowCount ?? rows.length}
                        queryName={exportBaseName ?? "Draft Query"}
                        onClose={() => setShowAnalysis(false)}
                      />
                    )}

                    <div
                      className="ncq-table-wrap"
                      style={{ position: "relative" }}
                    >
                      {showInitial ? (
                        <div style={{ height: 220 }} />
                      ) : (
                        (() => {
                          const headerCols = showSkeleton
                            ? skeletonColumns
                            : columns;
                          return (
                            <table className="table table-sm table-hover mb-0 align-middle">
                              <thead className="table-light">
                                <tr>
                                  {headerCols.map((c, idx) => (
                                    <th
                                      key={c.key}
                                      style={{ whiteSpace: "nowrap" }}
                                    >
                                      {showSkeleton ? (
                                        <SkeletonWord
                                          text={
                                            skeletonWords[
                                              idx % skeletonWords.length
                                            ]
                                          }
                                          widthPct={60 - (idx % 3) * 10}
                                          delayMs={-idx * 4200}
                                        />
                                      ) : (
                                        (c.label ?? c.key)
                                      )}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {showSkeleton ? (
                                  Array.from({ length: skeletonRows }).map(
                                    (_, rowIdx) => (
                                      <tr key={`sk-row-${rowIdx}`}>
                                        {headerCols.map((c, colIdx) => (
                                          <td
                                            key={`${c.key}-r${rowIdx}-c${colIdx}`}
                                            style={{ maxWidth: 320 }}
                                          >
                                            <SkeletonWord
                                              text={
                                                skeletonWords[
                                                  (rowIdx + colIdx) %
                                                    skeletonWords.length
                                                ]
                                              }
                                              widthPct={80 - (colIdx % 4) * 10}
                                              delayMs={
                                                -(rowIdx * 900 + colIdx * 350)
                                              }
                                            />
                                          </td>
                                        ))}
                                      </tr>
                                    ),
                                  )
                                ) : rows.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={Math.max(
                                        1,
                                        columns.length || skeletonCols,
                                      )}
                                      className="text-muted text-center py-4"
                                    >
                                      No rows returned.
                                    </td>
                                  </tr>
                                ) : (
                                  rows.map((r, i) => (
                                    <tr key={i}>
                                      {columns.map((c) => (
                                        <td
                                          key={c.key}
                                          style={{ maxWidth: 320 }}
                                        >
                                          <span title={formatCell(r?.[c.key])}>
                                            {formatCell(r?.[c.key])}
                                          </span>
                                        </td>
                                      ))}
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          );
                        })()
                      )}
                      {showSkeleton ? (
                        <div
                          className="ncq-skel-overlay"
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            pointerEvents: "none",
                          }}
                        >
                          <i
                            className="fa fa-spinner fa-spin"
                            style={{ fontSize: 72, color: "rgba(0,0,0,0.15)" }}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="ncq-pagehint">
                      Showing up to {limit} rows.
                    </div>
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
                          <i
                            className={`fa ${copied ? "fa-check" : "fa-copy"}`}
                          />
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

                    <div className="ncq-sqlbox">
                      {sqlText ?? "-- Run preview to see SQL --"}
                    </div>
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
