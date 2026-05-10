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
          Workflow Runtime
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

        <div className="sa-card-inset">
          <div className="sa-card-detail-row">
            <span>Pending Notifications</span>
            <strong>{metricValue(check.metrics.pending_notification_count)}</strong>
          </div>
          <div className="sa-card-detail-row">
            <span>Failed Notifications</span>
            <strong>{metricValue(check.metrics.failed_notification_count)}</strong>
          </div>
          <div className="sa-card-detail-row">
            <span>Stuck Runs</span>
            <strong>{metricValue(check.metrics.stuck_run_count)}</strong>
          </div>
          <div className="sa-card-detail-row">
            <span>Failed Runs</span>
            <strong>{metricValue(check.metrics.failed_run_count)}</strong>
          </div>
          <div className="sa-card-detail-row">
            <span>Schedule Backlog</span>
            <strong>{metricValue(check.metrics.schedule_backlog_count)}</strong>
          </div>
          <div className="sa-card-detail-row">
            <span>Failed Imports</span>
            <strong>{metricValue(check.metrics.failed_import_count)}</strong>
          </div>
          <div className="sa-card-detail-row">
            <span>Failed Exports</span>
            <strong>{metricValue(check.metrics.failed_export_count)}</strong>
          </div>
          <div className="sa-card-detail-row">
            <span>Stuck Approvals</span>
            <strong>{metricValue(check.metrics.stuck_approval_count)}</strong>
          </div>
          <div className="sa-card-detail-row">
            <span>Invalid Run-As</span>
            <strong>{metricValue(check.metrics.invalid_production_run_as_count)}</strong>
          </div>
          <div className="sa-card-detail-row">
            <span>Retention Pending</span>
            <strong>{metricValue(check.metrics.artifact_retention_pending_count)}</strong>
          </div>
        </div>

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
