import { useEffect, useState } from "react";
import { useHealthCheck } from "@/features/system-admin/hooks";
import StatusBanner from "./StatusBanner";
import ServiceCard from "./ServiceCard";
import LatencyChart from "./LatencyChart";
import LatencyHistoryChart from "./LatencyHistoryChart";
import "../systemAdmin.css";

export default function HealthDashboard() {
  const { data, isLoading, isError, error, history, lastChecked, refreshNow } =
    useHealthCheck();

  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    setSecondsAgo(Math.round((Date.now() - lastChecked) / 1000));
    const id = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastChecked) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastChecked]);

  if (isLoading) {
    return (
      <div className="sa-loading">
        <span className="sa-spinner lg" />
        Loading health data…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sa-loading">
        <i className="fa fa-exclamation-triangle" style={{ color: "#ef4444", fontSize: "1.4rem" }} />
        Failed to load health data
        {error instanceof Error && `: ${error.message}`}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <StatusBanner overall={data.overall} />

      <div className="sa-meta-row">
        <span>
          Last checked: <strong>{secondsAgo}s ago</strong>
        </span>
        <button className="btn btn-sm btn-outline-primary" onClick={refreshNow}>
          <i className="fa fa-refresh" /> Refresh Now
        </button>
      </div>

      <div className="sa-card-grid">
        <ServiceCard name="App" check={data.checks.app} icon="fa-server" />
        <ServiceCard name="MySQL" check={data.checks.mysql} icon="fa-database" />
        <ServiceCard name="vLLM" check={data.checks.vllm} icon="fa-brain" />
        <ServiceCard name="Qdrant" check={data.checks.qdrant} icon="fa-vector-square" />
      </div>

      <LatencyChart checks={data.checks} />
      <LatencyHistoryChart history={history} />
    </div>
  );
}
