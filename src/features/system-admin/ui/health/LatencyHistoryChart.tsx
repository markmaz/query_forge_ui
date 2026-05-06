import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { HealthHistoryEntry } from "@/features/system-admin/types";

interface LatencyHistoryChartProps {
  history: HealthHistoryEntry[];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false });
}

export default function LatencyHistoryChart({ history }: LatencyHistoryChartProps) {
  if (history.length < 2) {
    return (
      <div className="sa-chart-section">
        <div className="sa-chart-title">Latency History</div>
        <div className="sa-loading">Not enough data</div>
      </div>
    );
  }

  const data = history.map((entry) => ({
    time: formatTime(entry.timestamp),
    MySQL: entry.data.checks.mysql.latency_ms ?? null,
    "Workspace LLMs": entry.data.checks.llms?.latency_ms ?? entry.data.checks.vllm?.latency_ms ?? null,
    Qdrant: entry.data.checks.qdrant.latency_ms ?? null,
  }));

  return (
    <div className="sa-chart-section">
      <div className="sa-chart-title">Latency History</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis unit=" ms" />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="MySQL"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="Workspace LLMs"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="Qdrant"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
