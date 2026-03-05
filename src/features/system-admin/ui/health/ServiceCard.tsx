import { useState } from "react";
import type { ServiceCheck, VllmCheck } from "@/features/system-admin/types";

interface ServiceCardProps {
  name: string;
  check: ServiceCheck | VllmCheck;
  icon: string;
}

function isVllmCheck(check: ServiceCheck | VllmCheck): check is VllmCheck {
  return "model" in check;
}

export default function ServiceCard({ name, check, icon }: ServiceCardProps) {
  const [errorOpen, setErrorOpen] = useState(false);
  const isOk = check.status === "ok";

  return (
    <div className="sa-card">
      <div className="sa-card-header">
        <h3 className="sa-card-title">
          <i className={`fa ${icon}`} style={{ marginRight: 8 }} />
          {name}
        </h3>
        <span className={`sa-card-status ${check.status}`}>
          <i className={`fa ${isOk ? "fa-check-circle" : "fa-times-circle"}`} />
          {isOk ? "OK" : "Error"}
        </span>
      </div>

      <div className="sa-card-body">
        {check.latency_ms != null && (
          <div className="sa-card-metric">
            <span className="sa-card-metric-label">Latency</span>
            <span className="sa-card-metric-value">{check.latency_ms} ms</span>
          </div>
        )}

        {isVllmCheck(check) && check.model && (
          <div className="sa-card-metric">
            <span className="sa-card-metric-label">Model</span>
            <span className="sa-card-metric-value">{check.model}</span>
          </div>
        )}

        {check.error && (
          <>
            <button
              className="sa-collapsible-toggle"
              onClick={() => setErrorOpen((o) => !o)}
            >
              <i className={`fa fa-chevron-${errorOpen ? "up" : "down"}`} />{" "}
              {errorOpen ? "Hide error" : "Show error"}
            </button>
            {errorOpen && (
              <div className="sa-card-error">{check.error}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
