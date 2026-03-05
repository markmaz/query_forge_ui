import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PipelineProfile } from "@/features/system-admin/types";

interface AggregateStatsProps {
  profiles: PipelineProfile[];
}

const CATEGORY_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#ef4444",
  "#6b7280",
];

function categorize(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("context")) return "Context";
  if (l.includes("normalize")) return "Normalize";
  if (l.includes("vector") || l.includes("candidate")) return "Domain Selection";
  if (l.includes("capabilities") || l.includes("shortlist")) return "Capabilities";
  if (l.includes("llm")) return "LLM Generation";
  if (l.includes("validate") || l.includes("repair")) return "Validation";
  if (l.includes("map") || l.includes("sql")) return "Map to SQL";
  return "Other";
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export default function AggregateStats({ profiles }: AggregateStatsProps) {
  const { avg, median, p95 } = useMemo(() => {
    if (profiles.length === 0) return { avg: 0, median: 0, p95: 0 };
    const sorted = profiles.map((p) => p.total_ms).sort((a, b) => a - b);
    const sum = sorted.reduce((s, v) => s + v, 0);
    return {
      avg: Math.round(sum / sorted.length),
      median: Math.round(percentile(sorted, 50)),
      p95: Math.round(percentile(sorted, 95)),
    };
  }, [profiles]);

  const pieData = useMemo(() => {
    const totals: Record<string, number> = {};
    let count = 0;
    for (const profile of profiles) {
      count++;
      for (const step of profile.steps) {
        const cat = categorize(step.label);
        totals[cat] = (totals[cat] || 0) + step.ms;
      }
    }
    if (count === 0) return [];
    return Object.entries(totals)
      .map(([name, ms]) => ({ name, value: Math.round(ms / count) }))
      .sort((a, b) => b.value - a.value);
  }, [profiles]);

  const categoryOrder = [
    "Context",
    "Normalize",
    "Domain Selection",
    "Capabilities",
    "LLM Generation",
    "Validation",
    "Map to SQL",
    "Other",
  ];
  const colorMap = Object.fromEntries(
    categoryOrder.map((c, i) => [c, CATEGORY_COLORS[i]]),
  );

  return (
    <>
      <div className="sa-stats-row">
        <div className="sa-stat-card">
          <div className="sa-stat-label">Avg Total</div>
          <div className="sa-stat-value">{avg} ms</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">Median</div>
          <div className="sa-stat-value">{median} ms</div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-label">P95</div>
          <div className="sa-stat-value">{p95} ms</div>
        </div>
      </div>

      <div className="sa-chart-section">
        <div className="sa-chart-title">Average Time by Category</div>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {pieData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={colorMap[entry.name] || "#6b7280"}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `${value} ms`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
