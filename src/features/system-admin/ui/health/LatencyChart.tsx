import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { HealthCheck } from "@/features/system-admin/types";

interface LatencyChartProps {
  checks: HealthCheck["checks"];
}

function latencyColor(ms: number | undefined): string {
  if (ms == null) return "#9ca3af";
  if (ms < 100) return "#22c55e";
  if (ms <= 500) return "#f59e0b";
  return "#ef4444";
}

export default function LatencyChart({ checks }: LatencyChartProps) {
  const data = [
    { name: "MySQL", latency: checks.mysql.latency_ms ?? 0 },
    { name: "vLLM", latency: checks.vllm.latency_ms ?? 0 },
    { name: "Qdrant", latency: checks.qdrant.latency_ms ?? 0 },
  ];

  return (
    <div className="sa-chart-section">
      <div className="sa-chart-title">Service Latency</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" unit=" ms" />
          <YAxis type="category" dataKey="name" width={60} />
          <Tooltip formatter={(value: number) => [`${value} ms`, "Latency"]} />
          <Bar dataKey="latency" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={latencyColor(entry.latency)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
