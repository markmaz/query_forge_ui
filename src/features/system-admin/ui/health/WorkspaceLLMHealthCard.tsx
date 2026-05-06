import type { WorkspaceLLMHealthCheck } from "@/features/system-admin/types";

interface WorkspaceLLMHealthCardProps {
  check: WorkspaceLLMHealthCheck;
}

function metricValue(value: number | null | undefined): string {
  return value == null ? "-" : String(value);
}

export default function WorkspaceLLMHealthCard({ check }: WorkspaceLLMHealthCardProps) {
  const isOk = check.status === "ok";
  const isDegraded = check.status === "degraded";
  const label = isOk ? "OK" : isDegraded ? "Degraded" : "Error";
  const iconName = isOk ? "fa-check-circle" : isDegraded ? "fa-exclamation-triangle" : "fa-times-circle";

  return (
    <div className="sa-card">
      <div className="sa-card-header">
        <h3 className="sa-card-title">
          <i className="fa fa-brain" style={{ marginRight: 8 }} />
          Workspace LLMs
        </h3>
        <span className={`sa-card-status ${check.status}`}>
          <i className={`fa ${iconName}`} />
          {label}
        </span>
      </div>

      <div className="sa-card-body">
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Configured</span>
          <span className="sa-card-metric-value">{metricValue(check.total_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Active</span>
          <span className="sa-card-metric-value">{metricValue(check.active_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Healthy</span>
          <span className="sa-card-metric-value">{metricValue(check.healthy_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Failed</span>
          <span className="sa-card-metric-value">{metricValue(check.failed_count)}</span>
        </div>
        {check.latency_ms != null ? (
          <div className="sa-card-metric">
            <span className="sa-card-metric-label">Avg Latency</span>
            <span className="sa-card-metric-value">{check.latency_ms} ms</span>
          </div>
        ) : null}

        {check.issues?.length ? (
          <div className={`sa-card-inset ${check.status === "error" ? "is-error" : "is-warning"}`}>
            {check.issues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </div>
        ) : null}
        {check.error ? <div className="sa-card-error">{check.error}</div> : null}
      </div>
    </div>
  );
}
