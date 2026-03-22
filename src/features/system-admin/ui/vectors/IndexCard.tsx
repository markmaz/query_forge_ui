import { useMemo, useState } from "react";
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

type MetricEntry = {
  key: string;
  label: string;
  value: string;
};

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function humanizeMetricLabel(path: string[]): string {
  if (path.length === 2 && path[0] === path[1]) {
    return `${path[0].replace(/_/g, " ")} name`;
  }
  return path.join(" ").replace(/_/g, " ");
}

function flattenMetrics(value: unknown, path: string[] = []): MetricEntry[] {
  if (Array.isArray(value)) {
    return [
      {
        key: path.join("."),
        label: humanizeMetricLabel(path),
        value: value.length ? value.map((item) => formatPrimitive(item)).join(", ") : "none",
      },
    ];
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([childKey, childValue]) =>
      flattenMetrics(childValue, [...path, childKey]),
    );
  }

  return [
    {
      key: path.join("."),
      label: humanizeMetricLabel(path),
      value: formatPrimitive(value),
    },
  ];
}

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
  const metrics = useMemo(() => (result ? flattenMetrics(result) : []), [result]);

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

        {metrics.length > 0 && (
          <div>
            {metrics.map((metric) => (
              <div className="sa-card-metric" key={metric.key}>
                <span className="sa-card-metric-label">{metric.label}</span>
                <span className="sa-card-metric-value">{metric.value}</span>
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
