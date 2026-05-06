import { useEffect, useState } from "react";
import { useHealthCheck } from "@/features/system-admin/hooks";
import StatusBanner from "./StatusBanner";
import ServiceCard from "./ServiceCard";
import ValkeyCard from "./ValkeyCard";
import BrokerCard from "./BrokerCard";
import FlowForgeHealthCard from "./FlowForgeHealthCard";
import LatencyChart from "./LatencyChart";
import AdminChartCard from "@/features/admin/charts/AdminChartCard";
import "../systemAdmin.css";
import "@/styles/admin-charts.css";

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
      <div className="admin-charts-page">
        <AdminChartCard title="System Health" subtitle="Loading latest service checks.">
          <div className="admin-chart-skeleton" />
        </AdminChartCard>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-charts-page">
        <AdminChartCard title="System Health" subtitle="We could not load service status.">
          <div className="admin-error-card">
            <div>
              Failed to load health data
              {error instanceof Error && `: ${error.message}`}
            </div>
            <div>
              <button className="btn btn-sm btn-outline-light" onClick={refreshNow}>
                Retry
              </button>
            </div>
          </div>
        </AdminChartCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-charts-page">
        <AdminChartCard title="System Health" subtitle="No service data available yet.">
          <div className="admin-empty-card">
            <div>No health check payload has been returned.</div>
            <div className="text-muted">Try refreshing in a few seconds.</div>
          </div>
        </AdminChartCard>
      </div>
    );
  }

  return (
    <div className="admin-charts-page">
      <StatusBanner overall={data.overall} />

      <div className="sa-meta-row">
        <span>
          Last checked: <strong>{secondsAgo}s ago</strong>
        </span>
        <button className="btn btn-sm btn-outline-primary" onClick={refreshNow}>
          <i className="fa fa-refresh" /> Refresh Now
        </button>
      </div>

      <div className="sa-card-grid sa-health-card-grid">
        <ServiceCard name="App" check={data.checks.app} icon="fa-server" />
        <ServiceCard name="MySQL" check={data.checks.mysql} icon="fa-database" />
        <ServiceCard name="vLLM" check={data.checks.vllm} icon="fa-brain" />
        <ServiceCard name="Qdrant" check={data.checks.qdrant} icon="fa-vector-square" />
        {data.checks.mcp ? <ServiceCard name="MCP Server" check={data.checks.mcp} icon="fa-plug" /> : null}
        {data.checks.broker ? <ValkeyCard check={data.checks.broker.valkey} /> : null}
        {data.checks.broker ? <BrokerCard check={data.checks.broker} /> : null}
        {data.checks.flowforge ? <FlowForgeHealthCard check={data.checks.flowforge} /> : null}
      </div>

      <LatencyChart checks={data.checks} history={history} />
    </div>
  );
}
