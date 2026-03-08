import React, { useCallback, useEffect, useRef, useState } from "react";
import { getStatus, startInstance, stopInstance } from "../../shared/services/dataEnvironmentApi";
import type { LlmState, LlmStatusResponse } from "./types";
import type { EnvironmentStatusProps } from "../landing/ui/components/EnvironmentStatus";
import "./DataEnvironmentPanel.css";

const TRANSITION_POLL_MS = 5_000;
const STEADY_POLL_MS = 20_000;

function pollingDelayForState(state: LlmState): number {
  return state === "starting" || state === "stopping" ? TRANSITION_POLL_MS : STEADY_POLL_MS;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load Data Environment status.";
}

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatUptime(launchTime?: string): string | null {
  if (!launchTime) return null;
  const start = new Date(launchTime).getTime();
  if (Number.isNaN(start)) return null;

  const deltaMs = Date.now() - start;
  if (deltaMs < 0) return null;

  const totalMinutes = Math.floor(deltaMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function StatusBadge({ state }: { state: LlmState }) {
  const commonClass = "badge";
  if (state === "stopped") return <span className={`${commonClass} text-bg-secondary`}>Stopped</span>;
  if (state === "starting") return <span className={`${commonClass} text-bg-warning text-dark`}>Starting</span>;
  if (state === "running") return <span className={`${commonClass} text-bg-success`}>Running</span>;
  if (state === "stopping") {
    return (
      <span className={commonClass} style={{ backgroundColor: "#fd7e14", color: "#fff" }}>
        Stopping
      </span>
    );
  }
  return <span className={`${commonClass} text-bg-danger`}>Failed</span>;
}

export const DataEnvironmentPanel: React.FC<EnvironmentStatusProps> = ({
  warehouseName,
  connected,
  domainsCount,
  lastMetadataRefreshIso,
  onRefreshMetadata,
  canManageLlm = true,
}) => {
  const [status, setStatus] = useState<LlmStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const clearPollTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await getStatus();
      if (!mountedRef.current) return;
      setStatus(next);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus((prev) => ({
        state: "error",
        instanceId: prev?.instanceId ?? "—",
        publicIp: prev?.publicIp,
        launchTime: prev?.launchTime,
      }));
      setError(toErrorMessage(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refreshStatus();

    return () => {
      mountedRef.current = false;
      clearPollTimer();
    };
  }, [refreshStatus, clearPollTimer]);

  useEffect(() => {
    if (!status) return;
    clearPollTimer();
    timerRef.current = window.setTimeout(() => {
      void refreshStatus();
    }, pollingDelayForState(status.state));

    return clearPollTimer;
  }, [status?.state, refreshStatus, clearPollTimer, status]);

  const isTransitioning = status?.state === "starting" || status?.state === "stopping";
  const startDisabled = loading || actionPending || isTransitioning || status?.state === "running";
  const stopDisabled = loading || actionPending || isTransitioning || status?.state !== "running";

  const onStart = useCallback(async () => {
    if (startDisabled) return;
    const previous = status;

    setActionPending(true);
    setError(null);
    setStatus((curr) => (curr ? { ...curr, state: "starting" } : { state: "starting", instanceId: "—" }));

    try {
      await startInstance();
      await refreshStatus();
    } catch (err) {
      if (mountedRef.current) {
        setStatus({
          state: "error",
          instanceId: previous?.instanceId ?? "—",
          publicIp: previous?.publicIp,
          launchTime: previous?.launchTime,
        });
        setError(toErrorMessage(err));
      }
    } finally {
      if (mountedRef.current) setActionPending(false);
    }
  }, [status, startDisabled, refreshStatus]);

  const onStop = useCallback(async () => {
    if (stopDisabled || !status) return;
    const previous = status;

    setActionPending(true);
    setError(null);
    setStatus({ ...status, state: "stopping" });

    try {
      await stopInstance();
      await refreshStatus();
    } catch (err) {
      if (mountedRef.current) {
        setStatus({
          state: "error",
          instanceId: previous?.instanceId ?? "—",
          publicIp: previous?.publicIp,
          launchTime: previous?.launchTime,
        });
        setError(toErrorMessage(err));
      }
    } finally {
      if (mountedRef.current) setActionPending(false);
    }
  }, [status, stopDisabled, refreshStatus]);

  const uptime = formatUptime(status?.launchTime);

  return (
    <div className="card shadow-sm h-100">
      <div className="card-header bg-body d-flex align-items-center justify-content-between">
        <div className="fw-semibold">Data Environment</div>
        {onRefreshMetadata ? (
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={onRefreshMetadata}>
            Refresh
          </button>
        ) : null}
      </div>

      <div className="card-body">
        <div className="de-section">
          <div className="de-row">
            <div className="text-muted">Warehouse</div>
            <div className="fw-semibold de-value">{warehouseName ?? "—"}</div>
          </div>

          <div className="de-row">
            <div className="text-muted">Connection</div>
            <div className={`${connected ? "text-success" : "text-danger"} fw-semibold de-value`}>
              {connected ? "Connected" : "Disconnected"}
            </div>
          </div>

          <div className="de-row">
            <div className="text-muted">Domains</div>
            <div className="fw-semibold de-value">{typeof domainsCount === "number" ? domainsCount : "—"}</div>
          </div>

          <div className="de-row">
            <div className="text-muted">Last metadata refresh</div>
            <div className="fw-semibold de-value">{fmtTime(lastMetadataRefreshIso)}</div>
          </div>
        </div>

        <hr className="my-3" />

        <div className="de-section">
          <div className="fw-semibold">LLM Instance</div>

          <div className="de-row">
            <span className="text-muted">Status</span>
            <span className="d-inline-flex align-items-center gap-2 de-value">
              {status ? <StatusBadge state={status.state} /> : <span className="badge text-bg-secondary">Checking</span>}
              {isTransitioning ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : null}
            </span>
          </div>

          {status?.state === "running" ? (
            <div className="de-row">
              <span className="text-muted">Public IP</span>
              <span className="fw-semibold de-value">{status.publicIp || "—"}</span>
            </div>
          ) : null}

          {uptime ? (
            <div className="de-row">
              <span className="text-muted">Uptime</span>
              <span className="fw-semibold de-value">{uptime}</span>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
            {error}
          </div>
        ) : null}

        {canManageLlm ? (
          <div className="mt-3 d-flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void onStart()} disabled={startDisabled}>
              Start
            </button>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void onStop()} disabled={stopDisabled}>
              Stop
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DataEnvironmentPanel;
