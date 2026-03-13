import { useMemo } from "react";
import type { ForgeMatchAnalyzeStatusResponse } from "../types";

const PHASE_STEPS = [
  "queued",
  "analyzing",
  "skipping_existing",
  "ranking",
  "analyzed",
] as const;

type Props = {
  isAnalyzing: boolean;
  runStatus: ForgeMatchAnalyzeStatusResponse | null;
  activeJobId: string | null;
  runStatusUpdatedAt: number | null;
  isPolling: boolean;
  isCanceling: boolean;
  onCancel: () => Promise<void>;
};

function statusBadgeClass(status: ForgeMatchAnalyzeStatusResponse["status"]): string {
  if (status === "analyzed") return "bg-success-subtle text-success-emphasis";
  if (status === "failed") return "bg-danger-subtle text-danger-emphasis";
  if (status === "canceled") return "bg-secondary-subtle text-secondary-emphasis";
  if (status === "queued") return "bg-info-subtle text-info-emphasis";
  return "bg-warning-subtle text-warning-emphasis";
}

function formatPhase(phase: string | null | undefined): string {
  const normalized = String(phase ?? "").trim();
  if (!normalized) return "Awaiting phase";
  return normalized
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function deriveProgress(status: ForgeMatchAnalyzeStatusResponse | null): number {
  if (!status) return 0;
  if (status.progress_pct != null && Number.isFinite(status.progress_pct)) {
    return Math.max(0, Math.min(100, Number(status.progress_pct)));
  }

  const total = Number(status.source_total ?? 0);
  if (total <= 0) return 0;
  const done =
    Number(status.source_done ?? 0) +
    Number(status.source_skipped ?? 0) +
    Number(status.source_failed ?? 0);
  return Math.max(0, Math.min(100, (done / total) * 100));
}

function stepStateFromPhase(status: ForgeMatchAnalyzeStatusResponse | null, phaseName: string): "done" | "active" | "pending" {
  if (!status) return phaseName === "queued" ? "active" : "pending";
  const runStatus = status.status;
  if (runStatus === "analyzed") return "done";
  if (runStatus === "failed" || runStatus === "canceled") return phaseName === "analyzed" ? "pending" : "done";
  const currentPhase = String(status.current_phase ?? runStatus).trim().toLowerCase();
  const currentIndex = PHASE_STEPS.indexOf(currentPhase as (typeof PHASE_STEPS)[number]);
  const phaseIndex = PHASE_STEPS.indexOf(phaseName as (typeof PHASE_STEPS)[number]);

  if (currentIndex === -1) {
    return phaseName === "analyzing" ? "active" : phaseName === "queued" ? "done" : "pending";
  }
  if (phaseIndex < currentIndex) return "done";
  if (phaseIndex === currentIndex) return "active";
  return "pending";
}

export default function ForgeMatchAnalysisOverlay({
  isAnalyzing,
  runStatus,
  activeJobId,
  runStatusUpdatedAt,
  isPolling,
  isCanceling,
  onCancel,
}: Props) {
  const status = runStatus?.status ?? (isAnalyzing ? "analyzing" : null);
  const canCancel = status === "queued" || status === "analyzing";

  const message = useMemo(() => {
    const phase = runStatus?.current_phase?.trim();
    if (phase) return phase;
    if (activeJobId) return "Waiting for status update";
    if (isAnalyzing) return "Starting analysis run";
    return "Ready";
  }, [activeJobId, isAnalyzing, runStatus?.current_phase]);

  const safeProgress = deriveProgress(runStatus);
  const updatedAtLabel = runStatusUpdatedAt ? new Date(runStatusUpdatedAt).toLocaleTimeString() : "--";
  const failedCount = Number(runStatus?.source_failed ?? 0);
  const skippedCount = Number(runStatus?.source_skipped ?? 0);

  if (!isAnalyzing && !runStatus) return null;

  return (
    <section className="fm-analysis-overlay" aria-live="polite" aria-label="ForgeMatch analysis in progress">
      <div className="fm-analysis-panel">
        <div className="fm-analysis-header fm-analysis-header-wrap">
          <div className={`fm-analysis-orb ${isPolling ? "is-polling" : "is-idle"}`} aria-hidden="true" />
          <div>
            <h3>Forging semantic matches</h3>
            <p>{message}</p>
            {activeJobId ? <small className="text-muted">Run: {activeJobId}</small> : null}
          </div>
          {status ? (
            <span className={`badge rounded-pill ${statusBadgeClass(status)}`}>{status}</span>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              disabled={isCanceling}
              onClick={() => void onCancel()}
            >
              {isCanceling ? "Canceling..." : "Cancel"}
            </button>
          ) : null}
        </div>

        <div className="fm-analysis-metrics text-muted small mt-1">
          <span className="fm-analysis-metric-chip">
            Done {runStatus?.source_done ?? 0} / {runStatus?.source_total ?? 0}
          </span>
          <span className="fm-analysis-metric-chip">Failed {failedCount}</span>
          <span className="fm-analysis-metric-chip">Skipped {skippedCount}</span>
          <span className={`fm-analysis-metric-chip fm-analysis-live-chip ${isPolling ? "is-polling" : "is-idle"}`}>
            <span className="fm-analysis-live-dot" aria-hidden="true" />
            Live status
          </span>
          <span className="fm-analysis-metric-chip fm-analysis-updated-chip">Updated {updatedAtLabel}</span>
          {status === "canceled" ? <span className="fm-analysis-metric-chip">Run canceled</span> : null}
          {status === "analyzed" ? <span className="fm-analysis-metric-chip">Analysis complete</span> : null}
          {status === "failed" && runStatus?.analysis_error ? (
            <span className="fm-analysis-metric-chip fm-analysis-error-chip">{runStatus.analysis_error}</span>
          ) : null}
          <span className="fm-analysis-metric-chip fm-analysis-progress-chip">{Math.round(safeProgress)}%</span>
        </div>

        <div
          className="fm-analysis-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeProgress}
        >
          <div className="fm-analysis-progress-fill" style={{ width: `${safeProgress}%` }} />
        </div>

        <ul className="fm-analysis-stage-list fm-analysis-stage-cards" aria-label="Analysis phase state">
          {PHASE_STEPS.map((step) => {
            const state = stepStateFromPhase(runStatus, step);
            return (
              <li key={step} className={`fm-stage-card fm-stage-${state}`}>
                <span>{formatPhase(step)}</span>
                <small>{state === "done" ? "Done" : state === "active" ? "In progress" : "Pending"}</small>
              </li>
            );
          })}
          {runStatus?.current_source_row_id ? (
            <li className="fm-stage-card fm-stage-active">
              <span>Current Source Row</span>
              <small>{runStatus.current_source_row_id}</small>
            </li>
          ) : null}
          {status === "failed" && runStatus?.analysis_error ? (
            <li className="fm-stage-card fm-stage-failed">
              <span>Failure Reason</span>
              <small>{runStatus.analysis_error}</small>
            </li>
          ) : null}
          {!runStatus ? (
            <li className="fm-stage-card fm-stage-pending">
              <span>Status Feed</span>
              <small>Waiting for first backend status payload</small>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
