import type { BrokerCheck } from "@/features/system-admin/types";

interface BrokerCardProps {
  check: BrokerCheck;
}

function boolLabel(value: boolean): string {
  return value ? "OK" : "Error";
}

export default function BrokerCard({ check }: BrokerCardProps) {
  const isOk = check.status === "ok";
  const workerList = check.celery.workers.length > 0 ? check.celery.workers.join(", ") : "none";

  return (
    <div className="sa-card">
      <div className="sa-card-header">
        <h3 className="sa-card-title">
          <i className="fa fa-network-wired" style={{ marginRight: 8 }} />
          Celery Broker
        </h3>
        <span className={`sa-card-status ${check.status}`}>
          <i className={`fa ${isOk ? "fa-check-circle" : "fa-times-circle"}`} />
          {isOk ? "OK" : "Error"}
        </span>
      </div>

      <div className="sa-card-body">
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Broker URL</span>
          <span className="sa-card-metric-value sa-card-metric-value-break">{check.broker_url || "-"}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Broker Connect</span>
          <span className="sa-card-metric-value">{boolLabel(check.celery.broker_connect_ok)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Worker Ping</span>
          <span className="sa-card-metric-value">{boolLabel(check.celery.worker_ping_ok)}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Workers</span>
          <span className="sa-card-metric-value sa-card-metric-value-break">{workerList}</span>
        </div>

        {(check.celery.broker_error || check.celery.worker_error) ? (
          <div className="sa-card-error">
            {check.celery.broker_error ? <div>Celery broker error: {check.celery.broker_error}</div> : null}
            {check.celery.worker_error ? <div>Celery worker error: {check.celery.worker_error}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
