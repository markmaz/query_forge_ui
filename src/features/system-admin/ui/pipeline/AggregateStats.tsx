import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PipelineProfile } from "@/features/system-admin/types";
import AdminChartCard from "@/features/admin/charts/AdminChartCard";
import AdminChartTooltip from "@/features/admin/charts/AdminChartTooltip";
import { CHART_COLORS, GRID_COLOR, TEXT_MUTED, formatSeconds } from "@/features/admin/charts/AdminChartTheme";

interface AggregateStatsProps {
  profiles: PipelineProfile[];
}

const CATEGORY_COLORS = [
  CHART_COLORS.stage1,
  CHART_COLORS.stage2,
  CHART_COLORS.stage3,
  CHART_COLORS.stage4,
  CHART_COLORS.stage5,
  CHART_COLORS.stage6,
  CHART_COLORS.stage7,
  CHART_COLORS.stage8,
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
      count += 1;
      for (const step of profile.steps) {
        const cat = categorize(step.label);
        totals[cat] = (totals[cat] || 0) + step.ms;
      }
    }
    if (count === 0) return [];
    return Object.entries(totals)
      .map(([name, ms]) => ({ name, value_sec: Math.round((ms / count) / 10) / 100 }))
      .sort((a, b) => b.value_sec - a.value_sec);
  }, [profiles]);

  return (
    <div className="row g-4 mb-4">
      <div className="col-12 col-xl-4">
        <AdminChartCard title="Avg Total" subtitle="Average full pipeline duration.">
          <span className="admin-kpi-pill">{formatSeconds(avg)}</span>
        </AdminChartCard>
      </div>
      <div className="col-12 col-xl-4">
        <AdminChartCard title="Median" subtitle="Median full pipeline duration.">
          <span className="admin-kpi-pill">{formatSeconds(median)}</span>
        </AdminChartCard>
      </div>
      <div className="col-12 col-xl-4">
        <AdminChartCard title="P95" subtitle="95th percentile full pipeline duration.">
          <span className="admin-kpi-pill">{formatSeconds(p95)}</span>
        </AdminChartCard>
      </div>

      <div className="col-12">
        <AdminChartCard
          title="Average Time by Category"
          subtitle="Per-category average across returned profiles (seconds), sorted highest to lowest."
        >
          <ResponsiveContainer width="100%" height={Math.max(280, pieData.length * 48)}>
            <BarChart data={pieData} layout="vertical" margin={{ top: 8, right: 28, left: 6, bottom: 6 }}>
              <defs>
                {CATEGORY_COLORS.map((color, index) => (
                  <linearGradient key={color} id={`pipelineCatBarGrad${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.34} />
                    <stop offset="40%" stopColor={color} stopOpacity={0.58} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.46} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" tick={{ fill: TEXT_MUTED }} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fill: TEXT_MUTED }} />
              <Tooltip content={<AdminChartTooltip unit="s" />} />
              <Bar dataKey="value_sec" radius={[0, 10, 10, 0]}>
                <LabelList dataKey="value_sec" position="right" formatter={(value: number) => `${Number(value).toFixed(2)}s`} />
                {pieData.map((entry, index) => (
                  <Cell key={entry.name} fill={`url(#pipelineCatBarGrad${index % CATEGORY_COLORS.length})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AdminChartCard>
      </div>
    </div>
  );
}
