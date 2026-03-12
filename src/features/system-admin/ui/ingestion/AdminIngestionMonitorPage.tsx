import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  cancelIngestionRun,
  getIngestionDiagnostics,
  getIngestionHistory,
  getIngestionStatus,
  type IngestionDiagnostics,
  type IngestionRun,
} from "@/shared/services/ingestion";
import "../systemAdmin.css";

const POLL_INTERVAL_MS = 5_000;
const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled", "cancelled"]);

function resolveJobId(run: Partial<IngestionRun> | null | undefined): string {
  if (!run) return "";
  const id = (run as any).id ?? (run as any).job_id ?? "";
  return String(id ?? "").trim();
}

function isTerminalStatus(status: string | null | undefined): boolean {
  return TERMINAL_STATUSES.has(String(status ?? "").toLowerCase());
}

function toErrorMessage(error: unknown, fallback: string): string {
  const maybeError = error as any;
  const responseData = maybeError?.response?.data;

  const messageFromResponse =
    responseData?.message ??
    responseData?.error ??
    responseData?.detail ??
    null;
  if (typeof messageFromResponse === "string" && messageFromResponse.trim().length > 0) {
    return messageFromResponse.trim();
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallback;
}

function isTerminalCancelMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already") &&
    (normalized.includes("terminal") ||
      normalized.includes("completed") ||
      normalized.includes("failed") ||
      normalized.includes("canceled") ||
      normalized.includes("cancelled"))
  );
}

function statusBadgeClass(status: string | null | undefined): string {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "running") return "badge text-bg-primary";
  if (normalized === "completed") return "badge text-bg-success";
  if (normalized === "failed" || normalized === "canceled" || normalized === "cancelled") {
    return "badge text-bg-danger";
  }
  return "badge text-bg-secondary";
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function progressPercent(done: number, total: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return 0;
  const pct = Math.round((done / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function queueLabel(value: IngestionDiagnostics["in_worker_queues"]): string {
  if (!Array.isArray(value) || value.length === 0) return "none";
  return value.join(", ");
}

export default function AdminIngestionMonitorPage() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [autoPoll, setAutoPoll] = useState(true);
  const [cancelTargetJobId, setCancelTargetJobId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const historyQuery = useQuery<IngestionRun[], Error>({
    queryKey: ["ingestion", "history", "admin-monitor"],
    queryFn: getIngestionHistory,
    refetchInterval: (query) => {
      if (!autoPoll) return false;
      const rows = query.state.data ?? [];
      const hasActiveRun = rows.some((run) => !isTerminalStatus(run.status));
      return hasActiveRun ? POLL_INTERVAL_MS : false;
    },
  });

  const historyRows = historyQuery.data ?? [];

  useEffect(() => {
    if (selectedJobId) return;
    const firstJobId = resolveJobId(historyRows[0]);
    if (firstJobId) {
      setSelectedJobId(firstJobId);
    }
  }, [historyRows, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    const stillPresent = historyRows.some((run) => resolveJobId(run) === selectedJobId);
    if (stillPresent) return;
    const firstJobId = resolveJobId(historyRows[0]);
    setSelectedJobId(firstJobId || null);
  }, [historyRows, selectedJobId]);

  const selectedRun = useMemo(
    () => historyRows.find((run) => resolveJobId(run) === selectedJobId) ?? null,
    [historyRows, selectedJobId]
  );

  const statusQuery = useQuery<IngestionRun, Error>({
    queryKey: ["ingestion", "status", selectedJobId],
    queryFn: () => getIngestionStatus(selectedJobId!),
    enabled: Boolean(selectedJobId),
    refetchInterval: (query) => {
      if (!autoPoll) return false;
      const status = query.state.data?.status ?? selectedRun?.status ?? null;
      return isTerminalStatus(status) ? false : POLL_INTERVAL_MS;
    },
  });

  const diagnosticsQuery = useQuery<IngestionDiagnostics, Error>({
    queryKey: ["ingestion", "diagnostics", selectedJobId],
    queryFn: () => getIngestionDiagnostics(selectedJobId!),
    enabled: Boolean(selectedJobId),
    refetchInterval: (query) => {
      if (!autoPoll) return false;
      const status = statusQuery.data?.status ?? selectedRun?.status ?? null;
      if (isTerminalStatus(status)) return false;
      if (query.state.status === "error" && !status) return false;
      return POLL_INTERVAL_MS;
    },
  });

  const selectedStatus = statusQuery.data?.status ?? selectedRun?.status ?? null;
  const canCancel = Boolean(selectedJobId) && !isTerminalStatus(selectedStatus);

  async function refreshAll(): Promise<void> {
    await historyQuery.refetch();
    if (selectedJobId) {
      await statusQuery.refetch();
      await diagnosticsQuery.refetch();
    }
  }

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => cancelIngestionRun(jobId),
    onSuccess: async (response) => {
      const message = response?.message?.trim();
      if (response?.canceled === false) {
        toast.info(message || "Run is already in a terminal state.");
      } else {
        toast.success(message || "Cancel request submitted.");
      }
      setActionError(null);
      setCancelTargetJobId(null);
      await refreshAll();
    },
    onError: async (error) => {
      const message = toErrorMessage(error, "Unable to cancel ingestion run.");
      if (isTerminalCancelMessage(message)) {
        toast.info(message);
        setActionError(null);
      } else {
        setActionError(message);
      }
      setCancelTargetJobId(null);
      await refreshAll();
    },
  });

  const statusData = statusQuery.data ?? selectedRun;
  const tablesDone = toNumber(statusData?.tables_done);
  const tablesTotal = toNumber(statusData?.tables_total);
  const columnsDone = toNumber(statusData?.columns_done);
  const columnsTotal = toNumber(statusData?.columns_total);
  const tablePct = progressPercent(tablesDone, tablesTotal);
  const columnPct = progressPercent(columnsDone, columnsTotal);

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h1>Ingestion Monitor</h1>
          <p className="sa-page-subtitle">Inspect run state, worker diagnostics, and cancel active ingestion jobs.</p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <label className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={autoPoll}
              onChange={(event) => setAutoPoll(event.target.checked)}
              aria-label="Auto poll"
            />
            <span className="form-check-label">Auto-poll (5s)</span>
          </label>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => {
              setActionError(null);
              void refreshAll();
            }}
            disabled={historyQuery.isFetching || statusQuery.isFetching || diagnosticsQuery.isFetching}
          >
            <i className="fa fa-refresh" /> Refresh
          </button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="sa-card h-100">
            <div className="sa-card-header">
              <h2 className="sa-card-title">Runs</h2>
              <span className="text-muted small">{historyRows.length} total</span>
            </div>

            {historyQuery.isError && (
              <div className="alert alert-danger py-2 mb-2" role="alert">
                {toErrorMessage(historyQuery.error, "Unable to load ingestion history.")}
              </div>
            )}

            <div className="sa-table-wrap mb-0 sa-ingestion-run-list">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((run) => {
                    const jobId = resolveJobId(run);
                    const selected = jobId === selectedJobId;
                    return (
                      <tr
                        key={jobId}
                        className={`sa-run-row ${selected ? "is-selected" : ""}`}
                        onClick={() => {
                          setSelectedJobId(jobId);
                          setActionError(null);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <div className="fw-semibold">{jobId || "—"}</div>
                          <small className="text-muted">{run.datasource} / {run.schema_name}</small>
                        </td>
                        <td>
                          <span className={statusBadgeClass(run.status)}>{run.status || "unknown"}</span>
                        </td>
                        <td>{formatTimestamp(run.started_at)}</td>
                      </tr>
                    );
                  })}
                  {!historyQuery.isFetching && historyRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        No ingestion runs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="sa-card h-100">
            <div className="sa-card-header">
              <h2 className="sa-card-title">Run Details</h2>
              {statusData && (
                <div className="d-flex align-items-center gap-2">
                  <span className={statusBadgeClass(selectedStatus)}>{selectedStatus || "unknown"}</span>
                  {diagnosticsQuery.data?.stale_candidate && (
                    <span className="badge text-bg-warning">stale candidate</span>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setCancelTargetJobId(selectedJobId)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel Run
                    </button>
                  )}
                </div>
              )}
            </div>

            {!selectedJobId && (
              <div className="text-muted">Select a run from the left to inspect status and diagnostics.</div>
            )}

            {selectedJobId && (
              <div className="d-flex flex-column gap-3">
                {actionError && (
                  <div className="alert alert-danger py-2 mb-0" role="alert">
                    {actionError}
                  </div>
                )}

                {statusQuery.isError && (
                  <div className="alert alert-danger py-2 mb-0" role="alert">
                    {toErrorMessage(statusQuery.error, "Unable to load run status.")}
                  </div>
                )}

                {statusData && (
                  <div className="sa-drawer-form-card">
                    <h3 className="sa-drawer-form-card-title">Status Summary</h3>
                    <div className="row g-2">
                      <div className="col-md-6">
                        <div className="small text-muted">Status</div>
                        <div className="fw-semibold">{selectedStatus || "unknown"}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-muted">Phase</div>
                        <div className="fw-semibold">{statusData.current_phase ?? "—"}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-muted">Started</div>
                        <div>{formatTimestamp(statusData.started_at)}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-muted">Completed</div>
                        <div>{formatTimestamp(statusData.completed_at)}</div>
                      </div>
                      <div className="col-12">
                        <div className="small text-muted">Error</div>
                        <div>{statusData.error ?? "—"}</div>
                      </div>
                    </div>
                  </div>
                )}

                {statusData && (
                  <div className="sa-drawer-form-card">
                    <h3 className="sa-drawer-form-card-title">Progress</h3>

                    <div className="small text-muted mb-1">Tables ({tablesDone}/{tablesTotal || 0})</div>
                    <div className="progress mb-2" role="progressbar" aria-valuenow={tablePct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="progress-bar" style={{ width: `${tablePct}%` }}>
                        {tablePct}%
                      </div>
                    </div>

                    <div className="small text-muted mb-1">Columns ({columnsDone}/{columnsTotal || 0})</div>
                    <div className="progress" role="progressbar" aria-valuenow={columnPct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="progress-bar bg-info" style={{ width: `${columnPct}%` }}>
                        {columnPct}%
                      </div>
                    </div>
                  </div>
                )}

                <div className="sa-drawer-form-card">
                  <h3 className="sa-drawer-form-card-title">Diagnostics</h3>
                  {diagnosticsQuery.isLoading && (
                    <div className="d-flex align-items-center gap-2 text-muted">
                      <span className="sa-spinner" /> Loading diagnostics…
                    </div>
                  )}
                  {diagnosticsQuery.isError && (
                    <div className="alert alert-warning py-2 mb-0" role="alert">
                      {toErrorMessage(diagnosticsQuery.error, "Diagnostics are currently unavailable.")}
                    </div>
                  )}
                  {diagnosticsQuery.data && (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <tbody>
                          <tr>
                            <th scope="row" style={{ width: "40%" }}>celery_state</th>
                            <td>{diagnosticsQuery.data.celery_state ?? "—"}</td>
                          </tr>
                          <tr>
                            <th scope="row">in_worker_queues</th>
                            <td>{queueLabel(diagnosticsQuery.data.in_worker_queues)}</td>
                          </tr>
                          <tr>
                            <th scope="row">age_seconds</th>
                            <td>{diagnosticsQuery.data.age_seconds ?? "—"}</td>
                          </tr>
                          <tr>
                            <th scope="row">stale_candidate</th>
                            <td>
                              {diagnosticsQuery.data.stale_candidate ? (
                                <span className="badge text-bg-warning">true</span>
                              ) : (
                                <span className="badge text-bg-secondary">false</span>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th scope="row">stale_threshold_seconds</th>
                            <td>{diagnosticsQuery.data.stale_threshold_seconds ?? "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {cancelTargetJobId && (
        <div className="sa-dialog-backdrop" onClick={() => setCancelTargetJobId(null)}>
          <div className="sa-dialog" role="dialog" aria-label="Cancel ingestion run" onClick={(event) => event.stopPropagation()}>
            <div className="sa-dialog-header">Cancel Ingestion Run</div>
            <div className="sa-dialog-body">
              <p className="mb-0">
                Cancel run <strong>{cancelTargetJobId}</strong>? This will request cancellation from the worker.
              </p>
            </div>
            <div className="sa-dialog-footer">
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => setCancelTargetJobId(null)}
                disabled={cancelMutation.isPending}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => cancelMutation.mutate(cancelTargetJobId)}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Run"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
