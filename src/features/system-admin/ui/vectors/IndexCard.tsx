import { useState } from "react";
import type { IndexStatus } from "@/features/system-admin/types";

interface IndexCardProps {
  title: string;
  description: string;
  status: IndexStatus;
  result?: Record<string, unknown>;
  error?: string;
  onRebuild: () => void;
  disabled: boolean;
}

const statusConfig: Record<
  IndexStatus,
  { icon: string; className: string; label: string }
> = {
  idle: { icon: "fa-circle", className: "", label: "Idle" },
  building: { icon: "", className: "building", label: "Building…" },
  completed: { icon: "fa-check-circle", className: "ok", label: "Completed" },
  error: { icon: "fa-times-circle", className: "error", label: "Error" },
};

export default function IndexCard({
  title,
  description,
  status,
  result,
  error,
  onRebuild,
  disabled,
}: IndexCardProps) {
  const [errorOpen, setErrorOpen] = useState(false);
  const cfg = statusConfig[status];

  return (
    <div className="sa-card">
      <div className="sa-card-header">
        <h3 className="sa-card-title">{title}</h3>
        <span className={`sa-card-status ${cfg.className}`}>
          {status === "building" ? (
            <span className="sa-spinner" />
          ) : (
            <i className={`fa ${cfg.icon}`} />
          )}
          {cfg.label}
        </span>
      </div>

      <div className="sa-card-body">
        <p style={{ margin: "0 0 10px", color: "#6b7280", fontSize: "0.85rem" }}>
          {description}
        </p>

        {result && (
          <div>
            {Object.entries(result).map(([key, value]) => (
              <div className="sa-card-metric" key={key}>
                <span className="sa-card-metric-label">{key}</span>
                <span className="sa-card-metric-value">{String(value)}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <>
            <button
              className="sa-collapsible-toggle"
              onClick={() => setErrorOpen((o) => !o)}
            >
              <i className={`fa fa-chevron-${errorOpen ? "up" : "down"}`} />{" "}
              {errorOpen ? "Hide error" : "Show error"}
            </button>
            {errorOpen && <div className="sa-card-error">{error}</div>}
          </>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          className="btn btn-sm btn-outline-primary"
          disabled={disabled || status === "building"}
          onClick={onRebuild}
        >
          <i className="fa fa-refresh" /> Rebuild
        </button>
      </div>
    </div>
  );
}
