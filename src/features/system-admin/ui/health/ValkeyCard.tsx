import type { BrokerCheck } from "@/features/system-admin/types";

interface ValkeyCardProps {
  check: BrokerCheck["valkey"];
}

function boolLabel(value: boolean): string {
  return value ? "OK" : "Error";
}

export default function ValkeyCard({ check }: ValkeyCardProps) {
  const isOk = check.ping_ok;
  const address = [check.address, check.port].filter((value) => value != null && value !== "").join(":");

  return (
    <div className="sa-card">
      <div className="sa-card-header">
        <h3 className="sa-card-title">
          <i className="fa fa-database" style={{ marginRight: 8 }} />
          Valkey
        </h3>
        <span className={`sa-card-status ${isOk ? "ok" : "error"}`}>
          <i className={`fa ${isOk ? "fa-check-circle" : "fa-times-circle"}`} />
          {isOk ? "OK" : "Error"}
        </span>
      </div>

      <div className="sa-card-body">
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Address</span>
          <span className="sa-card-metric-value">{address || "-"}</span>
        </div>
        <div className="sa-card-metric">
          <span className="sa-card-metric-label">Ping</span>
          <span className="sa-card-metric-value">{boolLabel(check.ping_ok)}</span>
        </div>
        {check.ping_response ? (
          <div className="sa-card-metric">
            <span className="sa-card-metric-label">Response</span>
            <span className="sa-card-metric-value sa-card-metric-value-break">{check.ping_response}</span>
          </div>
        ) : null}
        {check.error ? <div className="sa-card-error">Valkey error: {check.error}</div> : null}
      </div>
    </div>
  );
}
