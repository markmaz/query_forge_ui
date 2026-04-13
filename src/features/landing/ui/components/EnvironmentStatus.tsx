// src/features/query-forge/ui/components/home/EnvironmentStatus.tsx
import React from "react";

export type EnvironmentStatusProps = {
  warehouseName?: string | null;
  connected?: boolean;
  domainsCount?: number | null;
  lastMetadataRefreshIso?: string | null;
  onRefreshMetadata?: () => void;
};

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

const EnvironmentStatus: React.FC<EnvironmentStatusProps> = ({
  warehouseName,
  connected,
  domainsCount,
  lastMetadataRefreshIso,
  onRefreshMetadata,
}) => {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-header bg-body d-flex align-items-center justify-content-between">
        <div className="fw-semibold">Data environment</div>
        {onRefreshMetadata ? (
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={onRefreshMetadata}>
            Refresh
          </button>
        ) : null}
      </div>

      <div className="card-body">
        <div className="d-flex flex-column gap-2">
          <div className="d-flex justify-content-between">
            <div className="text-muted">Warehouse</div>
            <div className="fw-semibold">{warehouseName ?? "—"}</div>
          </div>

          <div className="d-flex justify-content-between">
            <div className="text-muted">Connection</div>
            <div className={connected ? "text-success fw-semibold" : "text-danger fw-semibold"}>
              {connected ? "Connected" : "Disconnected"}
            </div>
          </div>

          <div className="d-flex justify-content-between">
            <div className="text-muted">Domains</div>
            <div className="fw-semibold">{typeof domainsCount === "number" ? domainsCount : "—"}</div>
          </div>

          <div className="d-flex justify-content-between">
            <div className="text-muted">Last metadata refresh</div>
            <div className="fw-semibold">{fmtTime(lastMetadataRefreshIso)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentStatus;
