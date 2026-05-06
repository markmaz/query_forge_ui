import type { FlowForgeHealthCheck } from "@/features/system-admin/types";

interface FlowForgeHealthCardProps {
  check: FlowForgeHealthCheck;
}

function metricValue(value: number | null | undefined): string {
  return value == null ? "-" : String(value);
}

export default function FlowForgeHealthCard({ check }: FlowForgeHealthCardProps) {
  const isOk = check.status === "ok";
  const isDegraded = check.status === "degraded";
  const label = isOk ? "OK" : isDegraded ? "Degraded" : "Error";
  const iconName = isOk ? "fa-check-circle" : isDegraded ? "fa-exclamation-triangle" : "fa-times-circle";
  const workerLabel = check.worker.healthy ? "OK" : "Stale";

  return (
    <div className="sa-card">
      <div className="sa-card-header">
        <h3 className="sa-card-title">
          <i className="fa fa-diagram-project" style={{ marginRight: 8 }} />
          FlowForge Runtime
        </h3>
        <span className={`sa-card-status ${check.status}`}>
          <i className={`fa ${iconName}`} />
          {label}
        </span>
      </div>

      <div className="sa-card-body">
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Worker Heartbeat</span>
          <span className="sa-card-metric-value">{workerLabel}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Last Task</span>
          <span className="sa-card-metric-value sa-card-metric-value-break">{check.worker.task_name || "-"}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Pending Notifications</span>
          <span className="sa-card-metric-value">{metricValue(check.metrics.pending_notification_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Failed Notifications</span>
          <span className="sa-card-metric-value">{metricValue(check.metrics.failed_notification_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Stuck Runs</span>
          <span className="sa-card-metric-value">{metricValue(check.metrics.stuck_run_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Failed Runs</span>
          <span className="sa-card-metric-value">{metricValue(check.metrics.failed_run_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Schedule Backlog</span>
          <span className="sa-card-metric-value">{metricValue(check.metrics.schedule_backlog_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Failed Imports</span>
          <span className="sa-card-metric-value">{metricValue(check.metrics.failed_import_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Failed Exports</span>
          <span className="sa-card-metric-value">{metricValue(check.metrics.failed_export_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Stuck Approvals</span>
          <span className="sa-card-metric-value">{metricValue(check.metrics.stuck_approval_count)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Retention Pending</span>
          <span className="sa-card-metric-value">{metricValue(check.metrics.artifact_retention_pending_count)}</span>
        </div>

        {check.issues?.length ? (
          <div className="sa-card-error">
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
